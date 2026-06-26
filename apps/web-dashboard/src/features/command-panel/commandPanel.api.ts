import { apiClient } from "../../shared/api-client/apiClient";
import type { CommandResponse } from "../../shared/types/contracts";
import type { CommandSubmission } from "./commandPanel.types";

export function sendCommand(
  machineId: string,
  sessionId: string,
  payload: string,
): Promise<CommandResponse> {
  const body: CommandSubmission = {
    machine_id: machineId,
    session_id: sessionId,
    payload,
  };
  return apiClient<CommandResponse>("/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getCommandStatus(
  commandId: string,
): Promise<CommandResponse> {
  return apiClient<CommandResponse>(`/commands/${commandId}`);
}
