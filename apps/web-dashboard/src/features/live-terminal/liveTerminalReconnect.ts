/** Browser live-terminal WS reconnect helpers (P2). */

export const RESIZE_DEBOUNCE_MS = 150;
export const RECONNECT_BASE_MS = 500;
export const RECONNECT_MAX_MS = 15000;

/** Close codes that should not auto-retry (auth / unsupported). */
export const FATAL_CLOSE_CODES = new Set([4401, 4403]);

export function reconnectDelayMs(
  attempt: number,
  baseMs: number = RECONNECT_BASE_MS,
  maxMs: number = RECONNECT_MAX_MS,
  randomFn: () => number = Math.random,
): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
  const jitter = Math.floor(randomFn() * 250);
  return exp + jitter;
}
