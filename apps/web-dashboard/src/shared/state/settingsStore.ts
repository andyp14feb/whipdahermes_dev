import { create } from "zustand";
import type { TemplateAction } from "../../features/command-panel/commandPanel.types";

export const STORAGE_KEY = "whipai-settings";

export type ThemeMode = "light" | "dark";

export interface NudgeConfig {
  enabled: boolean;
  stableTimeSeconds: number;
  maxNudges: number;
  nudgesSent: number;
}

interface Settings {
  workerApiUrl: string;
  refreshIntervalMs: number;
  staleTimeoutSeconds: number;
  aiProviderBaseUrl: string;
  aiApiKey: string;
  aiSelectedModel: string;
  aiProviderName: string;
  themeMode: ThemeMode;
  templateActions: TemplateAction[];
  nudgesBySession: Record<string, NudgeConfig>;
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
  setThemeMode: (themeMode: ThemeMode) => void;
  addTemplateAction: (template: Omit<TemplateAction, "id">) => void;
  updateTemplateAction: (id: string, template: Omit<TemplateAction, "id">) => void;
  deleteTemplateAction: (id: string) => void;
  upsertNudgeConfig: (sessionKey: string, config: Omit<NudgeConfig, "nudgesSent"> & { nudgesSent?: number }) => void;
  incrementNudgeCount: (sessionKey: string) => void;
  clearNudgeConfig: (sessionKey: string) => void;
  save: () => void;
  reset: () => void;
}

export const DEFAULT_TEMPLATE_ACTIONS: TemplateAction[] = [
  { id: "yes", label: "yes", payload: "yes" },
  { id: "continue", label: "continue", payload: "continue" },
  { id: "retry", label: "retry", payload: "retry" },
  { id: "skip", label: "skip", payload: "skip" },
  { id: "explain", label: "explain", payload: "explain" },
];

const defaultSettings: Settings = {
  workerApiUrl: "http://localhost:8000",
  refreshIntervalMs: 2000,
  staleTimeoutSeconds: 60,
  aiProviderBaseUrl: "",
  aiApiKey: "",
  aiSelectedModel: "",
  aiProviderName: "",
  themeMode: "light",
  templateActions: DEFAULT_TEMPLATE_ACTIONS,
  nudgesBySession: {},
};

function normalizeTemplateActions(actions: Partial<TemplateAction>[] | undefined) {
  if (!actions || actions.length === 0) {
    return DEFAULT_TEMPLATE_ACTIONS;
  }

  return actions
    .filter((action): action is TemplateAction =>
      typeof action?.id === "string" &&
      typeof action?.label === "string" &&
      typeof action?.payload === "string",
    )
    .map((action) => ({ ...action }));
}

function normalizeNudges(
  nudgesBySession: Record<string, Partial<NudgeConfig>> | undefined,
): Record<string, NudgeConfig> {
  if (!nudgesBySession) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(nudgesBySession)
      .filter(([, config]) =>
        typeof config?.enabled === "boolean" &&
        typeof config?.stableTimeSeconds === "number" &&
        typeof config?.maxNudges === "number",
      )
      .map(([key, config]) => [
        key,
        {
          enabled: config.enabled!,
          stableTimeSeconds: config.stableTimeSeconds!,
          maxNudges: config.maxNudges!,
          nudgesSent: config.nudgesSent ?? 0,
        },
      ]),
  );
}

function persistSettings(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

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
        themeMode: parsed.themeMode === "dark" ? "dark" : defaultSettings.themeMode,
        templateActions: normalizeTemplateActions(parsed.templateActions),
        nudgesBySession: normalizeNudges(parsed.nudgesBySession),
      };
    }
  } catch {}
  return defaultSettings;
}

function withDirtyFlag<T extends object>(patch: T): T & { isDirty: true } {
  return { ...patch, isDirty: true };
}

const defaults = loadFromStorage();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaults,
  isDirty: false,
  setWorkerApiUrl: (workerApiUrl) => set(withDirtyFlag({ workerApiUrl })),
  setRefreshIntervalMs: (refreshIntervalMs) =>
    set(withDirtyFlag({ refreshIntervalMs })),
  setStaleTimeoutSeconds: (staleTimeoutSeconds) =>
    set(withDirtyFlag({ staleTimeoutSeconds })),
  setAiProviderBaseUrl: (aiProviderBaseUrl) =>
    set(withDirtyFlag({ aiProviderBaseUrl })),
  setAiApiKey: (aiApiKey) => set(withDirtyFlag({ aiApiKey })),
  setAiSelectedModel: (aiSelectedModel) =>
    set(withDirtyFlag({ aiSelectedModel })),
  setAiProviderName: (aiProviderName) =>
    set(withDirtyFlag({ aiProviderName })),
  setThemeMode: (themeMode) => {
    const nextSettings = { ...get(), themeMode };
    persistSettings({
      workerApiUrl: nextSettings.workerApiUrl,
      refreshIntervalMs: nextSettings.refreshIntervalMs,
      staleTimeoutSeconds: nextSettings.staleTimeoutSeconds,
      aiProviderBaseUrl: nextSettings.aiProviderBaseUrl,
      aiApiKey: nextSettings.aiApiKey,
      aiSelectedModel: nextSettings.aiSelectedModel,
      aiProviderName: nextSettings.aiProviderName,
      themeMode: nextSettings.themeMode,
      templateActions: nextSettings.templateActions,
      nudgesBySession: nextSettings.nudgesBySession,
    });
    set({ themeMode });
  },
  addTemplateAction: (template) =>
    set((state) => {
      const templateActions = [
        ...state.templateActions,
        {
          id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${state.templateActions.length}`,
          ...template,
        },
      ];
      return withDirtyFlag({ templateActions });
    }),
  updateTemplateAction: (id, template) =>
    set((state) =>
      withDirtyFlag({
        templateActions: state.templateActions.map((action) =>
          action.id === id ? { id, ...template } : action,
        ),
      }),
    ),
  deleteTemplateAction: (id) =>
    set((state) =>
      withDirtyFlag({
        templateActions: state.templateActions.filter((action) => action.id !== id),
      }),
    ),
  upsertNudgeConfig: (sessionKey, config) =>
    set((state) => {
      const current = state.nudgesBySession[sessionKey];
      return withDirtyFlag({
        nudgesBySession: {
          ...state.nudgesBySession,
          [sessionKey]: {
            enabled: config.enabled,
            stableTimeSeconds: config.stableTimeSeconds,
            maxNudges: config.maxNudges,
            nudgesSent: config.nudgesSent ?? current?.nudgesSent ?? 0,
          },
        },
      });
    }),
  incrementNudgeCount: (sessionKey) =>
    set((state) => {
      const current = state.nudgesBySession[sessionKey];
      if (!current) {
        return state;
      }
      const nudgesSent = Math.min(current.nudgesSent + 1, current.maxNudges);
      return withDirtyFlag({
        nudgesBySession: {
          ...state.nudgesBySession,
          [sessionKey]: {
            ...current,
            nudgesSent,
            enabled: nudgesSent < current.maxNudges && current.enabled,
          },
        },
      });
    }),
  clearNudgeConfig: (sessionKey) =>
    set((state) => {
      const next = { ...state.nudgesBySession };
      delete next[sessionKey];
      return withDirtyFlag({ nudgesBySession: next });
    }),
  save: () => {
    const {
      workerApiUrl,
      refreshIntervalMs,
      staleTimeoutSeconds,
      aiProviderBaseUrl,
      aiApiKey,
      aiSelectedModel,
      aiProviderName,
      themeMode,
      templateActions,
      nudgesBySession,
    } = get();
    persistSettings({
      workerApiUrl,
      refreshIntervalMs,
      staleTimeoutSeconds,
      aiProviderBaseUrl,
      aiApiKey,
      aiSelectedModel,
      aiProviderName,
      themeMode,
      templateActions,
      nudgesBySession,
    });
    set({ isDirty: false });
    window.location.reload();
  },
  reset: () => {
    persistSettings(defaultSettings);
    set({ ...defaultSettings, isDirty: false });
    window.location.reload();
  },
}));

export function getSessionNudgeKey(machineId: string, sessionId: string) {
  return `${machineId}:${sessionId}`;
}
