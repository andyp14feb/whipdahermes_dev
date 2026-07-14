import { beforeEach, describe, expect, it, vi } from "vitest";
import { killSessionCommandBody, tmuxSessionNameFromPaneTarget } from "../machineList.api";

describe("machineList.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives the tmux session name from a captured pane target", () => {
    expect(tmuxSessionNameFromPaneTarget("testtobekilled:0.0")).toBe("testtobekilled");
    expect(tmuxSessionNameFromPaneTarget("plain-session")).toBe("plain-session");
  });

  it("builds kill_session with the tmux session name instead of the pane target", () => {
    expect(killSessionCommandBody("m-1", "testtobekilled:0.0")).toEqual({
      machine_id: "m-1",
      session_id: "testtobekilled:0.0",
      payload: "__whipai__:kill_session:testtobekilled",
    });
  });
});
