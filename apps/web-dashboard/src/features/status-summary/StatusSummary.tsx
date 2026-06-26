import type { StatusValue } from "../../shared/types/contracts";
import { StatusBadge } from "./StatusBadge";
import { IdleTimer } from "./IdleTimer";

interface StatusSummaryProps {
  status: StatusValue;
  secondsSinceChange: number;
}

export function StatusSummary({ status, secondsSinceChange }: StatusSummaryProps) {
  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={status} />
      <IdleTimer seconds={secondsSinceChange} />
    </div>
  );
}
