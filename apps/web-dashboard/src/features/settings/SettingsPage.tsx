import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../../shared/api-client/apiClient";
import { AI_PROVIDER_TYPES, useSettingsStore } from "../../shared/state/settingsStore";
import {
  applyThemeVariables,
  CUSTOM_COLOR_FIELDS,
  getColorTheme,
  type CustomColorTheme,
  themeToCustomColors,
} from "../../shared/state/colorThemes";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { ColorThemePicker } from "./ColorThemePicker";

interface ModelOption {
  id: string;
}

interface ProviderModelsResponse {
  models: ModelOption[];
}

interface SettingsPageProps {
  onClose: () => void;
}

const fieldClass = "mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1";
const labelClass = "block text-sm font-medium";
const helperClass = "mt-1 text-xs";
const colorFieldGroups: Array<"Surface" | "Text" | "Action"> = ["Surface", "Text", "Action"];

export function SettingsPage({ onClose }: SettingsPageProps) {
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
    customColors,
    customColorPresets,
    selectedCustomPresetId,
    templateActions,
    isDirty,
    setWorkerApiUrl,
    setRefreshIntervalMs,
    setStaleTimeoutSeconds,
    setRequestTimeoutMs,
    setAiProviderBaseUrl,
    setAiProviderType,
    setAiApiKey,
    setAiSelectedModel,
    setAiProviderName,
    setThemeMode,
    setColorTheme,
    setCustomColor,
    setCustomColors,
    renameCustomPreset,
    deleteCustomPreset,
    saveCurrentColorsAsPreset,
    loadCustomPreset,
    addTemplateAction,
    updateTemplateAction,
    deleteTemplateAction,
    moveTemplateAction,
    save,
    reset,
  } = useSettingsStore();

  const [copied, setCopied] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [templateLabel, setTemplateLabel] = useState("");
  const [templatePayload, setTemplatePayload] = useState("");
  const [colorThemeConfirmed, setColorThemeConfirmed] = useState(colorTheme);
  const [savedThemeFlash, setSavedThemeFlash] = useState(false);
  const [customPresetName, setCustomPresetName] = useState("");
  const scriptRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const theme = getColorTheme(colorThemeConfirmed);
    const colors: CustomColorTheme = colorThemeConfirmed === "custom" ? customColors : themeToCustomColors(theme);
    document.documentElement.dataset.colorTheme = colorThemeConfirmed;
    applyThemeVariables(colors);
  }, [colorThemeConfirmed, customColors]);

  useEffect(() => {
    const selected = customColorPresets.find((preset) => preset.id === selectedCustomPresetId);
    if (selected) {
      setCustomPresetName(selected.name);
    }
  }, [customColorPresets, selectedCustomPresetId]);

  const workerScript = `#!/usr/bin/env bash
set -euo pipefail

# ── WhipAI Worker Machine Agent ──
# Generated from the dashboard settings at ${workerApiUrl}

REPO_URL="https://github.com/andyp14feb/whipdahermes_dev.git"
WORKDIR="$(pwd)/whipdahermes_dev"
API_URL="${workerApiUrl}"
MACHINE_ID="worker-$(hostname -s)"
INTERVAL=2
COMMAND_POLL_INTERVAL=5

if [ ! -d "$WORKDIR/.git" ]; then
  git clone "$REPO_URL" "$WORKDIR"
else
  if [ -n "$(git -C "$WORKDIR" status --porcelain)" ]; then
    echo "Refusing to update $WORKDIR: local changes would be overwritten. Commit, stash, or clean the worktree first." >&2
    exit 1
  fi
  git -C "$WORKDIR" fetch --prune origin
  git -C "$WORKDIR" checkout main
  git -C "$WORKDIR" pull --ff-only origin main
fi

cd "$WORKDIR/apps/machine-agent"
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

export API_URL
export MACHINE_ID
export INTERVAL
export COMMAND_POLL_INTERVAL

echo "Starting WhipAI machine agent: MACHINE_ID=$MACHINE_ID API_URL=$API_URL"
python3 src/main.py`;

  const copyScript = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(workerScript);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = workerScript;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [workerScript]);

  const fetchModels = useCallback(async () => {
    setIsFetchingModels(true);
    setModelsError(null);
    try {
      const payload = await apiClient<ProviderModelsResponse>(
        "/assess/models",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base_url: aiProviderBaseUrl,
            provider_type: aiProviderType,
            api_key: aiApiKey,
          }),
        },
        requestTimeoutMs,
      );

      setModels(payload.models);
    } catch {
      setModels([]);
      setModelsError("Unable to fetch models. Check the provider URL and API key.");
    } finally {
      setIsFetchingModels(false);
    }
  }, [aiApiKey, aiProviderBaseUrl, aiProviderType, requestTimeoutMs]);

  const handleAddTemplate = () => {
    const label = templateLabel.trim();
    const payload = templatePayload.trim();
    if (!label || !payload) return;
    addTemplateAction({ label, payload });
    setTemplateLabel("");
    setTemplatePayload("");
  };

  const handleThemeModeChange = (nextMode: "dark" | "light") => {
    setThemeMode(nextMode);
    const modeThemeId = nextMode === "dark" ? "dark-mode" : "light-mode";
    setColorThemeConfirmed(modeThemeId);
    setColorTheme(modeThemeId);
    document.documentElement.dataset.colorTheme = modeThemeId;
  };

  const handlePreviewColorTheme = (themeId: string) => {
    setColorThemeConfirmed(themeId);
    document.documentElement.dataset.colorTheme = themeId;
    if (themeId !== "custom") {
      setCustomColors(themeToCustomColors(getColorTheme(themeId)));
    }
    const resolved = themeId === "custom" ? customColors : themeToCustomColors(getColorTheme(themeId));
    applyThemeVariables(resolved);
    if (themeId === "dark-mode") {
      setThemeMode("dark");
      return;
    }
    if (themeId === "light-mode") {
      setThemeMode("light");
    }
  };

  const handleSaveColorTheme = () => {
    setColorTheme(colorThemeConfirmed);
    document.documentElement.dataset.colorTheme = colorThemeConfirmed;
    const resolved = colorThemeConfirmed === "custom"
      ? customColors
      : themeToCustomColors(getColorTheme(colorThemeConfirmed));
    applyThemeVariables(resolved);
    if (colorThemeConfirmed === "dark-mode") {
      setThemeMode("dark");
    } else if (colorThemeConfirmed === "light-mode") {
      setThemeMode("light");
    }
    setSavedThemeFlash(true);
    window.setTimeout(() => setSavedThemeFlash(false), 1500);
  };

  const handleCustomColorChange = (key: keyof CustomColorTheme, value: string) => {
    setCustomColor(key, value);
    setColorThemeConfirmed("custom");
    setColorTheme("custom");
  };

  const handleSavePreset = () => {
    const name = customPresetName.trim();
    if (!name) return;
    const previewColors = colorThemeConfirmed === "custom"
      ? customColors
      : themeToCustomColors(getColorTheme(colorThemeConfirmed));
    useSettingsStore.getState().setCustomColors(previewColors);
    useSettingsStore.getState().saveCurrentColorsAsPreset(name);
  };

  const handleLoadPreset = (presetId: string) => {
    loadCustomPreset(presetId);
    setColorThemeConfirmed("custom");
  };

  const handleDeletePreset = (presetId: string) => {
    deleteCustomPreset(presetId);
  };

  const handleRenamePreset = (presetId: string, name: string) => {
    renameCustomPreset(presetId, name);
  };

  const editorColors: CustomColorTheme = colorThemeConfirmed === "custom"
    ? customColors
    : themeToCustomColors(getColorTheme(colorThemeConfirmed));

  const groupedColorFields = colorFieldGroups.map((group) => ({
    group,
    fields: CUSTOM_COLOR_FIELDS.filter((field) => field.group === group),
  }));

  const themedFieldStyle = {
    borderColor: "var(--theme-border)",
    backgroundColor: "var(--theme-input)",
    color: "var(--theme-text)",
  };

  const themedHelperStyle = { color: "var(--theme-text-muted)" };
  const themedSectionStyle = { borderColor: "var(--theme-border)", backgroundColor: "var(--theme-bg-soft)" };

  return (
    <div className="mx-auto max-w-6xl space-y-6" style={{ color: "var(--theme-text)" }}>
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Button variant="secondary" onClick={onClose}>
          Back to Dashboard
        </Button>
      </header>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Appearance</h2>
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
            <div>
              <label htmlFor="theme-mode" className={labelClass}>
                Theme mode
              </label>
              <select
                id="theme-mode"
                aria-label="Theme mode"
                className={fieldClass}
                style={themedFieldStyle}
                value={themeMode}
                onChange={(e) => handleThemeModeChange(e.target.value === "dark" ? "dark" : "light")}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
              <p className={helperClass} style={themedHelperStyle}>
                Theme changes are saved locally immediately.
              </p>
            </div>

            <div>
              <span className={labelClass}>Color theme</span>
              <p className={helperClass} style={themedHelperStyle}>
                Preview a palette instantly, then save it when you like it.
              </p>
              <div className="mt-3">
                <ColorThemePicker
                  selected={colorThemeConfirmed}
                  onSelect={handlePreviewColorTheme}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={handleSaveColorTheme}
                  disabled={colorThemeConfirmed === colorTheme}
                >
                  Save color theme
                </Button>
                {savedThemeFlash && (
                  <span className="text-xs font-medium" style={{ color: "#059669" }}>
                    Color theme saved.
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4" style={themedSectionStyle}>
            <div className="mb-3 grid gap-3 lg:grid-cols-[220px_220px_1fr_auto_auto] lg:items-end">
              <div>
                <label htmlFor="saved-color-presets" className={labelClass}>
                  Saved presets
                </label>
                <select
                  id="saved-color-presets"
                  aria-label="Saved presets"
                  className={fieldClass}
                  style={themedFieldStyle}
                  value={selectedCustomPresetId}
                  onChange={(e) => handleLoadPreset(e.target.value)}
                >
                  {customColorPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="new-preset-name" className={labelClass}>
                  Preset name
                </label>
                <input
                  id="new-preset-name"
                  aria-label="New preset name"
                  className={fieldClass}
                  style={themedFieldStyle}
                  value={customPresetName}
                  onChange={(e) => setCustomPresetName(e.target.value)}
                  placeholder="My custom theme"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-5">
                {[
                  { key: "bg", label: "Bg" },
                  { key: "card", label: "Card" },
                  { key: "input", label: "Input" },
                  { key: "text", label: "Text" },
                  { key: "primary", label: "Primary" },
                ].map((chip) => (
                  <div key={chip.key} className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--theme-border)" }}>
                    <div className="truncate" style={themedHelperStyle}>{chip.label}</div>
                    <div className="mt-1 h-3 rounded" style={{ backgroundColor: editorColors[chip.key as keyof CustomColorTheme] }} />
                  </div>
                ))}
              </div>
              <Button type="button" onClick={handleSavePreset} disabled={!customPresetName.trim()}>
                Save preset
              </Button>
              <Button type="button" variant="secondary" onClick={() => handleDeletePreset(selectedCustomPresetId)}>
                Delete preset
              </Button>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              {groupedColorFields.map(({ group, fields }) => (
                <div key={group} className="rounded-lg border p-3" style={{ borderColor: "var(--theme-border)", backgroundColor: "var(--theme-card)" }}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={themedHelperStyle}>{group}</div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    {fields.map((field) => (
                      <label key={field.key} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded border px-2 py-1.5 text-sm" style={{ borderColor: "var(--theme-border)" }}>
                        <span className="truncate">{field.label}</span>
                        <div className="flex items-center gap-2">
                          <input
                            aria-label={field.label}
                            type="color"
                            className="h-8 w-10 cursor-pointer rounded border p-0.5"
                            style={{ borderColor: "var(--theme-border)", backgroundColor: "var(--theme-input)" }}
                            value={editorColors[field.key]}
                            onChange={(e) => handleCustomColorChange(field.key, e.target.value)}
                          />
                          <code className="w-16 text-[11px] uppercase" style={themedHelperStyle}>{editorColors[field.key]}</code>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Quick Templates</h2>
        <div className="space-y-3">
          {templateActions.map((template, index) => (
            <div key={template.id} className="grid gap-2 rounded border p-3 md:grid-cols-[auto_1fr_2fr_auto]" style={{ borderColor: "var(--theme-border)" }}>
              <div className="flex flex-wrap items-center gap-1 md:flex-col md:items-stretch">
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                  onClick={() => moveTemplateAction(template.id, "up")}
                  disabled={index === 0}
                >
                  Move up
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                  onClick={() => moveTemplateAction(template.id, "down")}
                  disabled={index === templateActions.length - 1}
                >
                  Move down
                </Button>
              </div>
              <input
                aria-label={`Template label ${template.label}`}
                className={fieldClass}
                style={themedFieldStyle}
                value={template.label}
                onChange={(e) => updateTemplateAction(template.id, { label: e.target.value, payload: template.payload })}
              />
              <input
                aria-label={`Template payload ${template.label}`}
                className={fieldClass}
                style={themedFieldStyle}
                value={template.payload}
                onChange={(e) => updateTemplateAction(template.id, { label: template.label, payload: e.target.value })}
              />
              <Button type="button" variant="secondary" onClick={() => deleteTemplateAction(template.id)}>
                Delete
              </Button>
            </div>
          ))}
          <div className="grid gap-2 rounded border border-dashed p-3 md:grid-cols-[1fr_2fr_auto]" style={{ borderColor: "var(--theme-border)" }}>
            <input
              aria-label="New template label"
              className={fieldClass}
              style={themedFieldStyle}
              value={templateLabel}
              onChange={(e) => setTemplateLabel(e.target.value)}
              placeholder="Label"
            />
            <input
              aria-label="New template payload"
              className={fieldClass}
              style={themedFieldStyle}
              value={templatePayload}
              onChange={(e) => setTemplatePayload(e.target.value)}
              placeholder="Message"
            />
            <Button type="button" onClick={handleAddTemplate} disabled={!templateLabel.trim() || !templatePayload.trim()}>
              Add
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Connection</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="worker-api-url" className={labelClass}>
              Worker API / Server URL
            </label>
            <input
              id="worker-api-url"
              type="text"
              className={fieldClass}
              style={themedFieldStyle}
              value={workerApiUrl}
              onChange={(e) => setWorkerApiUrl(e.target.value)}
              placeholder="http://localhost:8000"
            />
            <p className={helperClass} style={themedHelperStyle}>
              The URL that worker machine agents connect to when reporting heartbeats.
              This does <strong>not</strong> affect dashboard data fetching, which always
              uses the Vite dev proxy. To connect the dashboard directly to a remote
              server, set <code>VITE_API_BASE_URL</code> in your <code>.env</code> and ensure the backend includes your dashboard origin
              in its CORS allowlist.
            </p>
          </div>

          <div>
            <label htmlFor="ai-provider-type" className={labelClass}>
              Provider Type
            </label>
            <select
              id="ai-provider-type"
              className={fieldClass}
              style={themedFieldStyle}
              value={aiProviderType}
              onChange={(e) => setAiProviderType(e.target.value as typeof AI_PROVIDER_TYPES[number])}
            >
              {AI_PROVIDER_TYPES.map((providerType) => (
                <option key={providerType} value={providerType}>
                  {providerType}
                </option>
              ))}
            </select>
            <p className={helperClass} style={themedHelperStyle}>
              Supports OpenAI-compatible, Anthropic-compatible, Gemini-compatible, Ollama-compatible, and 9Router-compatible endpoints.
            </p>
          </div>

          <div>
            <label htmlFor="provider-name" className={labelClass}>
              Provider Name
            </label>
            <input
              id="provider-name"
              type="text"
              className={fieldClass}
              style={themedFieldStyle}
              value={aiProviderName}
              onChange={(e) => setAiProviderName(e.target.value)}
              placeholder="openai-compatible"
            />
          </div>

          <div>
            <label htmlFor="ai-provider-base-url" className={labelClass}>
              Provider Base URL
            </label>
            <input
              id="ai-provider-base-url"
              type="text"
              className={fieldClass}
              style={themedFieldStyle}
              value={aiProviderBaseUrl}
              onChange={(e) => setAiProviderBaseUrl(e.target.value)}
              placeholder="https://provider.example/v1"
            />
          </div>

          <div>
            <label htmlFor="ai-api-key" className={labelClass}>
              API Key
            </label>
            <input
              id="ai-api-key"
              type="password"
              className={fieldClass}
              style={themedFieldStyle}
              value={aiApiKey}
              onChange={(e) => setAiApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>

          <div>
            <label htmlFor="ai-selected-model" className={labelClass}>
              Selected Model
            </label>
            <div className="mt-1 flex gap-3">
              <select
                id="ai-selected-model"
                aria-label="Selected Model"
                className={fieldClass}
                style={themedFieldStyle}
                value={aiSelectedModel}
                onChange={(e) => setAiSelectedModel(e.target.value)}
              >
                <option value="">Select a model</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.id}
                  </option>
                ))}
              </select>
              <input
                aria-label="Manual Model Name"
                className={fieldClass}
                style={themedFieldStyle}
                value={aiSelectedModel}
                onChange={(e) => setAiSelectedModel(e.target.value)}
                placeholder="manual-model-name"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={fetchModels}
                disabled={isFetchingModels || !aiProviderBaseUrl}
              >
                {isFetchingModels ? "Loading..." : "Fetch Models"}
              </Button>
            </div>
            {modelsError && (
              <p role="alert" className="mt-1 text-xs" style={{ color: "#dc2626" }}>
                {modelsError}
              </p>
            )}
            <p className={helperClass} style={themedHelperStyle}>
              If model discovery fails, enter the model name manually and save.
            </p>
          </div>

          <div>
            <label className={labelClass}>Refresh Interval (ms)</label>
            <input
              type="number"
              min={500}
              max={30000}
              className={fieldClass}
              style={themedFieldStyle}
              value={refreshIntervalMs}
              onChange={(e) => setRefreshIntervalMs(Number(e.target.value))}
            />
            <p className={helperClass} style={themedHelperStyle}>
              How often the dashboard polls the API for updates (500–30000ms).
            </p>
          </div>

          <div>
            <label htmlFor="request-timeout-ms" className={labelClass}>Request Timeout (ms)</label>
            <input
              id="request-timeout-ms"
              type="number"
              min={5000}
              max={300000}
              step={5000}
              className={fieldClass}
              style={themedFieldStyle}
              value={requestTimeoutMs}
              onChange={(e) => setRequestTimeoutMs(Number(e.target.value))}
            />
            <p className={helperClass} style={themedHelperStyle}>
              How long the dashboard waits for the AI provider before aborting the request (5000–300000ms). Increase for slow models or high latency.
            </p>
          </div>

          <div>
            <label className={labelClass}>Stale Timeout (seconds)</label>
            <input
              type="number"
              min={10}
              max={86400}
              className={fieldClass}
              style={themedFieldStyle}
              value={staleTimeoutSeconds}
              onChange={(e) => setStaleTimeoutSeconds(Number(e.target.value))}
            />
            <p className={helperClass} style={themedHelperStyle}>
              Machines without a heartbeat within this period are marked stale.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Worker Machine Script</h2>
        <p className="mb-3 text-sm" style={themedHelperStyle}>
          Copy and run this script on a worker machine that has git and tmux installed.
          It clones (or pulls) the repo from GitHub, sets up the Python environment,
          installs dependencies, and starts the machine agent connecting back to{" "}
          <code className="rounded px-1 py-0.5 text-xs" style={{ backgroundColor: "var(--theme-bg-soft)" }}>
            {workerApiUrl}
          </code>{" "}
          with a unique machine ID. Adjust the <code>cd</code> path to match
          where you deploy the repo on the worker.
        </p>
        <pre
          ref={scriptRef}
          className="max-h-80 overflow-auto rounded border p-4 font-mono text-xs"
          style={{ borderColor: "var(--theme-border)", backgroundColor: "var(--theme-input)", color: "var(--theme-text)" }}
        >
          {workerScript}
        </pre>
        <div className="mt-3">
          <Button variant="secondary" onClick={copyScript}>
            {copied ? "Copied!" : "Copy Script"}
          </Button>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3 pb-8">
        <Button onClick={save} disabled={!isDirty}>
          Save &amp; Reload
        </Button>
        <Button variant="secondary" onClick={reset}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
