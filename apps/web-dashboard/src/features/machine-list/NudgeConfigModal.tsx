import { useEffect } from "react";
import {
  getSessionNudgeKey,
  useSettingsStore,
} from "../../shared/state/settingsStore";
import { Button } from "../../shared/ui/Button";

interface NudgeConfigModalProps {
  machineId: string;
  sessionId: string;
  sessionLabel: string;
  isOpen: boolean;
  stableTimeSeconds: string;
  maxNudges: string;
  validationError: string | null;
  onStableTimeSecondsChange: (value: string) => void;
  onMaxNudgesChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function NudgeConfigModal({
  machineId,
  sessionId,
  sessionLabel,
  isOpen,
  stableTimeSeconds,
  maxNudges,
  validationError,
  onStableTimeSecondsChange,
  onMaxNudgesChange,
  onClose,
  onSave,
}: NudgeConfigModalProps) {
  const sessionKey = getSessionNudgeKey(machineId, sessionId);
  const config = useSettingsStore((s) => s.nudgesBySession[sessionKey]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nudge-modal-title"
    >
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-4">
          <h2 id="nudge-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Nudge {sessionLabel}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure stable time and stop after the configured nudge count. Execution is UI/state-only for now.
          </p>
          {config && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Nudges sent: {config.nudgesSent} / {config.maxNudges}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="stable-time-seconds" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Stable-time threshold (seconds)
            </label>
            <input
              id="stable-time-seconds"
              type="number"
              min={1}
              value={stableTimeSeconds}
              onChange={(event) => onStableTimeSecondsChange(event.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label htmlFor="max-nudges" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Max nudges
            </label>
            <input
              id="max-nudges"
              type="number"
              min={1}
              value={maxNudges}
              onChange={(event) => onMaxNudgesChange(event.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          {validationError && (
            <p role="alert" className="text-sm text-red-600">
              {validationError}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
