import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cleanupStaleSessions,
  deleteMachine,
  enqueueCreateTmuxSession,
  fetchMachines,
  fetchSessions,
} from "./machineList.api";
import type { MachineWithSessions, SessionListItem } from "./machineList.types";
import { MachineListItem } from "./MachineListItem";
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";
import { useSettingsStore } from "../../shared/state/settingsStore";

type MachineSortMode = "manual" | "name" | "last_seen";
type SessionSortMode = "manual" | "name" | "status" | "stable_time";
type SortDirection = "asc" | "desc";

const MACHINE_ORDER_STORAGE_KEY = "whipai.machineList.manualOrder";

function loadManualMachineOrder(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(MACHINE_ORDER_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function saveManualMachineOrder(machineIds: string[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    MACHINE_ORDER_STORAGE_KEY,
    JSON.stringify(machineIds),
  );
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function sortMachineGroups(
  groups: MachineWithSessions[],
  mode: MachineSortMode,
  direction: SortDirection,
  manualOrder: string[],
): MachineWithSessions[] {
  const dir = direction === "asc" ? 1 : -1;
  const originalIndex = new Map(
    groups.map((machine, index) => [machine.machine_id, index]),
  );

  if (mode === "manual") {
    const manualIndex = new Map(
      manualOrder.map((machineId, index) => [machineId, index]),
    );
    return [...groups].sort((a, b) => {
      const aIndex = manualIndex.get(a.machine_id);
      const bIndex = manualIndex.get(b.machine_id);
      if (aIndex !== undefined && bIndex !== undefined) {
        return aIndex - bIndex;
      }
      if (aIndex !== undefined) {
        return -1;
      }
      if (bIndex !== undefined) {
        return 1;
      }
      return (
        (originalIndex.get(a.machine_id) ?? 0) -
        (originalIndex.get(b.machine_id) ?? 0)
      );
    });
  }

  return [...groups].sort((a, b) => {
    const primary =
      mode === "name"
        ? a.display_name.localeCompare(b.display_name, undefined, {
            numeric: true,
            sensitivity: "base",
          })
        : new Date(a.last_seen_at).getTime() -
          new Date(b.last_seen_at).getTime();

    if (primary !== 0) {
      return primary * dir;
    }
    return a.display_name.localeCompare(b.display_name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

const STATUS_ORDER = {
  active: 0,
  stable: 1,
  waiting: 2,
  waiting_input: 2,
  stuck: 3,
  stale: 4,
  unknown: 5,
};

function sortSessions(
  sessions: SessionListItem[],
  mode: SessionSortMode,
  direction: SortDirection,
): SessionListItem[] {
  const dir = direction === "asc" ? 1 : -1;
  if (mode === "manual") {
    return sessions;
  }

  return [...sessions].sort((a, b) => {
    const primary =
      mode === "name"
        ? a.label.localeCompare(b.label, undefined, {
            numeric: true,
            sensitivity: "base",
          })
        : mode === "status"
          ? (STATUS_ORDER[a.status] ?? STATUS_ORDER.unknown) -
            (STATUS_ORDER[b.status] ?? STATUS_ORDER.unknown)
          : a.seconds_since_change - b.seconds_since_change;

    if (primary !== 0) {
      return primary * dir;
    }
    return a.label.localeCompare(b.label, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

export function MachineList() {
  const refreshIntervalMs = useSettingsStore((s) => s.refreshIntervalMs);
  const queryClient = useQueryClient();
  const [busyMachineId, setBusyMachineId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<MachineSortMode>("manual");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [sessionSortMode, setSessionSortMode] =
    useState<SessionSortMode>("manual");
  const [sessionDirection, setSessionDirection] =
    useState<SortDirection>("asc");
  const [manualMachineOrder, setManualMachineOrder] = useState<string[]>(
    loadManualMachineOrder,
  );
  const [draggingMachineId, setDraggingMachineId] = useState<string | null>(
    null,
  );

  // Cleanup state
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  // Per-machine session expand/collapse
  const [collapsedMachines, setCollapsedMachines] = useState<
    Record<string, boolean>
  >({});

  const toggleMachineCollapsed = useCallback((machineId: string) => {
    setCollapsedMachines((prev) => ({
      ...prev,
      [machineId]: !prev[machineId],
    }));
  }, []);

  const handleCleanup = useCallback(async () => {
    setIsCleaningUp(true);
    setCleanupMessage(null);
    try {
      const result = await cleanupStaleSessions(undefined);
      setCleanupMessage(result.message ?? `Cleaned up ${result.deleted} stale session(s)`);
      await queryClient.invalidateQueries({ queryKey: ["machines"] });
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setCleanupMessage(`Cleanup failed: ${message}`);
    } finally {
      setIsCleaningUp(false);
    }
  }, [queryClient]);

  const machinesQuery = useQuery({
    queryKey: ["machines"],
    queryFn: fetchMachines,
    refetchInterval: refreshIntervalMs,
  });

  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: fetchSessions,
    refetchInterval: refreshIntervalMs,
  });

  const isLoading = machinesQuery.isLoading || sessionsQuery.isLoading;

  const machines = machinesQuery.data?.machines ?? [];
  const sessions = sessionsQuery.data?.sessions ?? [];

  const machineGroups: MachineWithSessions[] = useMemo(() => {
    const sessionsByMachine = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const list = sessionsByMachine.get(s.machine_id) ?? [];
      list.push(s);
      sessionsByMachine.set(s.machine_id, list);
    }

    return machines.map((m: (typeof machines)[number]) => ({
      ...m,
      sessions: sessionsByMachine.get(m.machine_id) ?? [],
    }));
  }, [machines, sessions]);

  const orderedMachineGroups = useMemo(
    () =>
      sortMachineGroups(
        machineGroups,
        sortMode,
        sortDirection,
        manualMachineOrder,
      ).map((machine) => ({
        ...machine,
        sessions: sortSessions(
          machine.sessions,
          sessionSortMode,
          sessionDirection,
        ),
      })),
    [
      machineGroups,
      manualMachineOrder,
      sessionDirection,
      sessionSortMode,
      sortDirection,
      sortMode,
    ],
  );

  const updateManualOrder = (machineIds: string[]) => {
    setManualMachineOrder(machineIds);
    saveManualMachineOrder(machineIds);
  };

  const handleSortModeChange = (mode: MachineSortMode) => {
    setSortMode(mode);
  };

  const handleDragStart = (machineId: string) => {
    setDraggingMachineId(machineId);
    setSortMode("manual");
  };

  const handleDragOver = (targetMachineId: string) => {
    if (!draggingMachineId || draggingMachineId === targetMachineId) {
      return;
    }

    const currentIds = orderedMachineGroups.map(
      (machine) => machine.machine_id,
    );
    const fromIndex = currentIds.indexOf(draggingMachineId);
    const toIndex = currentIds.indexOf(targetMachineId);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    updateManualOrder(moveItem(currentIds, fromIndex, toIndex));
  };

  const safeName = (value: string) =>
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value);
  const defaultSessionName = () =>
    `whipai-${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}`;

  const handleCreateSession = async (machineId: string) => {
    const requestedName = window
      .prompt("New tmux session name (blank for default)", "")
      ?.trim() ?? "";
    const sessionName = requestedName || defaultSessionName();
    if (!safeName(sessionName)) {
      setCreateError(
        "Session name must start with a letter or number and contain only letters, numbers, dot, underscore, or hyphen.",
      );
      return;
    }
    setBusyMachineId(machineId);
    setCreateError(null);
    try {
      const response = await enqueueCreateTmuxSession(machineId, sessionName);
      window.alert(
        `Create tmux session request queued (${response.command_id}). The next heartbeat confirms registration.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Failed to request tmux session creation.",
      );
    } finally {
      setBusyMachineId(null);
    }
  };

  const handleDeleteMachine = async (machineId: string) => {
    const confirmed = window.confirm(
      `Remove machine "${machineId}" from the displayed list only? This does not stop machine-agent or kill tmux sessions. It may reappear on the next heartbeat.`,
    );
    if (!confirmed) {
      return;
    }
    setBusyMachineId(machineId);
    setDeleteError(null);
    try {
      await deleteMachine(machineId);
      updateManualOrder(manualMachineOrder.filter((id) => id !== machineId));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["machines"] }),
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
      ]);
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Failed to remove machine from list.",
      );
    } finally {
      setBusyMachineId(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <p className="text-sm text-gray-500">Loading machines...</p>
      </Card>
    );
  }

  if (machineGroups.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-gray-500">No machines found.</p>
      </Card>
    );
  }

  // Determine which machines are currently collapsed (default: expand all)
  const anyCollapsed = Object.values(collapsedMachines).some(Boolean);

  return (
    <div className="space-y-3">
      {/* ── Global sort + cleanup control card ─────────────────── */}
      <Card className="p-3">
        <div className="space-y-2">
          {/* Machine order */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Machine order
            </span>
            <Button
              type="button"
              variant="secondary"
              className="px-2 py-1 text-xs"
              onClick={() =>
                setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
              }
              disabled={sortMode === "manual"}
              title={
                sortMode === "manual"
                  ? "Direction applies to name and last registered sorting."
                  : "Toggle ascending/descending order"
              }
            >
              {sortDirection === "asc" ? "Asc ↑" : "Desc ↓"}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={sortMode === "manual" ? "primary" : "secondary"}
              className="px-2 py-1 text-xs"
              onClick={() => handleSortModeChange("manual")}
            >
              Manual
            </Button>
            <Button
              type="button"
              variant={sortMode === "name" ? "primary" : "secondary"}
              className="px-2 py-1 text-xs"
              onClick={() => handleSortModeChange("name")}
            >
              Name
            </Button>
            <Button
              type="button"
              variant={sortMode === "last_seen" ? "primary" : "secondary"}
              className="px-2 py-1 text-xs"
              onClick={() => handleSortModeChange("last_seen")}
            >
              Last registered
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Drag machine cards to set a custom order, or sort by name / last
            registered time.
          </p>

          {/* Session order */}
          <div className="border-t border-gray-200 pt-2 dark:border-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Session order
              </span>
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs"
                onClick={() =>
                  setSessionDirection((d) => (d === "asc" ? "desc" : "asc"))
                }
                disabled={sessionSortMode === "manual"}
                title={
                  sessionSortMode === "manual"
                    ? "Direction applies to name, status, and stable time sorting."
                    : "Toggle ascending/descending order"
                }
              >
                {sessionDirection === "asc" ? "Asc ↑" : "Desc ↓"}
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <Button
                type="button"
                variant={
                  sessionSortMode === "manual" ? "primary" : "secondary"
                }
                className="px-2 py-1 text-xs"
                onClick={() => setSessionSortMode("manual")}
              >
                Manual
              </Button>
              <Button
                type="button"
                variant={sessionSortMode === "name" ? "primary" : "secondary"}
                className="px-2 py-1 text-xs"
                onClick={() => setSessionSortMode("name")}
              >
                Name
              </Button>
              <Button
                type="button"
                variant={
                  sessionSortMode === "status" ? "primary" : "secondary"
                }
                className="px-2 py-1 text-xs"
                onClick={() => setSessionSortMode("status")}
              >
                Status
              </Button>
              <Button
                type="button"
                variant={
                  sessionSortMode === "stable_time" ? "primary" : "secondary"
                }
                className="px-2 py-1 text-xs"
                onClick={() => setSessionSortMode("stable_time")}
              >
                Stable time
              </Button>
            </div>
          </div>

          {/* Cleanup + expand/collapse controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-2 dark:border-gray-800">
            <Button
              type="button"
              variant="danger"
              className="px-3 py-1.5 text-xs font-medium"
              disabled={isCleaningUp}
              onClick={handleCleanup}
            >
              {isCleaningUp ? "Cleaning…" : "Cleanup Stale Sessions"}
            </Button>
            <div className="flex items-center gap-2">
              {cleanupMessage && (
                <p
                  role="status"
                  className="text-xs text-gray-500 dark:text-gray-400"
                >
                  {cleanupMessage}
                </p>
              )}
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs"
                onClick={() =>
                  setCollapsedMachines(
                    Object.fromEntries(
                      orderedMachineGroups.map((m) => [m.machine_id, false]),
                    ),
                  )
                }
                title="Expand all session lists"
              >
                Expand all
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs"
                onClick={() =>
                  setCollapsedMachines(
                    Object.fromEntries(
                      orderedMachineGroups.map((m) => [m.machine_id, true]),
                    ),
                  )
                }
                title="Collapse all session lists"
              >
                Collapse all
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {createError && (
        <p role="alert" className="text-xs text-red-600">
          {createError}
        </p>
      )}
      {deleteError && (
        <p role="alert" className="text-xs text-red-600">
          {deleteError}
        </p>
      )}

      {/* ── Machine cards ──────────────────────────────────────── */}
      {orderedMachineGroups.map((machine) => {
        const isCollapsed = !!collapsedMachines[machine.machine_id];
        return (
          <Card
            key={machine.machine_id}
            data-testid={`machine-card-${machine.machine_id}`}
            className={`p-3 transition ${
              machine.is_stale ? "opacity-60" : ""
            } ${draggingMachineId === machine.machine_id ? "ring-2 ring-blue-400" : ""}`}
            draggable
            onDragStart={() => handleDragStart(machine.machine_id)}
            onDragOver={(event: React.DragEvent<HTMLDivElement>) => {
              event.preventDefault();
              handleDragOver(machine.machine_id);
            }}
            onDragEnd={() => setDraggingMachineId(null)}
          >
            {/* Machine header */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-label={`Drag ${machine.display_name}`}
                  title="Drag to reorder machine cards"
                  className="cursor-grab select-none text-sm text-gray-400 active:cursor-grabbing dark:text-gray-500"
                >
                  ⋮⋮
                </span>
                <h3 className="truncate text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {machine.display_name}
                  <span className="ml-1 font-normal text-gray-400 dark:text-gray-500">
                    ({machine.sessions.length})
                  </span>
                  {machine.is_stale && (
                    <span className="ml-2 inline-flex items-center rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                      stale
                    </span>
                  )}
                </h3>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {/* Expand / collapse chevron — shows session list count */}
                <button
                  type="button"
                  title={isCollapsed ? "Expand session list" : "Collapse session list"}
                  className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  onClick={() => toggleMachineCollapsed(machine.machine_id)}
                >
                  {isCollapsed ? "▸" : "▾"}{" "}
                  <span className="text-xs">
                    {machine.sessions.length} session
                    {machine.sessions.length !== 1 ? "s" : ""}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                  disabled={busyMachineId === machine.machine_id}
                  onClick={() => handleCreateSession(machine.machine_id)}
                >
                  New tmux
                </Button>
                <button
                  type="button"
                  title="Remove machine from list"
                  className="rounded px-1.5 py-1 text-xs text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950"
                  disabled={busyMachineId === machine.machine_id}
                  onClick={() => handleDeleteMachine(machine.machine_id)}
                >
                  ×
                </button>
              </div>
            </div>

            <p className="mb-2 text-xs text-gray-400 dark:text-gray-500">
              Last registered:{" "}
              {new Date(machine.last_seen_at).toLocaleString()}
            </p>

            {/* Session list — hidden when collapsed */}
            {!isCollapsed && (
              <div className="space-y-1">
                {machine.sessions.length > 0 ? (
                  machine.sessions.map((session) => (
                    <MachineListItem
                      key={`${machine.machine_id}:${session.session_id}`}
                      machineId={machine.machine_id}
                      session={session}
                    />
                  ))
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-400">
                    No sessions
                  </p>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
