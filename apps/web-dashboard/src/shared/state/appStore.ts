import { create } from "zustand";

interface WindowSlot {
  machineId: string | null;
  sessionId: string | null;
  heightPx: number;
}

const EMPTY_SLOT: WindowSlot = { machineId: null, sessionId: null, heightPx: 480 };

const initialWindows: WindowSlot[] = [
  { ...EMPTY_SLOT },
  { ...EMPTY_SLOT },
  { ...EMPTY_SLOT },
  { ...EMPTY_SLOT },
];

interface AppState {
  selectedMachineId: string | null;
  selectedSessionId: string | null;
  connectionError: string | null;
  connectionFailureCount: number;
  windows: WindowSlot[];
  activeWindowIndex: number;
  layoutCount: 1 | 2 | 4;
  setSelectedSession: (machineId: string, sessionId: string) => void;
  setWindowSelection: (index: number, machineId: string | null, sessionId: string | null) => void;
  clearSelection: () => void;
  clearWindowSelection: (index: number) => void;
  setWindowHeight: (index: number, heightPx: number) => void;
  setConnectionError: (error: string | null) => void;
  recordConnectionFailure: (error: string) => void;
  recordConnectionSuccess: () => void;
  setActiveWindow: (index: number) => void;
  setLayoutCount: (count: 1 | 2 | 4) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedMachineId: null,
  selectedSessionId: null,
  connectionError: null,
  connectionFailureCount: 0,
  windows: [...initialWindows],
  activeWindowIndex: 0,
  layoutCount: 1,
  setSelectedSession: (machineId, sessionId) =>
    set((state) => {
      const windows = [...state.windows];
      windows[state.activeWindowIndex] = { machineId, sessionId, heightPx: windows[state.activeWindowIndex]?.heightPx ?? EMPTY_SLOT.heightPx };
      return {
        windows,
        selectedMachineId: machineId,
        selectedSessionId: sessionId,
      };
    }),
  setWindowSelection: (index, machineId, sessionId) =>
    set((state) => {
      const windows = [...state.windows];
      windows[index] = { machineId, sessionId, heightPx: windows[index]?.heightPx ?? EMPTY_SLOT.heightPx };
      return { windows };
    }),
  clearSelection: () =>
    set((state) => {
      const windows = [...state.windows];
      windows[state.activeWindowIndex] = { ...EMPTY_SLOT, heightPx: windows[state.activeWindowIndex]?.heightPx ?? EMPTY_SLOT.heightPx };
      return {
        windows,
        selectedMachineId: null,
        selectedSessionId: null,
      };
    }),
  clearWindowSelection: (index) =>
    set((state) => {
      const windows = [...state.windows];
      windows[index] = { ...EMPTY_SLOT, heightPx: windows[index]?.heightPx ?? EMPTY_SLOT.heightPx };
      return { windows };
    }),
  setWindowHeight: (index, heightPx) =>
    set((state) => {
      const windows = [...state.windows];
      windows[index] = { ...windows[index], heightPx: Math.max(280, Math.min(1200, heightPx)) };
      return { windows };
    }),
  setConnectionError: (error) => set({ connectionError: error }),
  recordConnectionFailure: (error) =>
    set((state) => {
      const connectionFailureCount = state.connectionFailureCount + 1;
      return {
        connectionFailureCount,
        connectionError:
          connectionFailureCount >= 2
            ? error
            : state.connectionError,
      };
    }),
  recordConnectionSuccess: () =>
    set({ connectionFailureCount: 0, connectionError: null }),
  setActiveWindow: (index) =>
    set((state) => {
      const slot = state.windows[index];
      return {
        activeWindowIndex: index,
        selectedMachineId: slot.machineId,
        selectedSessionId: slot.sessionId,
      };
    }),
  setLayoutCount: (count) => set({ layoutCount: count }),
}));
