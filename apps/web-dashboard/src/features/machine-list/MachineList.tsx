import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteMachine, enqueueCreateTmuxSession, fetchMachines, fetchSessions } from "./machineList.api";
import type { MachineWithSessions } from "./machineList.types";
import { MachineListItem } from "./MachineListItem";
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";
import { useSettingsStore } from "../../shared/state/settingsStore";

type MachineSortMode = "manual" | "name" | "last_seen";
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
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function saveManualMachineOrder(machineIds: string[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(MACHINE_ORDER_STORAGE_KEY, JSON.stringify(machineIds));
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
  const originalIndex = new Map(groups.map((machine, index) => [machine.machine_id, index]));

  if (mode === "manual") {
    const manualIndex = new Map(manualOrder.map((machineId, index) => [machineId, index]));
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
      return (originalIndex.get(a.machine_id) ?? 0) - (originalIndex.get(b.machine_id) ?? 0);
    });
  }

  return [...groups].sort((a, b) => {
    const primary = mode === "name"
      ? a.display_name.localeCompare(b.display_name, undefined, { numeric: true, sensitivity: "base" })
      : new Date(a.last_seen_at).getTime() - new Date(b.last_seen_at).getTime();

    if (primary !== 0) {
      return primary * dir;
    }
    return a.display_name.localeCompare(b.display_name, undefined, { numeric: true, sensitivity: "base" });
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
  const [manualMachineOrder, setManualMachineOrder] = useState<string[]>(loadManualMachineOrder);
  const [draggingMachineId, setDraggingMachineId] = useState<string | null>(null);

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

    return machines.map((m) => ({
      ...m,
      sessions: sessionsByMachine.get(m.machine_id) ?? [],
    }));
  }, [machines, sessions]);

  const orderedMachineGroups = useMemo(
    () => sortMachineGroups(machineGroups, sortMode, sortDirection, manualMachineOrder),
    [machineGroups, manualMachineOrder, sortDirection, sortMode],
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

    const currentIds = orderedMachineGroups.map((machine) => machine.machine_id);
    const fromIndex = currentIds.indexOf(draggingMachineId);
    const toIndex = currentIds.indexOf(targetMachineId);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    updateManualOrder(moveItem(currentIds, fromIndex, toIndex));
  };

  const safeName = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
  const defaultSessionName = () => `whipai-${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}`;

  const handleCreateSession = async (machineId: string) => {
    const requestedName = window.prompt("New tmux session name (blank for default)", "")?.trim() ?? "";
    const sessionName = requestedName || defaultSessionName();
    if (!safeName(sessionName)) {
      setCreateError("Session name must start with a letter or number and contain only letters, numbers, dot, underscore, or hyphen.");
      return;
    }
    setBusyMachineId(machineId);
    setCreateError(null);
    try {
      const response = await enqueueCreateTmuxSession(machineId, sessionName);
      window.alert(`Create tmux session request queued (${response.command_id}). The next heartbeat confirms registration.`);
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to request tmux session creation.");
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
      setDeleteError(error instanceof Error ? error.message : "Failed to remove machine from list.");
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

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Machine order
            </span>
            <Button
              type="button"
              variant="secondary"
              className="px-2 py-1 text-xs"
              onClick={() => setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"))}
              disabled={sortMode === "manual"}
              title={sortMode === "manual" ? "Direction applies to name and last registered sorting." : "Toggle ascending/descending order"}
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
            Drag machine cards to set a custom order, or sort by name / last registered time.
          </p>
        </div>
      </Card>
      {createError && <p role="alert" className="text-xs text-red-600">{createError}</p>}
      {deleteError && <p role="alert" className="text-xs text-red-600">{deleteError}</p>}
      {orderedMachineGroups.map((machine) => (
        <Card
          key={machine.machine_id}
          data-testid={`machine-card-${machine.machine_id}`}
          className={`p-3 transition ${machine.is_stale ? "opacity-60" : ""} ${draggingMachineId === machine.machine_id ? "ring-2 ring-blue-400" : ""}`}
          draggable
          onDragStart={() => handleDragStart(machine.machine_id)}
          onDragOver={(event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            handleDragOver(machine.machine_id);
          }}
          onDragEnd={() => setDraggingMachineId(null)}
        >
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
            Last registered: {new Date(machine.last_seen_at).toLocaleString()}
          </p>
          <div className="space-y-1">
            {machine.sessions.map((session) => (
              <MachineListItem
                key={`${machine.machine_id}:${session.session_id}`}
                machineId={machine.machine_id}
                session={session}
              />
            ))}
            {machine.sessions.length === 0 && (
              <p className="text-xs text-gray-400">No sessions</p>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
