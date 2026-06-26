export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export function isApiError(body: unknown): body is { error: ApiError } {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as Record<string, unknown>).error === "object"
  );
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "Unknown error";
}
