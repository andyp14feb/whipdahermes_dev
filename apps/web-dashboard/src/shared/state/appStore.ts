import { create } from "zustand";

interface AppState {
  selectedMachineId: string | null;
  selectedSessionId: string | null;
  connectionError: string | null;
  setSelectedSession: (machineId: string, sessionId: string) => void;
  clearSelection: () => void;
  setConnectionError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedMachineId: null,
  selectedSessionId: null,
  connectionError: null,
  setSelectedSession: (machineId, sessionId) =>
    set({ selectedMachineId: machineId, selectedSessionId: sessionId }),
  clearSelection: () =>
    set({ selectedMachineId: null, selectedSessionId: null }),
  setConnectionError: (error) => set({ connectionError: error }),
}));
