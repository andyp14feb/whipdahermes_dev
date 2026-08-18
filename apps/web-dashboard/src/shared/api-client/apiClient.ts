import { isApiError } from "./errorEnvelope";

const REQUEST_TIMEOUT_MS = 5000;

function resolveBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    return "";
  }

  if (typeof window !== "undefined") {
    try {
      const configuredUrl = new URL(configuredBaseUrl, window.location.origin);
      const currentHost = window.location.hostname;
      const configuredHost = configuredUrl.hostname;
      const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

      if (
        localHosts.has(configuredHost) &&
        !localHosts.has(currentHost)
      ) {
        return "";
      }
    } catch {
      return "";
    }
  }

  return configuredBaseUrl;
}

const BASE_URL = resolveBaseUrl();

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiClient<T>(
  path: string,
  init?: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...init?.headers },
      signal: controller.signal,
      ...init,
    }).finally(() => clearTimeout(timeoutId));

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      if (isApiError(body) && body.error) {
        throw new ApiRequestError(
          body.error.code,
          body.error.message,
          response.status,
        );
      }
      throw new ApiRequestError(
        "HTTP_ERROR",
        `Request failed with status ${response.status}`,
        response.status,
      );
    }

    return body as T;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const message = error instanceof Error ? error.message : "";
    if (name === "AbortError" || message.toLowerCase().includes("signal is aborted")) {
      throw new ApiRequestError("ABORTED", "Request timed out or was cancelled");
    }
    throw error;
  }
}
