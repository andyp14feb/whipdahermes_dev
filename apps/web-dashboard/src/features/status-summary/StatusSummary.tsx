import type { StatusValue } from "../../shared/types/contracts";
import { StatusBadge } from "./StatusBadge";
import { IdleTimer } from "./IdleTimer";

interface StatusSummaryProps {
  status: StatusValue;
  secondsSinceChange: number;
  className?: string;
}

export function StatusSummary({ status, secondsSinceChange, className = "" }: StatusSummaryProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <StatusBadge status={status} />
      <IdleTimer seconds={secondsSinceChange} />
    </div>
  );
}
