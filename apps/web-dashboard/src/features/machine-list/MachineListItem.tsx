import { useAppStore } from "../../shared/state/appStore";
import { StatusSummary } from "../status-summary/StatusSummary";
import type { SessionListItem } from "../../shared/types/contracts";

interface MachineListItemProps {
  machineId: string;
  session: SessionListItem;
}

export function MachineListItem({ machineId, session }: MachineListItemProps) {
  const { selectedMachineId, selectedSessionId, setSelectedSession } = useAppStore();
  const isSelected =
    selectedMachineId === machineId && selectedSessionId === session.session_id;

  return (
    <button
      type="button"
      onClick={() => setSelectedSession(machineId, session.session_id)}
      className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
        isSelected
          ? "bg-blue-50 ring-1 ring-blue-300"
          : "hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium text-gray-800">
          {session.label}
        </span>
        <StatusSummary
          status={session.status}
          secondsSinceChange={session.seconds_since_change}
        />
      </div>
    </button>
  );
}
