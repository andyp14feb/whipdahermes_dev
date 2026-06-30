import { useCallback, useRef, useState } from "react";
import { apiClient } from "../../shared/api-client/apiClient";
import { AI_PROVIDER_TYPES, useSettingsStore } from "../../shared/state/settingsStore";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";

interface ModelOption {
  id: string;
}

interface ProviderModelsResponse {
  models: ModelOption[];
}

interface SettingsPageProps {
  onClose: () => void;
}

const fieldClass = "mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";
const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-200";

export function SettingsPage({ onClose }: SettingsPageProps) {
  const {
    workerApiUrl,
    refreshIntervalMs,
    staleTimeoutSeconds,
    aiProviderBaseUrl,
    aiProviderType,
    aiApiKey,
    aiSelectedModel,
    aiProviderName,
    themeMode,
    templateActions,
    isDirty,
    setWorkerApiUrl,
    setRefreshIntervalMs,
    setStaleTimeoutSeconds,
    setAiProviderBaseUrl,
    setAiProviderType,
    setAiApiKey,
    setAiSelectedModel,
    setAiProviderName,
    setThemeMode,
    addTemplateAction,
    updateTemplateAction,
    deleteTemplateAction,
    save,
    reset,
  } = useSettingsStore();

  const [copied, setCopied] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [templateLabel, setTemplateLabel] = useState("");
  const [templatePayload, setTemplatePayload] = useState("");
  const scriptRef = useRef<HTMLPreElement>(null);

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
      const payload = await apiClient<ProviderModelsResponse>("/assess/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_url: aiProviderBaseUrl,
          provider_type: aiProviderType,
          api_key: aiApiKey,
        }),
      });
      setModels(payload.models);
    } catch {
      setModels([]);
      setModelsError("Unable to fetch models. Check the provider URL and API key.");
    } finally {
      setIsFetchingModels(false);
    }
  }, [aiApiKey, aiProviderBaseUrl, aiProviderType]);

  const handleAddTemplate = () => {
    const label = templateLabel.trim();
    const payload = templatePayload.trim();
    if (!label || !payload) return;
    addTemplateAction({ label, payload });
    setTemplateLabel("");
    setTemplatePayload("");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <Button variant="secondary" onClick={onClose}>
          Back to Dashboard
        </Button>
      </header>

      <Card className="p-6 dark:border-gray-800 dark:bg-gray-950">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Appearance
        </h2>
        <div>
          <label htmlFor="theme-mode" className={labelClass}>
            Theme
          </label>
          <select
            id="theme-mode"
            className={fieldClass}
            value={themeMode}
            onChange={(e) => setThemeMode(e.target.value === "dark" ? "dark" : "light")}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Theme changes are saved locally immediately.
          </p>
        </div>
      </Card>

      <Card className="p-6 dark:border-gray-800 dark:bg-gray-950">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Quick Templates
        </h2>
        <div className="space-y-3">
          {templateActions.map((template) => (
            <div key={template.id} className="grid gap-2 rounded border border-gray-200 p-3 dark:border-gray-800 md:grid-cols-[1fr_2fr_auto]">
              <input
                aria-label={`Template label ${template.label}`}
                className={fieldClass}
                value={template.label}
                onChange={(e) => updateTemplateAction(template.id, { label: e.target.value, payload: template.payload })}
              />
              <input
                aria-label={`Template payload ${template.label}`}
                className={fieldClass}
                value={template.payload}
                onChange={(e) => updateTemplateAction(template.id, { label: template.label, payload: e.target.value })}
              />
              <Button type="button" variant="secondary" onClick={() => deleteTemplateAction(template.id)}>
                Delete
              </Button>
            </div>
          ))}
          <div className="grid gap-2 rounded border border-dashed border-gray-300 p-3 dark:border-gray-700 md:grid-cols-[1fr_2fr_auto]">
            <input
              aria-label="New template label"
              className={fieldClass}
              value={templateLabel}
              onChange={(e) => setTemplateLabel(e.target.value)}
              placeholder="Label"
            />
            <input
              aria-label="New template payload"
              className={fieldClass}
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

      <Card className="p-6 dark:border-gray-800 dark:bg-gray-950">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Connection
        </h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="worker-api-url" className={labelClass}>
              Worker API / Server URL
            </label>
            <input
              id="worker-api-url"
              type="text"
              className={fieldClass}
              value={workerApiUrl}
              onChange={(e) => setWorkerApiUrl(e.target.value)}
              placeholder="http://localhost:8000"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
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
              value={aiProviderType}
              onChange={(e) => setAiProviderType(e.target.value as (typeof AI_PROVIDER_TYPES)[number])}
            >
              {AI_PROVIDER_TYPES.map((providerType) => (
                <option key={providerType} value={providerType}>
                  {providerType}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ai-provider-name" className={labelClass}>
              Provider Name
            </label>
            <input
              id="ai-provider-name"
              type="text"
              className={fieldClass}
              value={aiProviderName}
              onChange={(e) => setAiProviderName(e.target.value)}
              placeholder="openai"
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
              value={aiProviderBaseUrl}
              onChange={(e) => setAiProviderBaseUrl(e.target.value)}
              placeholder="https://api.openai.com"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Supports OpenAI-compatible, Anthropic-compatible, Gemini-compatible, Ollama-compatible, and 9Router-compatible endpoints.
            </p>
          </div>

          <div>
            <label htmlFor="ai-api-key" className={labelClass}>
              API Key
            </label>
            <input
              id="ai-api-key"
              type="password"
              className={fieldClass}
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
                className={fieldClass}
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
              <p role="alert" className="mt-1 text-xs text-red-600">
                {modelsError}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
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
              value={refreshIntervalMs}
              onChange={(e) => setRefreshIntervalMs(Number(e.target.value))}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              How often the dashboard polls the API for updates (500–30000ms).
            </p>
          </div>

          <div>
            <label className={labelClass}>Stale Timeout (seconds)</label>
            <input
              type="number"
              min={10}
              max={86400}
              className={fieldClass}
              value={staleTimeoutSeconds}
              onChange={(e) => setStaleTimeoutSeconds(Number(e.target.value))}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Machines without a heartbeat within this period are marked stale.
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button onClick={save} disabled={!isDirty}>
            Save &amp; Reload
          </Button>
          <Button variant="secondary" onClick={reset}>
            Reset to Defaults
          </Button>
        </div>
      </Card>

      <Card className="p-6 dark:border-gray-800 dark:bg-gray-950">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Worker Machine Script
        </h2>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          Copy and run this script on a worker machine that has git and tmux installed.
          It clones (or pulls) the repo from GitHub, sets up the Python environment,
          installs dependencies, and starts the machine agent connecting back to{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-900">
            {workerApiUrl}
          </code>{" "}
          with a unique machine ID. Adjust the <code>cd</code> path to match
          where you deploy the repo on the worker.
        </p>

        <pre
          ref={scriptRef}
          className="max-h-80 overflow-auto rounded border border-gray-200 bg-gray-50 p-4 font-mono text-xs text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
        >
          {workerScript}
        </pre>

        <div className="mt-3">
          <Button variant="secondary" onClick={copyScript}>
            {copied ? "Copied!" : "Copy Script"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
