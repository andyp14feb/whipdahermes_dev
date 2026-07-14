import { create } from "zustand";
import type { TemplateAction } from "../../features/command-panel/commandPanel.types";
import { apiClient } from "../api-client/apiClient";
import { normalizeProviderBaseUrl } from "./providerUrl";
import {
  CUSTOM_THEME_ID,
  DEFAULT_COLOR_THEME,
  DEFAULT_CUSTOM_PRESET,
  type CustomColorPreset,
  type CustomColorTheme,
  isColorThemeId,
  makeCustomPreset,
  normalizeCustomColors,
  normalizeCustomPresets,
  themeToCustomColors,
  getColorTheme,
} from "./colorThemes";

export const STORAGE_KEY = "whipai-settings";
const DASHBOARD_SETTINGS_PATH = "/dashboard/settings";

export type ThemeMode = "light" | "dark";
export type AiProviderType =
  | "openai-compatible"
  | "anthropic-compatible"
  | "gemini-compatible"
  | "ollama-compatible"
  | "9router-compatible";

export const AI_PROVIDER_TYPES: AiProviderType[] = [
  "openai-compatible",
  "anthropic-compatible",
  "gemini-compatible",
  "ollama-compatible",
  "9router-compatible",
];

export function isAiProviderType(value: string): value is AiProviderType {
  return AI_PROVIDER_TYPES.includes(value as AiProviderType);
}

export interface NudgeConfig {
  enabled: boolean;
  stableTimeSeconds: number;
  maxNudges: number;
  nudgesSent: number;
  customPrompt: string;
}

export const DEFAULT_NUDGE_PROMPT = "Please continue if you are waiting for input.";

interface Settings {
  workerApiUrl: string;
  refreshIntervalMs: number;
  staleTimeoutSeconds: number;
  requestTimeoutMs: number;
  aiProviderBaseUrl: string;
  aiProviderType: AiProviderType;
  aiApiKey: string;
  aiSelectedModel: string;
  aiProviderName: string;
  themeMode: ThemeMode;
  colorTheme: string;
  selectedCustomPresetId: string;
  customColors: CustomColorTheme;
  customColorPresets: CustomColorPreset[];
  templateActions: TemplateAction[];
  nudgesBySession: Record<string, NudgeConfig>;
}

interface SettingsState extends Settings {
  isDirty: boolean;
  setWorkerApiUrl: (url: string) => void;
  setRefreshIntervalMs: (ms: number) => void;
  setStaleTimeoutSeconds: (s: number) => void;
  setRequestTimeoutMs: (ms: number) => void;
  setAiProviderBaseUrl: (url: string) => void;
  setAiProviderType: (providerType: AiProviderType) => void;
  setAiApiKey: (apiKey: string) => void;
  setAiSelectedModel: (model: string) => void;
  setAiProviderName: (provider: string) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  setColorTheme: (colorTheme: string) => void;
  setSelectedCustomPresetId: (presetId: string) => void;
  setCustomColors: (colors: CustomColorTheme) => void;
  setCustomColor: (key: keyof CustomColorTheme, value: string) => void;
  saveCurrentColorsAsPreset: (name: string, colors?: CustomColorTheme) => void;
  updateCustomPreset: (presetId: string, colors: CustomColorTheme) => void;
  renameCustomPreset: (presetId: string, name: string) => void;
  deleteCustomPreset: (presetId: string) => void;
  loadCustomPreset: (presetId: string) => void;
  addTemplateAction: (template: Omit<TemplateAction, "id">) => void;
  updateTemplateAction: (id: string, template: Omit<TemplateAction, "id">) => void;
  deleteTemplateAction: (id: string) => void;
  moveTemplateAction: (id: string, direction: "up" | "down") => void;
  upsertNudgeConfig: (sessionKey: string, config: Omit<NudgeConfig, "nudgesSent" | "customPrompt"> & { nudgesSent?: number; customPrompt?: string }) => void;
  setNudgeEnabled: (sessionKey: string, enabled: boolean) => void;
  incrementNudgeCount: (sessionKey: string) => void;
  clearNudgeConfig: (sessionKey: string) => void;
  hydrateRemoteSettings: () => Promise<void>;
  save: () => void;
  reset: () => void;
}

interface RemoteDashboardSettings {
  exists: boolean;
  templateActions?: Partial<TemplateAction>[];
  nudgesBySession?: Record<string, Partial<NudgeConfig>>;
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
  requestTimeoutMs: 40000,
  aiProviderBaseUrl: "",
  aiProviderType: "openai-compatible",
  aiApiKey: "",
  aiSelectedModel: "",
  aiProviderName: "",
  themeMode: "light",
  colorTheme: DEFAULT_COLOR_THEME,
  selectedCustomPresetId: DEFAULT_CUSTOM_PRESET.id,
  customColors: { ...DEFAULT_CUSTOM_PRESET.colors },
  customColorPresets: [{ ...DEFAULT_CUSTOM_PRESET, colors: { ...DEFAULT_CUSTOM_PRESET.colors } }],
  templateActions: DEFAULT_TEMPLATE_ACTIONS,
  nudgesBySession: {},
};

function normalizeTemplateActions(actions: Partial<TemplateAction>[] | undefined) {
  const validActions = (actions ?? [])
    .filter((action): action is TemplateAction =>
      typeof action?.id === "string" &&
      typeof action?.label === "string" &&
      typeof action?.payload === "string",
    )
    .map((action) => ({ ...action }));
  const byId = new Map<string, TemplateAction>();

  for (const action of validActions) {
    byId.set(action.id, { ...action });
  }
  for (const action of DEFAULT_TEMPLATE_ACTIONS) {
    if (!byId.has(action.id)) {
      byId.set(action.id, { ...action });
    }
  }

  return Array.from(byId.values());
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
          customPrompt: typeof config.customPrompt === "string" ? config.customPrompt : DEFAULT_NUDGE_PROMPT,
        },
      ]),
  );
}

function persistSettings(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function dashboardSettingsPayload(settings: Settings) {
  return {
    templateActions: normalizeTemplateActions(settings.templateActions),
    nudgesBySession: normalizeNudges(settings.nudgesBySession),
  };
}

function persistRemoteDashboardSettings(settings: Settings) {
  void apiClient<{ ok: boolean }>(DASHBOARD_SETTINGS_PATH, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dashboardSettingsPayload(settings)),
  }).catch(() => undefined);
}

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      const customColorPresets = normalizeCustomPresets(parsed.customColorPresets);
      const selectedCustomPresetId = customColorPresets.some((preset) => preset.id === parsed.selectedCustomPresetId)
        ? parsed.selectedCustomPresetId!
        : customColorPresets[0].id;
      return {
        workerApiUrl: parsed.workerApiUrl ?? defaultSettings.workerApiUrl,
        refreshIntervalMs:
          parsed.refreshIntervalMs ?? defaultSettings.refreshIntervalMs,
        staleTimeoutSeconds:
          parsed.staleTimeoutSeconds ?? defaultSettings.staleTimeoutSeconds,
        requestTimeoutMs:
          parsed.requestTimeoutMs ?? defaultSettings.requestTimeoutMs,
        aiProviderBaseUrl:
          parsed.aiProviderBaseUrl ?? defaultSettings.aiProviderBaseUrl,
        aiProviderType: isAiProviderType(parsed.aiProviderType ?? "")
          ? (parsed.aiProviderType as AiProviderType)
          : defaultSettings.aiProviderType,
        aiApiKey: parsed.aiApiKey ?? defaultSettings.aiApiKey,
        aiSelectedModel:
          parsed.aiSelectedModel ?? defaultSettings.aiSelectedModel,
        aiProviderName:
          parsed.aiProviderName ?? defaultSettings.aiProviderName,
        themeMode: parsed.themeMode === "dark" ? "dark" : defaultSettings.themeMode,
        colorTheme: isColorThemeId(parsed.colorTheme ?? "")
          ? parsed.colorTheme!
          : defaultSettings.colorTheme,
        selectedCustomPresetId,
        customColors: normalizeCustomColors(parsed.customColors),
        customColorPresets,
        templateActions: normalizeTemplateActions(parsed.templateActions),
        nudgesBySession: normalizeNudges(parsed.nudgesBySession),
      };
    }
  } catch {}
  return {
    ...defaultSettings,
    selectedCustomPresetId: defaultSettings.selectedCustomPresetId,
    customColors: { ...defaultSettings.customColors },
    customColorPresets: defaultSettings.customColorPresets.map((preset) => ({ ...preset, colors: { ...preset.colors } })),
    templateActions: normalizeTemplateActions(defaultSettings.templateActions),
    nudgesBySession: {},
  };
}

function withDirtyFlag<T extends object>(patch: T): T & { isDirty: true } {
  return { ...patch, isDirty: true };
}

function persistCurrentSettings(get: () => SettingsState) {
  const {
    workerApiUrl,
    refreshIntervalMs,
    staleTimeoutSeconds,
    requestTimeoutMs,
    aiProviderBaseUrl,
    aiProviderType,
    aiApiKey,
    aiSelectedModel,
    aiProviderName,
    themeMode,
    colorTheme,
    selectedCustomPresetId,
    customColors,
    customColorPresets,
    templateActions,
    nudgesBySession,
  } = get();
  persistSettings({
    workerApiUrl,
    refreshIntervalMs,
    staleTimeoutSeconds,
    requestTimeoutMs,
    aiProviderBaseUrl,
    aiProviderType,
    aiApiKey,
    aiSelectedModel,
    aiProviderName,
    themeMode,
    colorTheme,
    selectedCustomPresetId,
    customColors,
    customColorPresets,
    templateActions,
    nudgesBySession,
  });
}

function persistCurrentDashboardSettings(get: () => SettingsState) {
  const { templateActions, nudgesBySession } = get();
  persistRemoteDashboardSettings({
    ...defaultSettings,
    templateActions,
    nudgesBySession,
  });
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
  setRequestTimeoutMs: (requestTimeoutMs) => {
    set(withDirtyFlag({ requestTimeoutMs }));
    persistCurrentSettings(get);
  },
  setAiProviderBaseUrl: (aiProviderBaseUrl) => {
    set(withDirtyFlag({ aiProviderBaseUrl: normalizeProviderBaseUrl(aiProviderBaseUrl, get().aiProviderType) }));
    persistCurrentSettings(get);
  },
  setAiProviderType: (aiProviderType) => {
    set((state) => withDirtyFlag({
      aiProviderType,
      aiProviderBaseUrl: normalizeProviderBaseUrl(state.aiProviderBaseUrl, aiProviderType),
    }));
    persistCurrentSettings(get);
  },
  setAiApiKey: (aiApiKey) => {
    set(withDirtyFlag({ aiApiKey }));
    persistCurrentSettings(get);
  },
  setAiSelectedModel: (aiSelectedModel) => {
    set(withDirtyFlag({ aiSelectedModel }));
    persistCurrentSettings(get);
  },
  setAiProviderName: (aiProviderName) => {
    set(withDirtyFlag({ aiProviderName }));
    persistCurrentSettings(get);
  },
  setThemeMode: (themeMode) => {
    set({ themeMode });
    persistCurrentSettings(get);
  },
  setColorTheme: (colorTheme) => {
    set({ colorTheme });
    persistCurrentSettings(get);
  },
  setSelectedCustomPresetId: (selectedCustomPresetId) => {
    set({ selectedCustomPresetId });
    persistCurrentSettings(get);
  },
  setCustomColors: (colors) => {
    set((state) => withDirtyFlag({ customColors: normalizeCustomColors(colors), selectedCustomPresetId: state.selectedCustomPresetId }));
    persistCurrentSettings(get);
  },
  setCustomColor: (key, value) => {
    set((state) => withDirtyFlag({ customColors: { ...state.customColors, [key]: value } }));
    persistCurrentSettings(get);
  },
  saveCurrentColorsAsPreset: (name, colors) => {
    set((state) => {
      const presetColors = normalizeCustomColors(colors ?? state.customColors);
      const preset = makeCustomPreset(name, presetColors, state.customColorPresets);
      return withDirtyFlag({
        colorTheme: CUSTOM_THEME_ID,
        customColors: presetColors,
        selectedCustomPresetId: preset.id,
        customColorPresets: [...state.customColorPresets, preset],
      });
    });
    persistCurrentSettings(get);
  },
  updateCustomPreset: (presetId, colors) => {
    set((state) => withDirtyFlag({
      customColorPresets: state.customColorPresets.map((preset) => preset.id === presetId ? { ...preset, colors: normalizeCustomColors(colors) } : preset),
      customColors: state.selectedCustomPresetId === presetId ? normalizeCustomColors(colors) : state.customColors,
    }));
    persistCurrentSettings(get);
  },
  renameCustomPreset: (presetId, name) => {
    set((state) => withDirtyFlag({ customColorPresets: state.customColorPresets.map((preset) => preset.id === presetId ? { ...preset, name: name.trim() || preset.name } : preset) }));
    persistCurrentSettings(get);
  },
  deleteCustomPreset: (presetId) => {
    set((state) => {
      const customColorPresets = state.customColorPresets.filter((preset) => preset.id !== presetId);
      const fallback = customColorPresets[0] ?? DEFAULT_CUSTOM_PRESET;
      return withDirtyFlag({
        customColorPresets: customColorPresets.length > 0 ? customColorPresets : [{ ...DEFAULT_CUSTOM_PRESET, colors: { ...DEFAULT_CUSTOM_PRESET.colors } }],
        selectedCustomPresetId: state.selectedCustomPresetId === presetId ? fallback.id : state.selectedCustomPresetId,
        customColors: state.selectedCustomPresetId === presetId ? { ...fallback.colors } : state.customColors,
        colorTheme: state.colorTheme === CUSTOM_THEME_ID && state.selectedCustomPresetId === presetId ? CUSTOM_THEME_ID : state.colorTheme,
      });
    });
    persistCurrentSettings(get);
  },
  loadCustomPreset: (presetId) => {
    set((state) => {
      const preset = state.customColorPresets.find((item) => item.id === presetId) ?? state.customColorPresets[0];
      return withDirtyFlag({
        colorTheme: CUSTOM_THEME_ID,
        selectedCustomPresetId: preset.id,
        customColors: { ...preset.colors },
      });
    });
    persistCurrentSettings(get);
  },
  addTemplateAction: (template) => {
    set((state) => {
      const templateActions = [
        ...state.templateActions,
        {
          id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${state.templateActions.length}`,
          ...template,
        },
      ];
      return withDirtyFlag({ templateActions });
    });
    persistCurrentSettings(get);
    persistCurrentDashboardSettings(get);
  },
  updateTemplateAction: (id, template) => {
    set((state) =>
      withDirtyFlag({
        templateActions: state.templateActions.map((action) =>
          action.id === id ? { id, ...template } : action,
        ),
      }),
    );
    persistCurrentSettings(get);
    persistCurrentDashboardSettings(get);
  },
  deleteTemplateAction: (id) => {
    set((state) =>
      withDirtyFlag({
        templateActions: state.templateActions.filter((action) => action.id !== id),
      }),
    );
    persistCurrentSettings(get);
    persistCurrentDashboardSettings(get);
  },
  moveTemplateAction: (id, direction) => {
    set((state) => {
      const currentIndex = state.templateActions.findIndex((action) => action.id === id);
      if (currentIndex < 0) {
        return state;
      }
      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= state.templateActions.length) {
        return state;
      }
      const templateActions = [...state.templateActions];
      const [moved] = templateActions.splice(currentIndex, 1);
      templateActions.splice(nextIndex, 0, moved);
      return withDirtyFlag({ templateActions });
    });
    persistCurrentSettings(get);
    persistCurrentDashboardSettings(get);
  },
  upsertNudgeConfig: (sessionKey, config) => {
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
            customPrompt: config.customPrompt ?? current?.customPrompt ?? DEFAULT_NUDGE_PROMPT,
          },
        },
      });
    });
    persistCurrentSettings(get);
    persistCurrentDashboardSettings(get);
  },
  setNudgeEnabled: (sessionKey, enabled) => {
    set((state) => {
      const current = state.nudgesBySession[sessionKey];
      const nextConfig = current
        ? { ...current, enabled }
        : {
            enabled,
            stableTimeSeconds: 60,
            maxNudges: 3,
            nudgesSent: 0,
            customPrompt: DEFAULT_NUDGE_PROMPT,
          };
      return withDirtyFlag({
        nudgesBySession: {
          ...state.nudgesBySession,
          [sessionKey]: nextConfig,
        },
      });
    });
    persistCurrentSettings(get);
    persistCurrentDashboardSettings(get);
  },
  incrementNudgeCount: (sessionKey) => {
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
    });
    persistCurrentSettings(get);
    persistCurrentDashboardSettings(get);
  },
  clearNudgeConfig: (sessionKey) => {
    set((state) => {
      const next = { ...state.nudgesBySession };
      delete next[sessionKey];
      return withDirtyFlag({ nudgesBySession: next });
    });
    persistCurrentSettings(get);
    persistCurrentDashboardSettings(get);
  },
  hydrateRemoteSettings: async () => {
    try {
      const remote = await apiClient<RemoteDashboardSettings>(DASHBOARD_SETTINGS_PATH);
      if (!remote.exists) {
        persistCurrentDashboardSettings(get);
        return;
      }
      const templateActions = normalizeTemplateActions(remote.templateActions);
      const nudgesBySession = normalizeNudges(remote.nudgesBySession);
      set({ templateActions, nudgesBySession });
      persistCurrentSettings(get);
    } catch {
      // Local settings remain usable when the API is offline.
    }
  },
  save: () => {
    const {
      workerApiUrl,
      refreshIntervalMs,
      staleTimeoutSeconds,
      requestTimeoutMs,
      aiProviderBaseUrl,
      aiProviderType,
      aiApiKey,
      aiSelectedModel,
      aiProviderName,
      themeMode,
      colorTheme,
      selectedCustomPresetId,
      customColors,
      customColorPresets,
      templateActions,
      nudgesBySession,
    } = get();
    persistSettings({
      workerApiUrl,
      refreshIntervalMs,
      staleTimeoutSeconds,
      requestTimeoutMs,
      aiProviderBaseUrl,
      aiProviderType,
      aiApiKey,
      aiSelectedModel,
      aiProviderName,
      themeMode,
      colorTheme,
      selectedCustomPresetId,
      customColors,
      customColorPresets,
      templateActions,
      nudgesBySession,
    });
    persistRemoteDashboardSettings({
      workerApiUrl,
      refreshIntervalMs,
      staleTimeoutSeconds,
      requestTimeoutMs,
      aiProviderBaseUrl,
      aiProviderType,
      aiApiKey,
      aiSelectedModel,
      aiProviderName,
      themeMode,
      colorTheme,
      selectedCustomPresetId,
      customColors,
      customColorPresets,
      templateActions,
      nudgesBySession,
    });
    set({ isDirty: false });
    window.location.reload();
  },
  reset: () => {
    persistSettings(defaultSettings);
    persistRemoteDashboardSettings(defaultSettings);
    set({ ...defaultSettings, isDirty: false });
    window.location.reload();
  },
}));

export function getSessionNudgeKey(machineId: string, sessionId: string) {
  return `${machineId}:${sessionId}`;
}
