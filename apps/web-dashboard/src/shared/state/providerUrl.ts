import type { AiProviderType } from "./settingsStore";

const DEFAULT_ENDPOINTS: Record<AiProviderType, string> = {
  "openai-compatible": "/v1",
  "anthropic-compatible": "/v1",
  "gemini-compatible": "/v1",
  "ollama-compatible": "/api",
  "9router-compatible": "/v1",
};

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

export function normalizeProviderBaseUrl(baseUrl: string, providerType: AiProviderType): string {
  const trimmed = trimTrailingSlashes(baseUrl.trim());
  if (!trimmed) return "";

  const defaultEndpoint = DEFAULT_ENDPOINTS[providerType];
  if (!defaultEndpoint) return trimmed;

  if (trimmed.toLowerCase().endsWith(defaultEndpoint.toLowerCase())) {
    return trimmed.slice(0, trimmed.length - defaultEndpoint.length) || trimmed;
  }

  return trimmed;
}

export function buildProviderUrl(baseUrl: string, providerType: AiProviderType, endpoint: string): string {
  const normalizedBaseUrl = normalizeProviderBaseUrl(baseUrl, providerType);
  if (!normalizedBaseUrl) return endpoint;
  return new URL(endpoint, `${normalizedBaseUrl}/`).toString();
}
