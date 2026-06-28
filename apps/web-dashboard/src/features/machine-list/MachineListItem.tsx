import { useState } from "react";
import { StatusSummary } from "../status-summary/StatusSummary";
import type { SessionListItem } from "../../shared/types/contracts";
import { useAppStore } from "../../shared/state/appStore";
import { useSettingsStore } from "../../shared/state/settingsStore";
import { Button } from "../../shared/ui/Button";
import { NudgeConfigModal } from "./NudgeConfigModal";

interface MachineListItemProps {
  machineId: string;
  session: SessionListItem;
}

export function MachineListItem({ machineId, session }: MachineListItemProps) {
  const { selectedMachineId, selectedSessionId, setSelectedSession } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const sessionKey = `${machineId}:${session.session_id}`;
  const nudgeConfig = useSettingsStore((s) => s.nudgesBySession[sessionKey]);
  const [stableTimeSeconds, setStableTimeSeconds] = useState(
    String(nudgeConfig?.stableTimeSeconds ?? 60),
  );
  const [maxNudges, setMaxNudges] = useState(String(nudgeConfig?.maxNudges ?? 3));
  const upsertNudgeConfig = useSettingsStore((s) => s.upsertNudgeConfig);
  const incrementNudgeCount = useSettingsStore((s) => s.incrementNudgeCount);
  const isSelected =
    selectedMachineId === machineId && selectedSessionId === session.session_id;

  const handleSave = () => {
    const stable = Number(stableTimeSeconds);
    const max = Number(maxNudges);
    if (!Number.isInteger(stable) || stable < 1 || !Number.isInteger(max) || max < 1) {
      setValidationError("Stable time and max nudges must be positive integers.");
      return;
    }
    upsertNudgeConfig(sessionKey, { enabled: true, stableTimeSeconds: stable, maxNudges: max });
    setIsModalOpen(false);
    setValidationError(null);
  };

  return (
    <div className="rounded text-left text-sm">
      <button
        type="button"
        onClick={() => setSelectedSession(machineId, session.session_id)}
        className={`w-full rounded px-3 py-2 text-left transition-colors ${isSelected ? "bg-blue-50 ring-1 ring-blue-300 dark:bg-blue-950 dark:ring-blue-700" : "hover:bg-gray-50 dark:hover:bg-gray-900"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-gray-800 dark:text-gray-100">{session.label}</span>
          <StatusSummary status={session.status} secondsSinceChange={session.seconds_since_change} />
        </div>
      </button>
      <div className="mt-2 flex items-center gap-2 px-3">
        <label className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={nudgeConfig?.enabled ?? false}
            onChange={() => setIsModalOpen(true)}
          />
          Nudge this
        </label>
        <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => setIsModalOpen(true)}>
          Configure
        </Button>
        {nudgeConfig?.enabled && (
          <button
            type="button"
            className="text-xs text-blue-700 underline"
            onClick={() => incrementNudgeCount(sessionKey)}
          >
            Mark nudge sent ({nudgeConfig.nudgesSent}/{nudgeConfig.maxNudges})
          </button>
        )}
      </div>
      <NudgeConfigModal
        machineId={machineId}
        sessionId={session.session_id}
        sessionLabel={session.label}
        isOpen={isModalOpen}
        stableTimeSeconds={stableTimeSeconds}
        maxNudges={maxNudges}
        validationError={validationError}
        onStableTimeSecondsChange={setStableTimeSeconds}
        onMaxNudgesChange={setMaxNudges}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
