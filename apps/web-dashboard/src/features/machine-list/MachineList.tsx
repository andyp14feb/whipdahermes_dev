import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteMachine, enqueueCreateTmuxSession, fetchMachines, fetchSessions } from "./machineList.api";
import type { MachineWithSessions } from "./machineList.types";
import { MachineListItem } from "./MachineListItem";
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";
import { useSettingsStore } from "../../shared/state/settingsStore";

export function MachineList() {
  const refreshIntervalMs = useSettingsStore((s) => s.refreshIntervalMs);
  const queryClient = useQueryClient();
  const [busyMachineId, setBusyMachineId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  if (isLoading) {
    return (
      <Card className="p-4">
        <p className="text-sm text-gray-500">Loading machines...</p>
      </Card>
    );
  }

  const machines = machinesQuery.data?.machines ?? [];
  const sessions = sessionsQuery.data?.sessions ?? [];

  const sessionsByMachine = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const list = sessionsByMachine.get(s.machine_id) ?? [];
    list.push(s);
    sessionsByMachine.set(s.machine_id, list);
  }

  const machineGroups: MachineWithSessions[] = machines.map((m) => ({
    ...m,
    sessions: sessionsByMachine.get(m.machine_id) ?? [],
  }));

  if (machineGroups.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-gray-500">No machines found.</p>
      </Card>
    );
  }

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

  return (
    <div className="space-y-3">
      {createError && <p role="alert" className="text-xs text-red-600">{createError}</p>}
      {deleteError && <p role="alert" className="text-xs text-red-600">{deleteError}</p>}
      {machineGroups.map((machine) => (
        <Card
          key={machine.machine_id}
          className={`p-3 ${machine.is_stale ? "opacity-60" : ""}`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
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
            <div className="flex items-center gap-1">
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
                className="rounded px-1.5 py-1 text-xs text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                disabled={busyMachineId === machine.machine_id}
                onClick={() => handleDeleteMachine(machine.machine_id)}
              >
                ×
              </button>
            </div>
          </div>
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
