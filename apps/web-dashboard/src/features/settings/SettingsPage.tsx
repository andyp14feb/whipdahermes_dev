import { useCallback, useRef, useState } from "react";
import { useSettingsStore } from "../../shared/state/settingsStore";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";

interface SettingsPageProps {
  onClose: () => void;
}

export function SettingsPage({ onClose }: SettingsPageProps) {
  const {
    workerApiUrl,
    refreshIntervalMs,
    staleTimeoutSeconds,
    isDirty,
    setWorkerApiUrl,
    setRefreshIntervalMs,
    setStaleTimeoutSeconds,
    save,
    reset,
  } = useSettingsStore();

  const [copied, setCopied] = useState(false);
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
  git -C "$WORKDIR" pull --ff-only
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <Button variant="secondary" onClick={onClose}>
          Back to Dashboard
        </Button>
      </header>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Connection
        </h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="worker-api-url" className="block text-sm font-medium text-gray-700">
              Worker API / Server URL
            </label>
            <input
              id="worker-api-url"
              type="text"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={workerApiUrl}
              onChange={(e) => setWorkerApiUrl(e.target.value)}
              placeholder="http://localhost:8000"
            />
            <p className="mt-1 text-xs text-gray-500">
              The URL that worker machine agents connect to when reporting heartbeats.
              This does <strong>not</strong> affect dashboard data fetching, which always
              uses the Vite dev proxy. To connect the dashboard directly to a remote
              server, set <code>VITE_API_BASE_URL</code> in your{" "}
              <code>.env</code> and ensure the backend includes your dashboard origin
              in its CORS allowlist.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Refresh Interval (ms)
            </label>
            <input
              type="number"
              min={500}
              max={30000}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={refreshIntervalMs}
              onChange={(e) => setRefreshIntervalMs(Number(e.target.value))}
            />
            <p className="mt-1 text-xs text-gray-500">
              How often the dashboard polls the API for updates (500–30000ms).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Stale Timeout (seconds)
            </label>
            <input
              type="number"
              min={10}
              max={86400}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={staleTimeoutSeconds}
              onChange={(e) => setStaleTimeoutSeconds(Number(e.target.value))}
            />
            <p className="mt-1 text-xs text-gray-500">
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

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Worker Machine Script
        </h2>
        <p className="mb-3 text-sm text-gray-600">
          Copy and run this script on a worker machine that has git and tmux installed.
          It clones (or pulls) the repo from GitHub, sets up the Python environment,
          installs dependencies, and starts the machine agent connecting back to{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
            {workerApiUrl}
          </code>{" "}
          with a unique machine ID. Adjust the <code>cd</code> path to match
          where you deploy the repo on the worker.
        </p>

        <pre
          ref={scriptRef}
          className="max-h-80 overflow-auto rounded border border-gray-200 bg-gray-50 p-4 font-mono text-xs text-gray-800"
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
