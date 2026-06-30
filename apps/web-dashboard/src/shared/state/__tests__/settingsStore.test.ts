import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_NUDGE_PROMPT,
  DEFAULT_TEMPLATE_ACTIONS,
  STORAGE_KEY,
  useSettingsStore,
} from "../settingsStore";

describe("settingsStore", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    useSettingsStore.setState({
      themeMode: "light",
      templateActions: DEFAULT_TEMPLATE_ACTIONS,
      nudgesBySession: {},
      isDirty: false,
    });
  });

  it("supports template create, read, update, and delete", () => {
    useSettingsStore.getState().addTemplateAction({ label: "status", payload: "status please" });
    const added = useSettingsStore.getState().templateActions.at(-1)!;

    expect(added.label).toBe("status");
    expect(added.payload).toBe("status please");

    useSettingsStore.getState().updateTemplateAction(added.id, { label: "progress", payload: "show progress" });
    expect(useSettingsStore.getState().templateActions.find((action) => action.id === added.id)).toMatchObject({
      label: "progress",
      payload: "show progress",
    });

    useSettingsStore.getState().deleteTemplateAction(added.id);
    expect(useSettingsStore.getState().templateActions.some((action) => action.id === added.id)).toBe(false);
  });

  it("persists theme locally", () => {
    useSettingsStore.getState().setThemeMode("dark");

    expect(useSettingsStore.getState().themeMode).toBe("dark");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").themeMode).toBe("dark");
  });

  it("persists templates immediately while preserving default templates", () => {
    useSettingsStore.getState().addTemplateAction({ label: "status", payload: "status please" });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.templateActions.some((action: { id: string }) => action.id === "yes")).toBe(true);
    expect(stored.templateActions.some((action: { label: string }) => action.label === "status")).toBe(true);
  });

  it("toggles nudge config with a default prompt", () => {
    useSettingsStore.getState().setNudgeEnabled("machine-1:A", true);

    expect(useSettingsStore.getState().nudgesBySession["machine-1:A"]).toMatchObject({
      enabled: true,
      customPrompt: DEFAULT_NUDGE_PROMPT,
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").nudgesBySession["machine-1:A"].enabled).toBe(true);
  });

  it("normalizes and persists OpenAI-compatible provider URLs without duplicate v1", () => {
    useSettingsStore.getState().setAiProviderBaseUrl("https://provider.example/v1/");
    useSettingsStore.getState().setAiApiKey("test-key");
    useSettingsStore.getState().setAiSelectedModel("model-a");

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.aiProviderBaseUrl).toBe("https://provider.example");
    expect(stored.aiApiKey).toBe("test-key");
    expect(stored.aiSelectedModel).toBe("model-a");
  });

  it("stops nudging after configured count", () => {
    useSettingsStore.getState().upsertNudgeConfig("machine-1:A", {
      enabled: true,
      stableTimeSeconds: 30,
      maxNudges: 2,
    });

    useSettingsStore.getState().incrementNudgeCount("machine-1:A");
    expect(useSettingsStore.getState().nudgesBySession["machine-1:A"]).toMatchObject({
      enabled: true,
      nudgesSent: 1,
    });

    useSettingsStore.getState().incrementNudgeCount("machine-1:A");
    expect(useSettingsStore.getState().nudgesBySession["machine-1:A"]).toMatchObject({
      enabled: false,
      nudgesSent: 2,
    });
  });
});
