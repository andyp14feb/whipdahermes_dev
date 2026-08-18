import { useCallback, useEffect, useRef, useState } from "react";
import { FreeFormInput } from "./FreeFormInput";
import { TemplateActions } from "./TemplateActions";
import { Card } from "../../shared/ui/Card";
import { ApiRequestError } from "../../shared/api-client/apiClient";
import { getCommandStatus, sendCommand } from "./commandPanel.api";
import type { CommandEntry } from "./commandPanel.types";
import type { CommandResponse, CommandStatus } from "../../shared/types/contracts";

interface CommandPanelProps {
  machineId: string | null;
  sessionId: string | null;
}

const POLL_INTERVAL_MS = 2000;
const COMMAND_HISTORY_STORAGE_KEY = "whipai.commandHistory";
const MAX_COMMAND_HISTORY = 20;
const COMMAND_STATES: CommandStatus[] = ["pending", "accepted", "delivered", "failed"];
const TERMINAL_STATES: CommandStatus[] = ["delivered", "failed"];
const COPY_FEEDBACK_MS = 1500;

const MACHINE_CONTROL_ACTIONS = [
  { label: "Start updates", payload: "__whipai__:resume", confirmation: null },
  { label: "Stop updates", payload: "__whipai__:pause", confirmation: null },
  { label: "Restart service", payload: "__whipai__:restart", confirmation: "Restart the machine-agent service?" },
  { label: "Shutdown service", payload: "__whipai__:shutdown", confirmation: "Shutdown the machine-agent service?" },
] as const;

const stateColor: Record<CommandStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

function loadCommandHistory(): CommandEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMMAND_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<CommandEntry>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (cmd): cmd is CommandEntry =>
          typeof cmd.id === "string" &&
          typeof cmd.payload === "string" &&
          COMMAND_STATES.includes(cmd.state as CommandStatus),
      )
      .slice(0, MAX_COMMAND_HISTORY);
  } catch {
    return [];
  }
}

function persistCommandHistory(commands: CommandEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COMMAND_HISTORY_STORAGE_KEY,
      JSON.stringify(commands.slice(0, MAX_COMMAND_HISTORY)),
    );
  } catch {
    /* ignore quota / disabled storage errors */
  }
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function CommandPanel({ machineId, sessionId }: CommandPanelProps) {
  const [commands, setCommands] = useState<CommandEntry[]>(loadCommandHistory);
  const [canSendControl, setCanSendControl] = useState(true);
  const [machineControlMessage, setMachineControlMessage] = useState<string | null>(null);
  const [machineControlError, setMachineControlError] = useState<string | null>(null);
  const [copiedCommandId, setCopiedCommandId] = useState<string | null>(null);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );
  const copyFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                      failureReason: res.failure_reason ?? null,
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
        } catch (err) {
          // Transient network/abort errors: keep command pending so it can recover later.
          // Only mark as failed if we get a definite failure from the API.
          if (err instanceof ApiRequestError && err.code !== "ABORTED") {
            stopPolling(commandId);
            setCommands((prev) =>
              prev.map((c) =>
                c.id === commandId
                  ? {
                      ...c,
                      state: "failed" as const,
                      failureReason:
                        err.message ?? "Polling failed",
                    }
                  : c,
              ),
            );
          }
          // Otherwise (ABORTED or other transient), leave command in current state
          // and let the next poll attempt recover.
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
      if (copyFeedbackTimer.current) {
        clearTimeout(copyFeedbackTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    persistCommandHistory(commands);
  }, [commands]);

  const handleCommandSent = useCallback(
    (commandId: string, payload: string) => {
      setCommands((prev) => [
        { id: commandId, payload, state: "pending" as const },
        ...prev,
      ].slice(0, MAX_COMMAND_HISTORY));
      startPolling(commandId);
    },
    [startPolling],
  );

  const handleResend = useCallback(
    (payload: string) => {
      if (!machineId || !sessionId) return;
      void (async () => {
        const response = await sendCommand(machineId, sessionId, payload);
        handleCommandSent(response.command_id, payload);
      })();
    },
    [handleCommandSent, machineId, sessionId],
  );

  const handleCopy = useCallback((commandId: string, payload: string) => {
    void (async () => {
      await copyText(payload);
      setCopiedCommandId(commandId);
      if (copyFeedbackTimer.current) {
        clearTimeout(copyFeedbackTimer.current);
      }
      copyFeedbackTimer.current = setTimeout(() => {
        setCopiedCommandId(null);
      }, COPY_FEEDBACK_MS);
    })();
  }, []);

  if (!machineId || !sessionId) {
    return (
      <Card className="flex items-center justify-center p-3">
        <p className="text-sm text-gray-400">No session selected</p>
      </Card>
    );
  }

  const handleMachineControl = (payload: string, label: string) => {
    if (!canSendControl) {
      setMachineControlError("A control command is already in progress");
      return;
    }
    setCanSendControl(false);
    setMachineControlMessage(null);
    setMachineControlError(null);
    void (async () => {
      try {
        const response = await sendCommand(machineId, sessionId, payload);
        handleCommandSent(response.command_id, payload);
        setMachineControlMessage(`${label} command sent successfully`);
      } catch {
        setMachineControlError(`Failed to send ${label.toLowerCase()} command`);
      } finally {
        setTimeout(() => { setCanSendControl(true); }, 2000);
      }
    })();
  };

  return (
    <Card className="p-3">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
        Command Actions
      </h2>
      <FreeFormInput
        machineId={machineId}
        sessionId={sessionId}
        onCommandSent={handleCommandSent}
      />
      <div className="mt-2">
        <TemplateActions
          machineId={machineId}
          sessionId={sessionId}
          onCommandSent={handleCommandSent}
        />
      </div>

      <div className="mt-3 border-t border-gray-200 pt-2 dark:border-gray-700">
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Machine-Agent Control
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {MACHINE_CONTROL_ACTIONS.map((action) => {
            const handleClick = () => {
              if (action.confirmation) {
                if (!window.confirm(action.confirmation)) return;
              }
              handleMachineControl(action.payload, action.label);
            };
            return (
              <button
                key={action.payload}
                type="button"
                disabled={!canSendControl}
                onClick={handleClick}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {action.label}
              </button>
            );
          })}
        </div>
        {machineControlMessage && (
          <p className="mt-1 text-xs text-green-600">{machineControlMessage}</p>
        )}
        {machineControlError && (
          <p className="mt-1 text-xs text-red-600">{machineControlError}</p>
        )}
      </div>

      {commands.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Command History</h3>
          <div
            aria-label="Command history list"
            className="max-h-56 overflow-y-auto rounded border border-gray-200 bg-white/70 p-1 dark:border-gray-800 dark:bg-gray-950/40"
          >
            <ul className="space-y-1">
              {commands.map((cmd) => (
                <li
                  key={cmd.id}
                  className="flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1.5 text-xs dark:border-gray-800"
                >
                  <span className="min-w-0 truncate font-mono text-gray-800 dark:text-gray-100">{cmd.payload}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      className="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      onClick={() => handleCopy(cmd.id, cmd.payload)}
                    >
                      {copiedCommandId === cmd.id ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      className="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      onClick={() => handleResend(cmd.payload)}
                    >
                      Resend
                    </button>
                    {cmd.state === "failed" && cmd.failureReason && (
                      <span className="text-xs text-red-600">
                        {cmd.failureReason}
                      </span>
                    )}
                    <span
                      className={`inline-block rounded-full px-1.5 py-0.5 text-xs font-medium ${stateColor[cmd.state]}`}
                    >
                      {cmd.state}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
