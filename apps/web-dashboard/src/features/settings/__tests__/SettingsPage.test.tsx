import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../SettingsPage";
import {
  DEFAULT_TEMPLATE_ACTIONS,
  STORAGE_KEY,
  useSettingsStore,
} from "../../../shared/state/settingsStore";
import { DEFAULT_COLOR_THEME, DEFAULT_CUSTOM_PRESET } from "../../../shared/state/colorThemes";
import { server } from "../../../__tests__/setup";

describe("SettingsPage", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    useSettingsStore.setState({
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
      isDirty: false,
      setWorkerApiUrl: useSettingsStore.getState().setWorkerApiUrl,
      setRefreshIntervalMs: useSettingsStore.getState().setRefreshIntervalMs,
      setStaleTimeoutSeconds: useSettingsStore.getState().setStaleTimeoutSeconds,
      setRequestTimeoutMs: useSettingsStore.getState().setRequestTimeoutMs,
      setAiProviderBaseUrl: useSettingsStore.getState().setAiProviderBaseUrl,
      setAiApiKey: useSettingsStore.getState().setAiApiKey,
      setAiSelectedModel: useSettingsStore.getState().setAiSelectedModel,
      setAiProviderName: useSettingsStore.getState().setAiProviderName,
      setThemeMode: useSettingsStore.getState().setThemeMode,
      setColorTheme: useSettingsStore.getState().setColorTheme,
      setSelectedCustomPresetId: useSettingsStore.getState().setSelectedCustomPresetId,
      setCustomColors: useSettingsStore.getState().setCustomColors,
      setCustomColor: useSettingsStore.getState().setCustomColor,
      saveCurrentColorsAsPreset: useSettingsStore.getState().saveCurrentColorsAsPreset,
      updateCustomPreset: useSettingsStore.getState().updateCustomPreset,
      renameCustomPreset: useSettingsStore.getState().renameCustomPreset,
      deleteCustomPreset: useSettingsStore.getState().deleteCustomPreset,
      loadCustomPreset: useSettingsStore.getState().loadCustomPreset,
      addTemplateAction: useSettingsStore.getState().addTemplateAction,
      updateTemplateAction: useSettingsStore.getState().updateTemplateAction,
      deleteTemplateAction: useSettingsStore.getState().deleteTemplateAction,
      moveTemplateAction: useSettingsStore.getState().moveTemplateAction,
      upsertNudgeConfig: useSettingsStore.getState().upsertNudgeConfig,
      setNudgeEnabled: useSettingsStore.getState().setNudgeEnabled,
      incrementNudgeCount: useSettingsStore.getState().incrementNudgeCount,
      clearNudgeConfig: useSettingsStore.getState().clearNudgeConfig,
      save: useSettingsStore.getState().save,
      reset: useSettingsStore.getState().reset,
    });
  });

  it("renders settings and copies the worker script", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    render(<SettingsPage onClose={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Copy Script" }));

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('WORKDIR="$(pwd)/whipdahermes_dev"'),
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('API_URL="http://localhost:8000"'),
    );
    expect(screen.getByText("Copied!")).toBeInTheDocument();
  });

  it("updates the worker script when the worker API URL changes", async () => {
    const user = userEvent.setup();
    render(<SettingsPage onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText("Worker API / Server URL"), {
      target: { value: "http://192.168.18.68:8000" },
    });

    expect(screen.getAllByText(/http:\/\/192\.168\.18\.68:8000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/git clone/)).toBeInTheDocument();
    expect(screen.getByText(/git -C .* fetch --prune origin/)).toBeInTheDocument();
    expect(screen.getByText(/Refusing to update .* local changes would be overwritten/)).toBeInTheDocument();
    expect(screen.getByText(/git -C .* pull --ff-only origin main/)).toBeInTheDocument();
    expect(screen.getByText(/WORKDIR="\$\(pwd\)\/whipdahermes_dev"/)).toBeInTheDocument();
    expect(screen.getByText(/API_URL="http:\/\/192\.168\.18\.68:8000"/)).toBeInTheDocument();
  });

  it("fetches and selects AI models from provider settings", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/assess/models", async ({ request }) => {
        const body = await request.json() as { base_url: string; provider_type: string; api_key: string };
        expect(body).toEqual({
          base_url: "https://provider.example",
          provider_type: "openai-compatible",
          api_key: "test-key",
        });
        return HttpResponse.json({ models: [{ id: "model-a" }, { id: "model-b" }] });
      }),
    );
    render(<SettingsPage onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText("Provider Name"), {
      target: { value: "openai-compatible" },
    });
    fireEvent.change(screen.getByLabelText("Provider Base URL"), {
      target: { value: "https://provider.example/v1" },
    });
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "test-key" },
    });
    await user.click(screen.getByRole("button", { name: "Fetch Models" }));
    await user.selectOptions(await screen.findByLabelText("Selected Model"), "model-b");

    await waitFor(() => {
      expect(useSettingsStore.getState().aiProviderBaseUrl).toBe("https://provider.example");
      expect(useSettingsStore.getState().aiProviderName).toBe("openai-compatible");
      expect(useSettingsStore.getState().aiSelectedModel).toBe("model-b");
    });
  });

  it("supports template CRUD", async () => {
    const user = userEvent.setup();
    render(<SettingsPage onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText("New template label"), {
      target: { value: "nudge" },
    });
    fireEvent.change(screen.getByLabelText("New template payload"), {
      target: { value: "please continue" },
    });
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(useSettingsStore.getState().templateActions.some((action) => action.label === "nudge" && action.payload === "please continue")).toBe(true);
    });

    const labelInput = await screen.findByDisplayValue("nudge");
    const payloadInput = await screen.findByDisplayValue("please continue");
    fireEvent.change(labelInput, { target: { value: "resume" } });
    fireEvent.change(payloadInput, { target: { value: "resume work" } });

    expect(useSettingsStore.getState().templateActions.some((action) => action.label === "resume" && action.payload === "resume work")).toBe(true);

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    await user.click(deleteButtons.at(-1)!);

    expect(useSettingsStore.getState().templateActions.some((action) => action.label === "resume")).toBe(false);
  });

  it("persists theme locally", async () => {
    const user = userEvent.setup();
    render(<SettingsPage onClose={() => undefined} />);

    await user.selectOptions(screen.getByLabelText("Theme mode"), "dark");

    expect(useSettingsStore.getState().themeMode).toBe("dark");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").themeMode).toBe("dark");
  });

  it("persists request timeout locally and exposes it in settings", () => {
    render(<SettingsPage onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText("Request Timeout (ms)"), {
      target: { value: "90000" },
    });

    expect(useSettingsStore.getState().requestTimeoutMs).toBe(90000);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").requestTimeoutMs).toBe(90000);
  });

  it("persists custom templates to local storage immediately", async () => {
    const user = userEvent.setup();
    render(<SettingsPage onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText("New template label"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("New template payload"), { target: { value: "do the thing" } });
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      expect(stored.templateActions.some((action: { label: string; payload: string }) => action.label === "custom" && action.payload === "do the thing")).toBe(true);
      expect(stored.templateActions.some((action: { id: string }) => action.id === "yes")).toBe(true);
    });
  });

  it("shows manual arrange controls for quick templates and reorders them", async () => {
    const user = userEvent.setup();
    render(<SettingsPage onClose={() => undefined} />);

    const moveUpButtons = screen.getAllByRole("button", { name: "Move up" });
    const moveDownButtons = screen.getAllByRole("button", { name: "Move down" });

    expect(moveUpButtons[0]).toBeDisabled();
    expect(moveDownButtons.at(-1)).toBeDisabled();

    await user.click(moveUpButtons[1]);

    expect(useSettingsStore.getState().templateActions.map((action) => action.id).slice(0, 2)).toEqual([
      "continue",
      "yes",
    ]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").templateActions.map((action: { id: string }) => action.id).slice(0, 2)).toEqual([
      "continue",
      "yes",
    ]);
  });

  it("explains that dashboard fetches use the Vite proxy, not the worker URL", () => {
    render(<SettingsPage onClose={() => undefined} />);

    expect(screen.getByText(/dashboard data fetching/i)).toBeInTheDocument();
    expect(screen.getByText(/VITE_API_BASE_URL/i)).toBeInTheDocument();
  });

  it("renders the color theme as a dropdown listbox with Light mode and Dark mode as entries 1-2", () => {
    render(<SettingsPage onClose={() => undefined} />);

    const select = screen.getByLabelText("Color theme") as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    const options = Array.from(select.options).map((opt) => opt.textContent);
    expect(options[0]).toBe("Light mode");
    expect(options[1]).toBe("Dark mode");
    expect(options).toContain("Ocean Blue");
    expect(select.value).toBe(DEFAULT_COLOR_THEME);
  });

  it("previews a color theme immediately and applies it after Save", async () => {
    const user = userEvent.setup();
    render(<SettingsPage onClose={() => undefined} />);

    const select = screen.getByLabelText("Color theme") as HTMLSelectElement;
    await user.selectOptions(select, "royal-violet");

    const root = document.documentElement;
    expect(root.style.getPropertyValue("--theme-primary")).toBe("#6d28d9");
    expect(select.value).toBe("royal-violet");

    await user.click(screen.getByRole("button", { name: "Save color theme" }));

    await waitFor(() => {
      expect(useSettingsStore.getState().colorTheme).toBe("royal-violet");
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").colorTheme).toBe("royal-violet");
  });

  it("falls back to the default theme when persisted value is unknown", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ colorTheme: "not-a-real-theme" }),
    );
    render(<SettingsPage onClose={() => undefined} />);

    const select = screen.getByLabelText("Color theme") as HTMLSelectElement;
    expect(select.value).toBe(DEFAULT_COLOR_THEME);
  });

  it("lets the user edit a custom color field and apply it app-wide", () => {
    render(<SettingsPage onClose={() => undefined} />);

    const bgField = screen.getByLabelText("App background") as HTMLInputElement;
    fireEvent.change(bgField, { target: { value: "#222222" } });

    expect(useSettingsStore.getState().customColors.bg).toBe("#222222");
    expect(document.documentElement.style.getPropertyValue("--theme-bg")).toBe("#222222");
  });

  it("saves the current custom colors as a reusable preset and applies it", async () => {
    const user = userEvent.setup();
    render(<SettingsPage onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText("App background"), { target: { value: "#abcdef" } });

    fireEvent.change(screen.getByLabelText("New preset name"), { target: { value: "Sunset" } });
    await user.click(screen.getByRole("button", { name: "Save preset" }));

    await waitFor(() => {
      const presets = useSettingsStore.getState().customColorPresets;
      expect(presets.some((preset) => preset.name === "Sunset")).toBe(true);
    });
    expect(useSettingsStore.getState().colorTheme).toBe("custom");
    expect(useSettingsStore.getState().customColors.bg).toBe("#abcdef");
  });

  it("bases a new custom preset on the currently previewed built-in theme", async () => {
    const user = userEvent.setup();
    render(<SettingsPage onClose={() => undefined} />);

    await user.selectOptions(screen.getByLabelText("Color theme"), "royal-violet");
    expect((screen.getByLabelText("App background") as HTMLInputElement).value.toLowerCase()).toBe("#f3eaff");

    fireEvent.change(screen.getByLabelText("New preset name"), { target: { value: "Violet Base" } });
    await user.click(screen.getByRole("button", { name: "Save preset" }));

    await waitFor(() => {
      const preset = useSettingsStore.getState().customColorPresets.find((item) => item.name === "Violet Base");
      expect(preset?.colors.primary).toBe("#6d28d9");
      expect(preset?.colors.bg).toBe("#f3eaff");
    });
  });

  it("deletes a saved custom preset from the settings UI", async () => {
    const user = userEvent.setup();
    useSettingsStore.getState().saveCurrentColorsAsPreset("Doomed");

    render(<SettingsPage onClose={() => undefined} />);
    const presetSelect = screen.getByLabelText("Saved presets") as HTMLSelectElement;
    expect(Array.from(presetSelect.options).some((opt) => opt.textContent === "Doomed")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Delete preset" }));

    await waitFor(() => {
      const presets = useSettingsStore.getState().customColorPresets;
      expect(presets.some((preset) => preset.name === "Doomed")).toBe(false);
    });
  });

  it("loads a saved custom preset back into the editor", async () => {
    const user = userEvent.setup();
    useSettingsStore.getState().saveCurrentColorsAsPreset("First");

    render(<SettingsPage onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText("App background"), { target: { value: "#111111" } });
    const presetSelect = screen.getByLabelText("Saved presets") as HTMLSelectElement;
    const firstOption = Array.from(presetSelect.options).find((opt) => opt.textContent === "First");
    expect(firstOption).toBeDefined();
    await user.selectOptions(presetSelect, firstOption!.value);

    await waitFor(() => {
      expect(useSettingsStore.getState().selectedCustomPresetId).toBe(firstOption!.value);
    });
  });
});
