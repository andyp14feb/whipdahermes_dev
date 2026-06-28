import { useQuery } from "@tanstack/react-query";
import { fetchMachines, fetchSessions } from "./machineList.api";
import type { MachineWithSessions } from "./machineList.types";
import { MachineListItem } from "./MachineListItem";
import { Card } from "../../shared/ui/Card";
import { useSettingsStore } from "../../shared/state/settingsStore";

export function MachineList() {
  const refreshIntervalMs = useSettingsStore((s) => s.refreshIntervalMs);

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

  return (
    <div className="space-y-3">
      {machineGroups.map((machine) => (
        <Card
          key={machine.machine_id}
          className={`p-3 ${machine.is_stale ? "opacity-60" : ""}`}
        >
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            {machine.display_name}
            <span className="ml-1 font-normal text-gray-400">
              ({machine.sessions.length})
            </span>
            {machine.is_stale && (
              <span className="ml-2 inline-flex items-center rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                stale
              </span>
            )}
          </h3>
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
