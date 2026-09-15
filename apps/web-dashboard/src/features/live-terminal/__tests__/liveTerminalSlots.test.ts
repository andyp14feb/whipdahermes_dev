import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_CONCURRENT_LIVE_TERMINALS,
  useLiveTerminalSlots,
} from "../liveTerminalSlots";

describe("liveTerminalSlots", () => {
  beforeEach(() => {
    useLiveTerminalSlots.setState({ openCount: 0 });
  });

  it("acquires up to the concurrent Live cap", () => {
    for (let i = 0; i < MAX_CONCURRENT_LIVE_TERMINALS; i += 1) {
      expect(useLiveTerminalSlots.getState().acquire()).toBe(true);
    }
    expect(useLiveTerminalSlots.getState().openCount).toBe(MAX_CONCURRENT_LIVE_TERMINALS);
    expect(useLiveTerminalSlots.getState().acquire()).toBe(false);
    expect(useLiveTerminalSlots.getState().openCount).toBe(MAX_CONCURRENT_LIVE_TERMINALS);
  });

  it("releases slots so another Live can open", () => {
    expect(useLiveTerminalSlots.getState().acquire()).toBe(true);
    useLiveTerminalSlots.getState().release();
    expect(useLiveTerminalSlots.getState().openCount).toBe(0);
    expect(useLiveTerminalSlots.getState().acquire()).toBe(true);
  });
});
