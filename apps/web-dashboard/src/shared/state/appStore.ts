import { create } from "zustand";

interface AppState {
  selectedMachineId: string | null;
  selectedSessionId: string | null;
  connectionError: string | null;
  connectionFailureCount: number;
  setSelectedSession: (machineId: string, sessionId: string) => void;
  clearSelection: () => void;
  setConnectionError: (error: string | null) => void;
  recordConnectionFailure: (error: string) => void;
  recordConnectionSuccess: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedMachineId: null,
  selectedSessionId: null,
  connectionError: null,
  connectionFailureCount: 0,
  setSelectedSession: (machineId, sessionId) =>
    set({ selectedMachineId: machineId, selectedSessionId: sessionId }),
  clearSelection: () =>
    set({ selectedMachineId: null, selectedSessionId: null }),
  setConnectionError: (error) => set({ connectionError: error }),
  recordConnectionFailure: (error) =>
    set((state) => {
      const connectionFailureCount = state.connectionFailureCount + 1;
      return {
        connectionFailureCount,
        connectionError: connectionFailureCount >= 2 ? error : state.connectionError,
      };
    }),
  recordConnectionSuccess: () =>
    set({ connectionFailureCount: 0, connectionError: null }),
}));
