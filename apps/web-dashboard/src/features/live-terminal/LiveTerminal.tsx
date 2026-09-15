import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { buildLiveTerminalWsUrl } from "./liveTerminalUrl";
import {
  FATAL_CLOSE_CODES,
  RESIZE_DEBOUNCE_MS,
  reconnectDelayMs,
} from "./liveTerminalReconnect";
import { Button } from "../../shared/ui/Button";

export interface LiveTerminalProps {
  machineId: string;
  sessionId: string;
  heightPx?: number;
  onClose?: () => void;
}

export type ConnStatus =
  | "connecting"
  | "waiting_agent"
  | "ready"
  | "reconnecting"
  | "agent_disconnected"
  | "error"
  | "closed";


function statusLabel(status: ConnStatus): string {
  switch (status) {
    case "connecting":
      return "connecting";
    case "waiting_agent":
      return "waiting for agent";
    case "ready":
      return "ready";
    case "reconnecting":
      return "reconnecting…";
    case "agent_disconnected":
      return "agent disconnected";
    case "error":
      return "error";
    case "closed":
      return "closed";
    default:
      return status;
  }
}

export function LiveTerminal({
  machineId,
  sessionId,
  heightPx = 384,
  onClose,
}: LiveTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 13,
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        cursorAccent: "#1e1e1e",
      },
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    termRef.current = term;
    fitRef.current = fit;

    let disposed = false;
    let intentionalClose = false;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let lastSentCols = 0;
    let lastSentRows = 0;
    let fitRaf = 0;

    const clearReconnectTimer = () => {
      if (reconnectTimer != null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const clearResizeTimer = () => {
      if (resizeTimer != null) {
        clearTimeout(resizeTimer);
        resizeTimer = null;
      }
    };

    const sendResizeDebounced = (cols: number, rows: number) => {
      if (!cols || !rows) return;
      if (cols === lastSentCols && rows === lastSentRows) return;
      clearResizeTimer();
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        if (cols === lastSentCols && rows === lastSentRows) return;
        lastSentCols = cols;
        lastSentRows = rows;
        try {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
        } catch {
          /* ignore send races during close */
        }
      }, RESIZE_DEBOUNCE_MS);
    };

    const fitAndFocus = () => {
      try {
        fit.fit();
      } catch {
        /* ignore fit races before layout */
      }
      term.focus();
      const dims = fit.proposeDimensions();
      if (dims) {
        sendResizeDebounced(dims.cols, dims.rows);
      }
    };

    const scheduleFit = () => {
      requestAnimationFrame(() => {
        if (!disposed) fitAndFocus();
      });
    };

    const openSocket = () => {
      if (disposed || intentionalClose) return;
      clearReconnectTimer();
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }

      const wsUrl = buildLiveTerminalWsUrl(machineId, sessionId);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      if (reconnectAttempt > 0) {
        setStatus("reconnecting");
      } else {
        setStatus("connecting");
        setErrorMessage(null);
      }

      ws.onopen = () => {
        if (disposed) return;
        reconnectAttempt = 0;
        setErrorMessage(null);
        setStatus((prev) =>
          prev === "reconnecting" || prev === "closed" || prev === "error"
            ? "connecting"
            : prev,
        );
        // Force resize after reconnect (tmux stream may have restarted).
        lastSentCols = 0;
        lastSentRows = 0;
        scheduleFit();
      };

      ws.onmessage = (event) => {
        if (disposed) return;
        let msg: { type?: string; data?: string; message?: string; status?: string };
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          term.write(String(event.data));
          return;
        }

        if (msg.type === "output" && typeof msg.data === "string") {
          term.write(msg.data);
        } else if (msg.type === "snapshot" && typeof msg.data === "string") {
          term.reset();
          term.write(msg.data.replace(/\n/g, "\r\n"));
          scheduleFit();
        } else if (msg.type === "error") {
          setStatus("error");
          setErrorMessage(msg.message || "Terminal error");
          term.writeln(`\r\n\x1b[31m${msg.message || "Terminal error"}\x1b[0m`);
        } else if (msg.type === "status") {
          const next = (msg.status || "connecting") as ConnStatus;
          setStatus(next);
          if (next === "ready") {
            setErrorMessage(null);
            scheduleFit();
          }
        }
      };

      ws.onerror = () => {
        if (disposed || intentionalClose) return;
        setErrorMessage((prev) => prev ?? "WebSocket error");
      };

      ws.onclose = (ev) => {
        if (disposed) return;
        wsRef.current = null;
        if (intentionalClose) {
          setStatus("closed");
          return;
        }
        if (FATAL_CLOSE_CODES.has(ev.code)) {
          setStatus("error");
          setErrorMessage((prev) => prev || ev.reason || `Closed (${ev.code})`);
          return;
        }
        setStatus("reconnecting");
        clearReconnectTimer();
        const delay = reconnectDelayMs(reconnectAttempt);
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (!disposed && !intentionalClose) {
            openSocket();
          }
        }, delay);
      };
    };

    const dataDisposable = term.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    const onWindowResize = () => {
      fitAndFocus();
    };
    window.addEventListener("resize", onWindowResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      // Debounce: fit.fit() can change layout and re-trigger the observer (UI freeze).
      resizeObserver = new ResizeObserver(() => {
        if (fitRaf) cancelAnimationFrame(fitRaf);
        fitRaf = requestAnimationFrame(() => {
          fitRaf = 0;
          if (!disposed) fitAndFocus();
        });
      });
      resizeObserver.observe(containerRef.current);
    }

    openSocket();
    scheduleFit();

    return () => {
      disposed = true;
      intentionalClose = true;
      clearReconnectTimer();
      clearResizeTimer();
      window.removeEventListener("resize", onWindowResize);
      if (fitRaf) cancelAnimationFrame(fitRaf);
      resizeObserver?.disconnect();
      dataDisposable.dispose();
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      wsRef.current = null;
    };
  }, [machineId, sessionId]);

  // Re-fit when parent height changes (window resize handle).
  useEffect(() => {
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) return;
    const id = requestAnimationFrame(() => {
      try {
        fit.fit();
      } catch {
        /* ignore */
      }
      term.focus();
      const dims = fit.proposeDimensions();
      const ws = wsRef.current;
      if (dims && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }),
        );
      }
    });
    return () => cancelAnimationFrame(id);
  }, [heightPx]);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-xs font-medium text-gray-600 dark:text-gray-300"
          data-testid="live-terminal-status"
          data-status={status}
        >
          Live — {statusLabel(status)}
        </span>
        {errorMessage && (
          <span className="text-xs text-red-600" role="alert">
            {errorMessage}
          </span>
        )}
        <span className="flex-1" />
        {onClose && (
          <Button
            type="button"
            variant="secondary"
            className="px-2 py-1 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            Close Live
          </Button>
        )}
      </div>
      <div
        ref={containerRef}
        className="live-terminal-host overflow-hidden rounded border border-gray-700 bg-[#1e1e1e]"
        style={{ height: `${heightPx}px` }}
        onClick={(e) => {
          e.stopPropagation();
          termRef.current?.focus();
        }}
      />
    </div>
  );
}
