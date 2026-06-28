import { beforeEach, describe, expect, it } from "vitest";
import {
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
