import { useCallback, useEffect, useRef, useState } from "react";
import { FreeFormInput } from "./FreeFormInput";
import { TemplateActions } from "./TemplateActions";
import { Card } from "../../shared/ui/Card";
import { getCommandStatus } from "./commandPanel.api";
import type { CommandEntry } from "./commandPanel.types";
import type { CommandResponse, CommandStatus } from "../../shared/types/contracts";

interface CommandPanelProps {
  machineId: string | null;
  sessionId: string | null;
}

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATES: CommandStatus[] = ["delivered", "failed"];

const stateColor: Record<CommandStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export function CommandPanel({ machineId, sessionId }: CommandPanelProps) {
  const [commands, setCommands] = useState<CommandEntry[]>([]);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );

  const stopPolling = useCallback((commandId: string) => {
    const timer = pollTimers.current.get(commandId);
    if (timer) {
      clearInterval(timer);
      pollTimers.current.delete(commandId);
    }
  }, []);

  const startPolling = useCallback(
    (commandId: string) => {
      const timer = setInterval(async () => {
        try {
          const res: CommandResponse = await getCommandStatus(commandId);
          if (TERMINAL_STATES.includes(res.state)) {
            stopPolling(commandId);
            setCommands((prev) =>
              prev.map((c) =>
                c.id === commandId
                  ? {
                      ...c,
                      state: res.state,
                      failureReason: res.failure_reason,
                    }
                  : c,
              ),
            );
          } else {
            setCommands((prev) =>
              prev.map((c) =>
                c.id === commandId ? { ...c, state: res.state } : c,
              ),
            );
          }
        } catch {
          stopPolling(commandId);
          setCommands((prev) =>
            prev.map((c) =>
              c.id === commandId
                ? { ...c, state: "failed" as const, failureReason: "Polling failed" }
                : c,
            ),
          );
        }
      }, POLL_INTERVAL_MS);
      pollTimers.current.set(commandId, timer);
    },
    [stopPolling],
  );

  useEffect(() => {
    return () => {
      pollTimers.current.forEach((timer) => clearInterval(timer));
      pollTimers.current.clear();
    };
  }, []);

  function handleCommandSent(commandId: string, payload: string) {
    setCommands((prev) => [
      { id: commandId, payload, state: "pending" as const },
      ...prev,
    ]);
    startPolling(commandId);
  }

  if (!machineId || !sessionId) {
    return (
      <Card className="flex items-center justify-center p-6">
        <p className="text-sm text-gray-400">No session selected</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">
        Command Actions
      </h2>
      <FreeFormInput
        machineId={machineId}
        sessionId={sessionId}
        onCommandSent={handleCommandSent}
      />
      <div className="mt-4">
        <TemplateActions
          machineId={machineId}
          sessionId={sessionId}
          onCommandSent={handleCommandSent}
        />
      </div>

      {commands.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Command History</h3>
          <ul className="space-y-1">
            {commands.map((cmd) => (
              <li
                key={cmd.id}
                className="flex items-center justify-between gap-2 rounded border border-gray-100 px-3 py-2 text-sm"
              >
                <span className="font-mono text-gray-800">{cmd.payload}</span>
                <span className="flex items-center gap-2">
                  {cmd.state === "failed" && cmd.failureReason && (
                    <span className="text-xs text-red-600">
                      {cmd.failureReason}
                    </span>
                  )}
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${stateColor[cmd.state]}`}
                  >
                    {cmd.state}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
