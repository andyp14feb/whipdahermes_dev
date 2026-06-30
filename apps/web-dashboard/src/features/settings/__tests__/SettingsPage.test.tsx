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
import { server } from "../../../__tests__/setup";

describe("SettingsPage", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    useSettingsStore.setState({
      workerApiUrl: "http://localhost:8000",
      refreshIntervalMs: 2000,
      staleTimeoutSeconds: 60,
      aiProviderBaseUrl: "",
      aiProviderType: "openai-compatible",
      aiApiKey: "",
      aiSelectedModel: "",
      aiProviderName: "",
      themeMode: "light",
      templateActions: DEFAULT_TEMPLATE_ACTIONS,
      nudgesBySession: {},
      isDirty: false,
      setWorkerApiUrl: useSettingsStore.getState().setWorkerApiUrl,
      setRefreshIntervalMs: useSettingsStore.getState().setRefreshIntervalMs,
      setStaleTimeoutSeconds: useSettingsStore.getState().setStaleTimeoutSeconds,
      setAiProviderBaseUrl: useSettingsStore.getState().setAiProviderBaseUrl,
      setAiApiKey: useSettingsStore.getState().setAiApiKey,
      setAiSelectedModel: useSettingsStore.getState().setAiSelectedModel,
      setAiProviderName: useSettingsStore.getState().setAiProviderName,
      setThemeMode: useSettingsStore.getState().setThemeMode,
      addTemplateAction: useSettingsStore.getState().addTemplateAction,
      updateTemplateAction: useSettingsStore.getState().updateTemplateAction,
      deleteTemplateAction: useSettingsStore.getState().deleteTemplateAction,
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

    await user.selectOptions(screen.getByLabelText("Theme"), "dark");

    expect(useSettingsStore.getState().themeMode).toBe("dark");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").themeMode).toBe("dark");
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

  it("explains that dashboard fetches use the Vite proxy, not the worker URL", () => {
    render(<SettingsPage onClose={() => undefined} />);

    expect(screen.getByText(/dashboard data fetching/i)).toBeInTheDocument();
    expect(screen.getByText(/VITE_API_BASE_URL/i)).toBeInTheDocument();
  });
});
