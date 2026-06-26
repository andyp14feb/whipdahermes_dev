import { Badge } from "../../shared/ui/Badge";
import type { StatusValue } from "../../shared/types/contracts";
import { STATUS_COLORS } from "./statusSummary.types";

interface StatusBadgeProps {
  status: StatusValue;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.unknown;

  return (
    <Badge className={`${colors.bg} ${colors.text}`}>
      {status.replace("_", " ")}
    </Badge>
  );
}
