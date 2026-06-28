import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
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

describe("MachineListItem", () => {
  beforeEach(() => {
    useAppStore.setState({ selectedMachineId: null, selectedSessionId: null });
    useSettingsStore.setState({ nudgesBySession: {} });
  });

  it("selects by machine and session identity", () => {
    useAppStore.setState({ selectedMachineId: "machine-1", selectedSessionId: "A" });

    render(
      <>
        <MachineListItem machineId="machine-1" session={session} />
        <MachineListItem machineId="machine-2" session={{ ...session, machine_id: "machine-2" }} />
      </>,
    );

    const [selected, unselected] = screen.getAllByRole("button", { name: /A active 0s/i });
    expect(selected).toHaveClass("bg-blue-50");
    expect(unselected).not.toHaveClass("bg-blue-50");
  });

  it("opens nudge modal and validates inputs", async () => {
    const user = userEvent.setup();
    render(<MachineListItem machineId="machine-1" session={session} />);

    await user.click(screen.getByLabelText("Nudge this"));
    await user.clear(screen.getByLabelText("Stable-time threshold (seconds)"));
    await user.clear(screen.getByLabelText("Max nudges"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent("positive integers");
  });
});
