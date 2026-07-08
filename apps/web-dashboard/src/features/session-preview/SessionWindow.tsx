import { useCallback, useMemo, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CommandPanel } from "../command-panel/CommandPanel";
import { Card } from "../../shared/ui/Card";
import { SessionPreview } from "./SessionPreview";
import { useAppStore } from "../../shared/state/appStore";
import { Button } from "../../shared/ui/Button";
import { fetchMachines, fetchSessions } from "../machine-list/machineList.api";
import { useSettingsStore } from "../../shared/state/settingsStore";
import { StatusSummary } from "../status-summary/StatusSummary";
import { assessSession, fetchSessionDetail } from "./sessionPreview.api";
import type { SessionListItem } from "../../shared/types/contracts";

interface SessionWindowProps {
  index: number;
}

export function SessionWindow({ index }: SessionWindowProps) {
  const resizeStateRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const slot = useAppStore((s) => s.windows[index]);
  const activeWindowIndex = useAppStore((s) => s.activeWindowIndex);
  const setActiveWindow = useAppStore((s) => s.setActiveWindow);
  const setWindowSelection = useAppStore((s) => s.setWindowSelection);
  const clearWindowSelection = useAppStore((s) => s.clearWindowSelection);
  const setWindowHeight = useAppStore((s) => s.setWindowHeight);
  const refreshIntervalMs = useSettingsStore((s) => s.refreshIntervalMs);
  const isActive = activeWindowIndex === index;

  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: fetchSessions,
    refetchInterval: refreshIntervalMs,
  });

  const machinesQuery = useQuery({
    queryKey: ["machines"],
    queryFn: fetchMachines,
    refetchInterval: refreshIntervalMs,
  });

  const sessionDetailQuery = useQuery({
    queryKey: ["session-detail", slot.machineId, slot.sessionId],
    queryFn: () => fetchSessionDetail(slot.machineId!, slot.sessionId!),
    enabled: !!slot.machineId && !!slot.sessionId,
    refetchInterval: refreshIntervalMs,
  });

  const assessMutation = useMutation({
    mutationFn: () => assessSession(slot.machineId!, slot.sessionId!),
  });

  const selectedValue = slot.machineId && slot.sessionId
    ? `${slot.machineId}::${slot.sessionId}`
    : "";

  const machineDisplayNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const machine of machinesQuery.data?.machines ?? []) {
      map.set(machine.machine_id, machine.display_name || machine.machine_id);
    }
    return map;
  }, [machinesQuery.data?.machines]);

  const options = useMemo(
    () => {
      const sessions = sessionsQuery.data?.sessions ?? [];
      return sessions
        .map((session: SessionListItem) => {
          const machineName = machineDisplayNameById.get(session.machine_id) || session.machine_id;
          const sessionName = session.label || session.session_id;
          return {
            value: `${session.machine_id}::${session.session_id}`,
            label: `[${machineName}]--[${sessionName}]`,
          };
        })
        .sort((left: { value: string; label: string }, right: { value: string; label: string }) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
    },
    [sessionsQuery.data?.sessions, machineDisplayNameById],
  );

  const startResize = (event: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if ("pointerId" in event) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    resizeStateRef.current = { startY: event.clientY, startHeight: slot.heightPx };
    const onMove = (moveEvent: PointerEvent | MouseEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;
      setWindowHeight(index, resizeState.startHeight + (moveEvent.clientY - resizeState.startY));
    };
    const onUp = () => {
      resizeStateRef.current = null;
      globalThis.window.removeEventListener("pointermove", onMove);
      globalThis.window.removeEventListener("pointerup", onUp);
      globalThis.window.removeEventListener("mousemove", onMove);
      globalThis.window.removeEventListener("mouseup", onUp);
    };
    globalThis.window.addEventListener("pointermove", onMove);
    globalThis.window.addEventListener("pointerup", onUp, { once: true });
    globalThis.window.addEventListener("mousemove", onMove);
    globalThis.window.addEventListener("mouseup", onUp, { once: true });
  };

  const handleAssess = useCallback(() => {
    if (!slot.machineId || !slot.sessionId) return;
    assessMutation.mutate();
  }, [assessMutation, slot.machineId, slot.sessionId]);

  const data = sessionDetailQuery.data;

  return (
    <Card
      className={`flex min-h-[30rem] flex-col gap-2 p-2 transition-colors sm:p-3 ${
        isActive
          ? "border-blue-300 bg-white ring-2 ring-blue-300 dark:border-blue-500 dark:bg-gray-900"
          : "bg-gray-50 opacity-80 dark:bg-gray-950 dark:opacity-90"
      }`}
      onClick={() => setActiveWindow(index)}
    >
      <div className="flex flex-wrap items-center gap-2 px-1">
        <h2 className="mr-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Window {index + 1}
        </h2>
        <Button
          type="button"
          variant="secondary"
          className="px-2 py-1 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            handleAssess();
          }}
          disabled={!slot.machineId || !slot.sessionId}
        >
          {assessMutation.isPending ? "Assessing..." : "Assess"}
        </Button>
        <span
          aria-label={isActive ? "Active window" : "Idle window"}
          title={isActive ? "Active" : "Idle"}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-base ${
            isActive
              ? "bg-yellow-100 text-yellow-500 shadow-[0_0_14px_rgba(250,204,21,0.75)] dark:bg-yellow-300/15 dark:text-yellow-300"
              : "bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
          }`}
        >
          {isActive ? "💡" : "◌"}
        </span>
        {data?.status && (
          <StatusSummary
            status={data.status}
            secondsSinceChange={data.seconds_since_change}
            className="min-w-fit"
          />
        )}
        {data?.cwd && (
          <span
            className="min-w-0 flex-1 truncate text-xs text-gray-500 dark:text-gray-400"
            title={data.cwd}
          >
            {data.cwd}
          </span>
        )}
      </div>

      <div className="grid gap-2 px-1 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <label htmlFor={`window-session-selector-${index}`} className="sr-only">
          Watched tmux session
        </label>
        <select
          id={`window-session-selector-${index}`}
          aria-label={`Window ${index + 1} session selector`}
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          value={selectedValue}
          onChange={(e) => {
            const value = e.target.value;
            if (!value) {
              clearWindowSelection(index);
              return;
            }
            const [machineId, sessionId] = value.split("::");
            setWindowSelection(index, machineId, sessionId);
          }}
        >
          <option value="">Select a tmux session</option>
          {options.map((option: { value: string; label: string }) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondary"
          className="px-3 py-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            clearWindowSelection(index);
          }}
          disabled={!slot.machineId || !slot.sessionId}
        >
          Unwatch
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <SessionPreview
          machineId={slot.machineId}
          sessionId={slot.sessionId}
          heightPx={slot.heightPx}
          onAutoAssess={handleAssess}
        />
        <div
          role="separator"
          aria-label={`Resize CLI preview for Window ${index + 1}`}
          aria-orientation="horizontal"
          title="Drag to resize CLI preview"
          className="h-3 cursor-row-resize rounded bg-gray-200 transition hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
          onPointerDown={startResize}
          onMouseDown={startResize}
        />
        <CommandPanel
          machineId={slot.machineId}
          sessionId={slot.sessionId}
        />
      </div>
    </Card>
  );
}
