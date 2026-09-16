import { describe, expect, it } from "vitest";
import {
  FATAL_CLOSE_CODES,
  RECONNECT_MAX_MS,
  reconnectDelayMs,
} from "../liveTerminalReconnect";

describe("liveTerminalReconnect", () => {
  it("grows exponentially and caps", () => {
    const d0 = reconnectDelayMs(0, 500, 15000, () => 0);
    const d3 = reconnectDelayMs(3, 500, 15000, () => 0);
    const d20 = reconnectDelayMs(20, 500, 15000, () => 0);
    expect(d0).toBe(500);
    expect(d3).toBe(4000);
    expect(d20).toBe(RECONNECT_MAX_MS);
  });

  it("treats auth (and legacy 4403) closes as fatal", () => {
    expect(FATAL_CLOSE_CODES.has(4401)).toBe(true);
    expect(FATAL_CLOSE_CODES.has(4403)).toBe(true);
    expect(FATAL_CLOSE_CODES.has(1006)).toBe(false);
  });
});
