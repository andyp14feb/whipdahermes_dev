export type { StatusValue } from "../../shared/types/contracts";
import type { StatusValue } from "../../shared/types/contracts";

export const STATUS_COLORS: Record<StatusValue, { bg: string; text: string }> = {
  active: { bg: "bg-green-100", text: "text-green-800" },
  stable: { bg: "bg-blue-100", text: "text-blue-800" },
  waiting: { bg: "bg-yellow-100", text: "text-yellow-800" },
  waiting_input: { bg: "bg-amber-100", text: "text-amber-800" },
  stuck: { bg: "bg-red-100", text: "text-red-800" },
  stale: { bg: "bg-gray-100", text: "text-gray-800" },
  unknown: { bg: "bg-gray-100", text: "text-gray-800" },
};
