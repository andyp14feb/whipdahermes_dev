import { apiClient } from "../../shared/api-client/apiClient";
import type { SessionDetail } from "../../shared/types/contracts";

export function fetchSessionDetail(
  machineId: string,
  sessionId: string,
): Promise<SessionDetail> {
  return apiClient<SessionDetail>(`/sessions/${machineId}/${sessionId}`);
}
