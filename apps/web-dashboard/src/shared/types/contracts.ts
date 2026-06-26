export type StatusValue =
  | "active"
  | "stable"
  | "waiting"
  | "waiting_input"
  | "stuck"
  | "stale"
  | "unknown";

export interface Machine {
  machine_id: string;
  display_name: string;
  last_seen_at: string;
  session_count: number;
}

export interface SessionListItem {
  machine_id: string;
  session_id: string;
  label: string;
  status: StatusValue;
  seconds_since_change: number;
  last_seen_at: string;
}

export interface SessionDetail {
  machine_id: string;
  session_id: string;
  label: string;
  status: StatusValue;
  seconds_since_change: number;
  preview: string;
  cwd: string;
  last_seen_at: string;
}
