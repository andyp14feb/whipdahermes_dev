import { create } from "zustand";

const STORAGE_KEY = "whipai-settings";

interface Settings {
  workerApiUrl: string;
  refreshIntervalMs: number;
  staleTimeoutSeconds: number;
}

interface SettingsState extends Settings {
  isDirty: boolean;
  setWorkerApiUrl: (url: string) => void;
  setRefreshIntervalMs: (ms: number) => void;
  setStaleTimeoutSeconds: (s: number) => void;
  save: () => void;
  reset: () => void;
}

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Settings;
      return {
        workerApiUrl: parsed.workerApiUrl ?? "http://localhost:8000",
        refreshIntervalMs: parsed.refreshIntervalMs ?? 2000,
        staleTimeoutSeconds: parsed.staleTimeoutSeconds ?? 60,
      };
    }
  } catch {}
  return {
    workerApiUrl: "http://localhost:8000",
    refreshIntervalMs: 2000,
    staleTimeoutSeconds: 60,
  };
}

const defaults = loadFromStorage();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaults,
  isDirty: false,
  setWorkerApiUrl: (workerApiUrl) => set({ workerApiUrl, isDirty: true }),
  setRefreshIntervalMs: (refreshIntervalMs) =>
    set({ refreshIntervalMs, isDirty: true }),
  setStaleTimeoutSeconds: (staleTimeoutSeconds) =>
    set({ staleTimeoutSeconds, isDirty: true }),
  save: () => {
    const { workerApiUrl, refreshIntervalMs, staleTimeoutSeconds } = get();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ workerApiUrl, refreshIntervalMs, staleTimeoutSeconds }),
    );
    set({ isDirty: false });
    window.location.reload();
  },
  reset: () => {
    const fresh: Settings = {
      workerApiUrl: "http://localhost:8000",
      refreshIntervalMs: 2000,
      staleTimeoutSeconds: 60,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    set({ ...fresh, isDirty: false });
    window.location.reload();
  },
}));
