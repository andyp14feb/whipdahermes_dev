import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MachineListItem } from "../MachineListItem";
import * as machineListApi from "../machineList.api";
import * as commandPanelApi from "../../command-panel/commandPanel.api";
import { useAppStore } from "../../../shared/state/appStore";
import { useSettingsStore } from "../../../shared/state/settingsStore";
import type { SessionListItem } from "../../../shared/types/contracts";

const session: SessionListItem = {
  machine_id: "machine-1",
  session_id: "A",
  label: "A",
  status: "active",
  seconds_since_change: 0,
  last_seen_at: "2026-06-28T00:00:00Z",
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("MachineListItem", () => {
  beforeEach(() => {
    useAppStore.setState({ selectedMachineId: null, selectedSessionId: null });
    useSettingsStore.setState({ nudgesBySession: {} });
  });

  it("selects by machine and session identity", () => {
    useAppStore.setState({ selectedMachineId: "machine-1", selectedSessionId: "A" });

    renderWithClient(
      <>
        <MachineListItem machineId="machine-1" session={session} />
        <MachineListItem machineId="machine-2" session={{ ...session, machine_id: "machine-2" }} />
      </>,
    );

    const [selected, unselected] = screen.getAllByRole("button", { name: /A active 0s/i });
    expect(selected).toHaveClass("bg-blue-50");
    expect(unselected).not.toHaveClass("bg-blue-50");
  });

  it("toggles nudge without opening config modal", async () => {
    const user = userEvent.setup();
    renderWithClient(<MachineListItem machineId="machine-1" session={session} />);

    await user.click(screen.getByLabelText("Nudge this"));

    expect(useSettingsStore.getState().nudgesBySession["machine-1:A"]?.enabled).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens nudge modal from configure and validates inputs", async () => {
    const user = userEvent.setup();
    renderWithClient(<MachineListItem machineId="machine-1" session={session} />);

    await user.click(screen.getByRole("button", { name: "Configure" }));
    await user.clear(screen.getByLabelText("Stable-time threshold (seconds)"));
    await user.clear(screen.getByLabelText("Max nudges"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent("positive integers");
  });

  it("shows remove button and confirms before deleting", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderWithClient(<MachineListItem machineId="machine-1" session={session} />);

    const removeBtn = screen.getByTitle("Remove session from list");
    expect(removeBtn).toBeInTheDocument();

    await user.click(removeBtn);
    expect(confirmSpy).toHaveBeenCalledWith(
      'Remove session "A" from the displayed list only? The session may reappear on the next heartbeat.',
    );

    confirmSpy.mockRestore();
  });

  it("allows colonated tmux rename names", async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("0.0:tmuxagent");
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    const renameSpy = vi.spyOn(machineListApi, "enqueueRenameTmuxSession").mockResolvedValue({
      command_id: "cmd-rename",
      state: "accepted",
      target: "machine-1:A",
    });

    renderWithClient(<MachineListItem machineId="machine-1" session={session} />);

    await user.click(screen.getByRole("button", { name: "Rename" }));

    expect(renameSpy).toHaveBeenCalledWith("machine-1", "A", "0.0:tmuxagent");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    promptSpy.mockRestore();
    alertSpy.mockRestore();
    renameSpy.mockRestore();
  });

  it("sends a nudge prompt once a stable session crosses the configured threshold", async () => {
    const sendCommandSpy = vi
      .spyOn(commandPanelApi, "sendCommand")
      .mockResolvedValue({ command_id: "cmd-nudge-1", state: "accepted", target: "machine-1:A" });

    useSettingsStore.setState({
      nudgesBySession: {
        "machine-1:A": {
          enabled: true,
          stableTimeSeconds: 30,
          maxNudges: 3,
          nudgesSent: 0,
          customPrompt: "please continue",
        },
      },
    });

    renderWithClient(
      <MachineListItem
        machineId="machine-1"
        session={{ ...session, status: "stable", seconds_since_change: 45 }}
      />,
    );

    await waitFor(() => {
      expect(sendCommandSpy).toHaveBeenCalledWith("machine-1", "A", "please continue");
    });
    expect(useSettingsStore.getState().nudgesBySession["machine-1:A"].nudgesSent).toBe(1);
    expect(await screen.findByRole("alert")).toHaveTextContent("Nudge sent to A.");

    sendCommandSpy.mockRestore();
  });

  it("does not send a nudge when the session is still active", async () => {
    const sendCommandSpy = vi.spyOn(commandPanelApi, "sendCommand");

    useSettingsStore.setState({
      nudgesBySession: {
        "machine-1:A": {
          enabled: true,
          stableTimeSeconds: 30,
          maxNudges: 3,
          nudgesSent: 0,
          customPrompt: "please continue",
        },
      },
    });

    renderWithClient(
      <MachineListItem
        machineId="machine-1"
        session={{ ...session, status: "active", seconds_since_change: 120 }}
      />,
    );

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(sendCommandSpy).not.toHaveBeenCalled();

    sendCommandSpy.mockRestore();
  });

  it("does not send a nudge when nudging is disabled", async () => {
    const sendCommandSpy = vi.spyOn(commandPanelApi, "sendCommand");

    renderWithClient(
      <MachineListItem
        machineId="machine-1"
        session={{ ...session, status: "stable", seconds_since_change: 200 }}
      />,
    );

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(sendCommandSpy).not.toHaveBeenCalled();

    sendCommandSpy.mockRestore();
  });

  it("falls back to the default nudge prompt when none is configured", async () => {
    const sendCommandSpy = vi
      .spyOn(commandPanelApi, "sendCommand")
      .mockResolvedValue({ command_id: "cmd-nudge-2", state: "accepted", target: "machine-1:A" });

    useSettingsStore.setState({
      nudgesBySession: {
        "machine-1:A": {
          enabled: true,
          stableTimeSeconds: 30,
          maxNudges: 3,
          nudgesSent: 0,
          customPrompt: "",
        },
      },
    });

    renderWithClient(
      <MachineListItem
        machineId="machine-1"
        session={{ ...session, status: "waiting", seconds_since_change: 120 }}
      />,
    );

    await waitFor(() => {
      expect(sendCommandSpy).toHaveBeenCalledWith(
        "machine-1",
        "A",
        "Please continue if you are waiting for input.",
      );
    });

    sendCommandSpy.mockRestore();
  });
});
