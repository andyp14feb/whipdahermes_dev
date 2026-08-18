import { useState } from "react";
import { Button } from "../../shared/ui/Button";
import { useAppStore } from "../../shared/state/appStore";
import { useSettingsStore } from "../../shared/state/settingsStore";
import { sendCommand } from "./commandPanel.api";
import type { CommandResponse } from "../../shared/types/contracts";
import type { TemplateAction } from "./commandPanel.types";

interface TemplateActionsProps {
  machineId: string;
  sessionId: string;
  onCommandSent?: (commandId: string, payload: string) => void;
}

export function TemplateActions({
  machineId,
  sessionId,
  onCommandSent,
}: TemplateActionsProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const templateActions = useSettingsStore((s) => s.templateActions);
  const setConnectionError = useAppStore((s) => s.setConnectionError);

  async function handleClick(actionId: string, payload: string) {
    setLoadingId(actionId);
    setError(null);

    try {
      const response: CommandResponse = await sendCommand(
        machineId,
        sessionId,
        payload,
      );
      onCommandSent?.(response.command_id, payload);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send command";
      setError(message);
      setConnectionError(message);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {templateActions.map((action: TemplateAction) => (
        <Button
          key={action.id}
          type="button"
          variant="secondary"
          disabled={loadingId !== null}
          onClick={() => handleClick(action.id, action.payload)}
          className="text-xs"
        >
          {loadingId === action.id ? (
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              Sending...
            </span>
          ) : (
            action.label
          )}
        </Button>
      ))}
      {error && (
        <span className="ml-2 self-center text-xs text-red-600">{error}</span>
      )}
    </div>
  );
}
