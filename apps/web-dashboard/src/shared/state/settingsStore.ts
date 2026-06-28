import { create } from "zustand";

const STORAGE_KEY = "whipai-settings";

interface Settings {
  workerApiUrl: string;
  refreshIntervalMs: number;
  staleTimeoutSeconds: number;
  aiProviderBaseUrl: string;
  aiApiKey: string;
  aiSelectedModel: string;
  aiProviderName: string;
}

interface SettingsState extends Settings {
  isDirty: boolean;
  setWorkerApiUrl: (url: string) => void;
  setRefreshIntervalMs: (ms: number) => void;
  setStaleTimeoutSeconds: (s: number) => void;
  setAiProviderBaseUrl: (url: string) => void;
  setAiApiKey: (apiKey: string) => void;
  setAiSelectedModel: (model: string) => void;
  setAiProviderName: (provider: string) => void;
  save: () => void;
  reset: () => void;
}

const defaultSettings: Settings = {
  workerApiUrl: "http://localhost:8000",
  refreshIntervalMs: 2000,
  staleTimeoutSeconds: 60,
  aiProviderBaseUrl: "",
  aiApiKey: "",
  aiSelectedModel: "",
  aiProviderName: "",
};

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        workerApiUrl: parsed.workerApiUrl ?? defaultSettings.workerApiUrl,
        refreshIntervalMs:
          parsed.refreshIntervalMs ?? defaultSettings.refreshIntervalMs,
        staleTimeoutSeconds:
          parsed.staleTimeoutSeconds ?? defaultSettings.staleTimeoutSeconds,
        aiProviderBaseUrl:
          parsed.aiProviderBaseUrl ?? defaultSettings.aiProviderBaseUrl,
        aiApiKey: parsed.aiApiKey ?? defaultSettings.aiApiKey,
        aiSelectedModel:
          parsed.aiSelectedModel ?? defaultSettings.aiSelectedModel,
        aiProviderName:
          parsed.aiProviderName ?? defaultSettings.aiProviderName,
      };
    }
  } catch {}
  return defaultSettings;
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
  setAiProviderBaseUrl: (aiProviderBaseUrl) =>
    set({ aiProviderBaseUrl, isDirty: true }),
  setAiApiKey: (aiApiKey) => set({ aiApiKey, isDirty: true }),
  setAiSelectedModel: (aiSelectedModel) =>
    set({ aiSelectedModel, isDirty: true }),
  setAiProviderName: (aiProviderName) =>
    set({ aiProviderName, isDirty: true }),
  save: () => {
    const {
      workerApiUrl,
      refreshIntervalMs,
      staleTimeoutSeconds,
      aiProviderBaseUrl,
      aiApiKey,
      aiSelectedModel,
      aiProviderName,
    } = get();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        workerApiUrl,
        refreshIntervalMs,
        staleTimeoutSeconds,
        aiProviderBaseUrl,
        aiApiKey,
        aiSelectedModel,
        aiProviderName,
      }),
    );
    set({ isDirty: false });
    window.location.reload();
  },
  reset: () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSettings));
    set({ ...defaultSettings, isDirty: false });
    window.location.reload();
  },
}));
