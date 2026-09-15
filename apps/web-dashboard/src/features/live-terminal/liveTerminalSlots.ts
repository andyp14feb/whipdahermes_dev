import { create } from "zustand";

/** Dashboard-wide cap for concurrent Live (xterm) mounts. */
export const MAX_CONCURRENT_LIVE_TERMINALS = 4;

interface LiveTerminalSlotsState {
  openCount: number;
  /** Acquire a live slot. Returns false if already at capacity. */
  acquire: () => boolean;
  /** Release a previously acquired live slot. */
  release: () => void;
}

export const useLiveTerminalSlots = create<LiveTerminalSlotsState>((set, get) => ({
  openCount: 0,
  acquire: () => {
    const { openCount } = get();
    if (openCount >= MAX_CONCURRENT_LIVE_TERMINALS) {
      return false;
    }
    set({ openCount: openCount + 1 });
    return true;
  },
  release: () => {
    set({ openCount: Math.max(0, get().openCount - 1) });
  },
}));
