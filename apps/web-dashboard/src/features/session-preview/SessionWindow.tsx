import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CommandPanel } from "../command-panel/CommandPanel";
import { Card } from "../../shared/ui/Card";
import { SessionPreview } from "./SessionPreview";
import { useAppStore } from "../../shared/state/appStore";
import { Button } from "../../shared/ui/Button";
import { fetchSessions } from "../machine-list/machineList.api";
import { useSettingsStore } from "../../shared/state/settingsStore";

interface SessionWindowProps {
  index: number;
}

export function SessionWindow({ index }: SessionWindowProps) {
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

  const selectedValue = slot.machineId && slot.sessionId
    ? `${slot.machineId}::${slot.sessionId}`
    : "";

  const options = useMemo(
    () => (sessionsQuery.data?.sessions ?? []).map((session) => ({
      value: `${session.machine_id}::${session.session_id}`,
      label: `${session.label} — ${session.machine_id}/${session.session_id}`,
    })),
    [sessionsQuery.data?.sessions],
  );

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = slot.heightPx;
    const onMove = (moveEvent: PointerEvent) => {
      setWindowHeight(index, startHeight + (moveEvent.clientY - startY));
    };
    const onUp = () => {
      globalThis.window.removeEventListener("pointermove", onMove);
      globalThis.window.removeEventListener("pointerup", onUp);
    };
    globalThis.window.addEventListener("pointermove", onMove);
    globalThis.window.addEventListener("pointerup", onUp, { once: true });
  };

  return (
    <Card
      className={`flex min-h-[30rem] flex-col gap-2 p-2 transition-colors sm:p-3 ${
        isActive
          ? "border-blue-300 bg-white ring-2 ring-blue-300 dark:border-blue-500 dark:bg-gray-900"
          : "bg-gray-50 opacity-80 dark:bg-gray-950 dark:opacity-90"
      }`}
      onClick={() => setActiveWindow(index)}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Window {index + 1}
          </h2>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {slot.machineId && slot.sessionId
              ? `${slot.machineId}/${slot.sessionId}`
              : "No session selected"}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs ${
          isActive
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100"
            : "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-300"
        }`}>
          {isActive ? "Active" : "Idle"}
        </span>
      </div>

      <div className="grid gap-2 px-1 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <label
            htmlFor={`window-session-selector-${index}`}
            className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-200"
          >
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
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
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
        />
        <CommandPanel
          machineId={slot.machineId}
          sessionId={slot.sessionId}
        />
      </div>

      <div className="px-1">
        <div
          role="separator"
          aria-label={`Resize Window ${index + 1}`}
          className="hidden h-3 cursor-row-resize rounded bg-gray-200 transition hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 md:block"
          onPointerDown={startResize}
        />
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 md:hidden">
          Window height adapts automatically on smaller screens.
        </p>
      </div>
    </Card>
  );
}
