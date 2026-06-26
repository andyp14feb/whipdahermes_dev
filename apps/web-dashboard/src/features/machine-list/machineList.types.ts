export type { Machine, SessionListItem } from "../../shared/types/contracts";
import type { Machine, SessionListItem } from "../../shared/types/contracts";

export interface MachinesResponse {
  machines: Machine[];
}

export interface SessionsResponse {
  sessions: SessionListItem[];
}

export interface MachineWithSessions extends Machine {
  sessions: SessionListItem[];
}
