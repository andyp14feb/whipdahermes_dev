import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { StatusSummary } from "../status-summary/StatusSummary";
import type { SessionListItem } from "../../shared/types/contracts";
import { useAppStore } from "../../shared/state/appStore";
import { DEFAULT_NUDGE_PROMPT, useSettingsStore } from "../../shared/state/settingsStore";
import { Button } from "../../shared/ui/Button";
import { NudgeConfigModal } from "./NudgeConfigModal";
import { deleteSession, enqueueRenameTmuxSession, killSession } from "./machineList.api";

interface MachineListItemProps {
  machineId: string;
  session: SessionListItem;
}

export function MachineListItem({ machineId, session }: MachineListItemProps) {
  const { selectedMachineId, selectedSessionId, setSelectedSession } = useAppStore();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const sessionKey = `${machineId}:${session.session_id}`;
  const nudgeConfig = useSettingsStore((s) => s.nudgesBySession[sessionKey]);
  const setNudgeEnabled = useSettingsStore((s) => s.setNudgeEnabled);
  const upsertNudgeConfig = useSettingsStore((s) => s.upsertNudgeConfig);
  const incrementNudgeCount = useSettingsStore((s) => s.incrementNudgeCount);
  const [stableTimeSeconds, setStableTimeSeconds] = useState(
    String(nudgeConfig?.stableTimeSeconds ?? 60),
  );
  const [maxNudges, setMaxNudges] = useState(String(nudgeConfig?.maxNudges ?? 3));
  const [customPrompt, setCustomPrompt] = useState(nudgeConfig?.customPrompt ?? "");
  const isSelected =
    selectedMachineId === machineId && selectedSessionId === session.session_id;

  const handleSave = () => {
    const stable = Number(stableTimeSeconds);
    const max = Number(maxNudges);
    if (!Number.isInteger(stable) || stable < 1 || !Number.isInteger(max) || max < 1) {
      setValidationError("Stable time and max nudges must be positive integers.");
      return;
    }
    upsertNudgeConfig(sessionKey, {
      enabled: nudgeConfig?.enabled ?? true,
      stableTimeSeconds: stable,
      maxNudges: max,
      customPrompt: customPrompt.trim() || DEFAULT_NUDGE_PROMPT,
    });
    setIsModalOpen(false);
    setValidationError(null);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove session "${session.label}" from the displayed list only? The session may reappear on the next heartbeat.`)) {
      return;
    }

    try {
      setActionFeedback(null);
      await deleteSession(machineId, session.session_id);
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : "Failed to remove session from list.");
    }
  };

  const handleKillSession = async () => {
    if (!window.confirm(`Kill tmux session "${session.label}"? This stops the live tmux session, not just the dashboard row.`)) {
      return;
    }

    try {
      setActionFeedback(null);
      const response = await killSession(machineId, session.session_id);
      setActionFeedback(`Kill request queued (${response.command_id}). The next heartbeat confirms the tmux session is gone.`);
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : "Failed to request tmux session kill.");
    }
  };

  const handleRenameSession = async () => {
    const newName = window.prompt("Rename tmux session to", session.session_id)?.trim();
    if (!newName) {
      return;
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(newName)) {
      setActionFeedback("Session name must start with a letter or number and contain only letters, numbers, dot, underscore, hyphen, or colon.");
      return;
    }
    if (newName === session.session_id) {
      setActionFeedback("New session name is the same as the current name.");
      return;
    }

    try {
      setActionFeedback(null);
      await enqueueRenameTmuxSession(machineId, session.session_id, newName);
      window.alert("Rename tmux session request queued. The next heartbeat confirms the rename and refreshes the list.");
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : "Failed to request rename.");
    }
  };

  return (
    <div className="rounded text-left text-sm">
      <button
        type="button"
        onClick={() => setSelectedSession(machineId, session.session_id)}
        style={isSelected ? { backgroundColor: "var(--theme-bg-soft)" } : undefined}
        className={`w-full rounded px-3 py-2 text-left transition-colors ${isSelected ? "theme-ring ring-1" : "hover:bg-gray-50 dark:hover:bg-gray-900"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-gray-800 dark:text-gray-100">{session.label}</span>
          <StatusSummary status={session.status} secondsSinceChange={session.seconds_since_change} />
        </div>
      </button>
      <div className="mt-2 space-y-2 px-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={nudgeConfig?.enabled ?? false}
              onChange={(event) => setNudgeEnabled(sessionKey, event.target.checked)}
            />
            Nudge this
          </label>
          <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => setIsModalOpen(true)}>
            Configure
          </Button>
          <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={handleRenameSession}>
            Rename
          </Button>
          <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={handleKillSession}>
            Kill tmux
          </Button>
          <button
            type="button"
            title="Remove session from list"
            className="ml-auto rounded px-1.5 py-1 text-xs text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
            onClick={handleDelete}
          >
            ×
          </button>
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
        {actionFeedback && <p role="alert" className="text-xs text-red-600">{actionFeedback}</p>}
      </div>
      <NudgeConfigModal
        machineId={machineId}
        sessionId={session.session_id}
        sessionLabel={session.label}
        isOpen={isModalOpen}
        stableTimeSeconds={stableTimeSeconds}
        maxNudges={maxNudges}
        customPrompt={customPrompt}
        validationError={validationError}
        onStableTimeSecondsChange={setStableTimeSeconds}
        onMaxNudgesChange={setMaxNudges}
        onCustomPromptChange={setCustomPrompt}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
