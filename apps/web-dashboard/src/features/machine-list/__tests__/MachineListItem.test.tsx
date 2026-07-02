import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MachineListItem } from "../MachineListItem";
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
});
