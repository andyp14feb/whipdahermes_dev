import { apiClient } from "../../shared/api-client/apiClient";
import { useSettingsStore } from "../../shared/state/settingsStore";
import type { SessionDetail } from "../../shared/types/contracts";

export function fetchSessionDetail(
  machineId: string,
  sessionId: string,
): Promise<SessionDetail> {
  return apiClient<SessionDetail>(`/sessions/${machineId}/${sessionId}`);
}

export function assessSession(
  machineId: string,
  sessionId: string,
): Promise<SessionDetail> {
  const { aiProviderBaseUrl, aiProviderType, aiApiKey, aiSelectedModel } = useSettingsStore.getState();

  return apiClient<SessionDetail>(
    `/assess/${machineId}/${sessionId}`,
    {
      method: "POST",
      headers: {
        ...(aiProviderType ? { "x-ai-provider-type": aiProviderType } : {}),
        ...(aiProviderBaseUrl
          ? { "x-ai-provider-base-url": aiProviderBaseUrl }
          : {}),
        ...(aiApiKey ? { "x-ai-api-key": aiApiKey } : {}),
        ...(aiSelectedModel ? { "x-ai-model": aiSelectedModel } : {}),
      },
    },
    40000,
  );
}
