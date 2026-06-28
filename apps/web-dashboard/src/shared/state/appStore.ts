import { create } from "zustand";

interface WindowSlot {
  machineId: string | null;
  sessionId: string | null;
}

const EMPTY_SLOT: WindowSlot = { machineId: null, sessionId: null };

const initialWindows: WindowSlot[] = [
  EMPTY_SLOT,
  EMPTY_SLOT,
  EMPTY_SLOT,
  EMPTY_SLOT,
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
  clearSelection: () => void;
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
      windows[state.activeWindowIndex] = { machineId, sessionId };
      return {
        windows,
        selectedMachineId: machineId,
        selectedSessionId: sessionId,
      };
    }),
  clearSelection: () =>
    set((state) => {
      const windows = [...state.windows];
      windows[state.activeWindowIndex] = EMPTY_SLOT;
      return {
        windows,
        selectedMachineId: null,
        selectedSessionId: null,
      };
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
