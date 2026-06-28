import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../SettingsPage";
import { useSettingsStore } from "../../../shared/state/settingsStore";
import { server } from "../../../__tests__/setup";

describe("SettingsPage", () => {
  beforeEach(() => {
    localStorage.removeItem("whipai-settings");
    useSettingsStore.setState({
      workerApiUrl: "http://localhost:8000",
      refreshIntervalMs: 2000,
      staleTimeoutSeconds: 60,
      aiProviderBaseUrl: "",
      aiApiKey: "",
       aiSelectedModel: "",
       aiProviderName: "",

      isDirty: false,
      setWorkerApiUrl: useSettingsStore.getState().setWorkerApiUrl,
      setRefreshIntervalMs: useSettingsStore.getState().setRefreshIntervalMs,
      setStaleTimeoutSeconds: useSettingsStore.getState().setStaleTimeoutSeconds,
      setAiProviderBaseUrl: useSettingsStore.getState().setAiProviderBaseUrl,
      setAiApiKey: useSettingsStore.getState().setAiApiKey,
       setAiSelectedModel: useSettingsStore.getState().setAiSelectedModel,
       setAiProviderName: useSettingsStore.getState().setAiProviderName,

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

    await user.clear(screen.getByLabelText("Worker API / Server URL"));
    await user.type(screen.getByLabelText("Worker API / Server URL"), "http://192.168.18.68:8000");

    expect(screen.getAllByText(/http:\/\/192\.168\.18\.68:8000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/git clone/)).toBeInTheDocument();
    expect(screen.getByText(/WORKDIR="\$\(pwd\)\/whipdahermes_dev"/)).toBeInTheDocument();
    expect(screen.getByText(/API_URL="http:\/\/192\.168\.18\.68:8000"/)).toBeInTheDocument();
  });

  it("fetches and selects AI models from provider settings", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("https://provider.example/v1/models", () =>
        HttpResponse.json({ data: [{ id: "model-a" }, { id: "model-b" }] }),
      ),
    );
    render(<SettingsPage onClose={() => undefined} />);

    await user.type(screen.getByLabelText("Provider Name"), "openai-compatible");
    await user.type(screen.getByLabelText("Provider Base URL"), "https://provider.example");
    await user.type(screen.getByLabelText("API Key"), "test-key");
    await user.click(screen.getByRole("button", { name: "Fetch Models" }));
    await user.selectOptions(await screen.findByLabelText("Selected Model"), "model-b");

    await waitFor(() => {
      expect(useSettingsStore.getState().aiProviderName).toBe("openai-compatible");
      expect(useSettingsStore.getState().aiSelectedModel).toBe("model-b");
    });
  });

  it("explains that dashboard fetches use the Vite proxy, not the worker URL", () => {
    render(<SettingsPage onClose={() => undefined} />);

    expect(screen.getByText(/dashboard data fetching/i)).toBeInTheDocument();
    expect(screen.getByText(/VITE_API_BASE_URL/i)).toBeInTheDocument();
  });
});
