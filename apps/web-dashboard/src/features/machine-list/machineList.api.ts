import { apiClient } from "../../shared/api-client/apiClient";

export function fetchMachines(): Promise<MachinesResponse> {
  return apiClient<MachinesResponse>("/machines");
}
export function fetchSessions(): Promise<SessionsResponse> {
  return apiClient<SessionsResponse>("/sessions");
}
export function deleteSession(machineId: string, sessionId: string): Promise<void> {
  return apiClient<void>(`/sessions/${encodeURIComponent(machineId)}/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
}
export function deleteMachine(machineId: string): Promise<{ status: string; machine_id: string }> {
  return apiClient(`/machines/${encodeURIComponent(machineId)}`, { method: "DELETE" });
}
export function enqueueCreateTmuxSession(machineId: string, sessionName: string): Promise<{ command_id: string; state: string; target: string }> {
  return apiClient("/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ machine_id: machineId, session_id: sessionName, payload: `__whipai__:create_session:${sessionName}` }),
  });
}
export function enqueueRenameTmuxSession(
  machineId: string,
  currentSessionName: string,
  newSessionName: string,
): Promise<{ command_id: string; state: string; target: string }> {
  return apiClient("/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      machine_id: machineId,
      session_id: currentSessionName,
      payload: `__whipai__:rename_session:${currentSessionName}|${newSessionName}`,
    }),
  });
}
export function cleanupStaleSessions(thresholdSeconds?: number): Promise<{deleted: number, message: string}> {
  return apiClient<{deleted: number, message: string}>("/admin/session-cleanup", {
    method: "POST",
    body: JSON.stringify({ threshold_seconds: thresholdSeconds ?? 300 }),
  });
}