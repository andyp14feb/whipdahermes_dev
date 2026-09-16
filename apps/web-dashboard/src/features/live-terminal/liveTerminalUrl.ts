/** Build browser WebSocket URL for live terminal spike. */

function resolveWsBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured, window.location.origin);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      return url.origin;
    } catch {
      /* fall through */
    }
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}`;
}

export function buildLiveTerminalWsUrl(
  machineId: string,
  sessionId: string,
  token?: string,
): string {
  const base = resolveWsBase();
  const path = `/ws/terminal/${encodeURIComponent(machineId)}/${sessionId
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  const effectiveToken =
    token?.trim() ||
    import.meta.env.VITE_WHIPAI_TERMINAL_TOKEN?.trim() ||
    "";
  if (effectiveToken) {
    url.searchParams.set("token", effectiveToken);
  }
  return url.toString();
}
