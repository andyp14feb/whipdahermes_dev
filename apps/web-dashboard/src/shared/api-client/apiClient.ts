import { isApiError } from "./errorEnvelope";

const REQUEST_TIMEOUT_MS = 5000;
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

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
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const response = await fetch(url, {
    headers: { Accept: "application/json", ...init?.headers },
    signal: controller.signal,
    ...init,
  }).finally(() => clearTimeout(timeoutId));

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiError(body)) {
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
}
