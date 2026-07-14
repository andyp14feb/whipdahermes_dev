import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("moves templates and preserves the saved order after normalization", () => {
    useSettingsStore.getState().moveTemplateAction("continue", "up");

    expect(useSettingsStore.getState().templateActions.map((action) => action.id).slice(0, 2)).toEqual([
      "continue",
      "yes",
    ]);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.templateActions.map((action: { id: string }) => action.id).slice(0, 2)).toEqual([
      "continue",
      "yes",
    ]);
  });

  it("toggles nudge config with a default prompt", () => {
    useSettingsStore.getState().setNudgeEnabled("machine-1:A", true);

    expect(useSettingsStore.getState().nudgesBySession["machine-1:A"]).toMatchObject({
      enabled: true,
      customPrompt: DEFAULT_NUDGE_PROMPT,
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").nudgesBySession["machine-1:A"].enabled).toBe(true);
  });

  it("hydrates templates and nudge settings from the API", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          exists: true,
          templateActions: [{ id: "remote", label: "remote", payload: "remote payload" }],
          nudgesBySession: {
            "machine-1:A": {
              enabled: true,
              stableTimeSeconds: 45,
              maxNudges: 4,
              nudgesSent: 1,
              customPrompt: "keep going",
            },
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    ) as typeof fetch;

    try {
      await useSettingsStore.getState().hydrateRemoteSettings();

      expect(useSettingsStore.getState().templateActions.some((action) => action.id === "remote")).toBe(true);
      expect(useSettingsStore.getState().nudgesBySession["machine-1:A"]).toMatchObject({
        enabled: true,
        stableTimeSeconds: 45,
        maxNudges: 4,
        nudgesSent: 1,
        customPrompt: "keep going",
      });
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").nudgesBySession["machine-1:A"].stableTimeSeconds).toBe(45);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("seeds missing API settings from the current browser cache", async () => {
    const putBodies: unknown[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (_input, init) => {
      if (init?.method === "PUT") {
        putBodies.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          exists: false,
          templateActions: [],
          nudgesBySession: {},
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;
    try {
      useSettingsStore.setState({
        templateActions: [
          ...DEFAULT_TEMPLATE_ACTIONS,
          { id: "local", label: "local", payload: "local payload" },
        ],
        nudgesBySession: {
          "machine-1:A": {
            enabled: true,
            stableTimeSeconds: 30,
            maxNudges: 2,
            nudgesSent: 0,
            customPrompt: DEFAULT_NUDGE_PROMPT,
          },
        },
      });

      await useSettingsStore.getState().hydrateRemoteSettings();

      await waitFor(() => expect(putBodies).toHaveLength(1));
      expect(putBodies[0]).toMatchObject({
        templateActions: expect.arrayContaining([
          expect.objectContaining({ label: "local", payload: "local payload" }),
        ]),
        nudgesBySession: {
          "machine-1:A": expect.objectContaining({
            enabled: true,
            stableTimeSeconds: 30,
          }),
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
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
