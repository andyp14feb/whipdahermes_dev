import { apiClient } from "../../shared/api-client/apiClient";
import type { MachinesResponse, SessionsResponse } from "./machineList.types";

export function fetchMachines(): Promise<MachinesResponse> {
  return apiClient<MachinesResponse>("/machines");
}

export function fetchSessions(): Promise<SessionsResponse> {
  return apiClient<SessionsResponse>("/sessions");
}
