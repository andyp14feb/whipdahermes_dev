import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { buildLiveTerminalWsUrl } from "./liveTerminalUrl";
import { Button } from "../../shared/ui/Button";

export interface LiveTerminalProps {
  machineId: string;
  sessionId: string;
  heightPx?: number;
  onClose?: () => void;
}

type ConnStatus =
  | "connecting"
  | "waiting_agent"
  | "ready"
  | "agent_disconnected"
  | "error"
  | "closed";

function fitAndFocus(term: Terminal, fit: FitAddon, ws?: WebSocket | null) {
  try {
    fit.fit();
  } catch {
    /* ignore fit races before layout */
  }
  term.focus();
  const dims = fit.proposeDimensions();
  if (dims && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
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

    const wsUrl = buildLiveTerminalWsUrl(machineId, sessionId);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setStatus("connecting");
    setErrorMessage(null);

    // Fit after layout so cols/rows match the visible host (avoids caret at bottom).
    const scheduleFit = () => {
      requestAnimationFrame(() => {
        fitAndFocus(term, fit, wsRef.current);
      });
    };
    scheduleFit();

    ws.onopen = () => {
      scheduleFit();
    };

    ws.onmessage = (event) => {
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
          scheduleFit();
        }
      }
    };

    ws.onerror = () => {
      setStatus("error");
      setErrorMessage("WebSocket error");
    };

    ws.onclose = () => {
      setStatus((prev) => (prev === "error" ? prev : "closed"));
      wsRef.current = null;
    };

    const dataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    const onResize = () => {
      fitAndFocus(term, fit, wsRef.current);
    };
    window.addEventListener("resize", onResize);

    let resizeObserver: ResizeObserver | null = null;
    let fitRaf = 0;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      // Debounce: fit.fit() can change layout and re-trigger the observer (UI freeze).
      resizeObserver = new ResizeObserver(() => {
        if (fitRaf) cancelAnimationFrame(fitRaf);
        fitRaf = requestAnimationFrame(() => {
          fitRaf = 0;
          fitAndFocus(term, fit, wsRef.current);
        });
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      if (fitRaf) cancelAnimationFrame(fitRaf);
      resizeObserver?.disconnect();
      dataDisposable.dispose();
      try {
        ws.close();
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
    requestAnimationFrame(() => {
      fitAndFocus(term, fit, wsRef.current);
    });
  }, [heightPx]);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Live - {status}
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
