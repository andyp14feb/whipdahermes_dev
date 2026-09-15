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
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 13,
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
      },
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    const wsUrl = buildLiveTerminalWsUrl(machineId, sessionId);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setStatus("connecting");
    setErrorMessage(null);

    ws.onopen = () => {
      const dims = fit.proposeDimensions();
      if (dims) {
        ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
      }
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
      } else if (msg.type === "error") {
        setStatus("error");
        setErrorMessage(msg.message || "Terminal error");
        term.writeln(`\r\n\x1b[31m${msg.message || "Terminal error"}\x1b[0m`);
      } else if (msg.type === "status") {
        const next = (msg.status || "connecting") as ConnStatus;
        setStatus(next);
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
      fit.fit();
      const dims = fit.proposeDimensions();
      if (dims && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
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

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Live · {status}
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
        className="overflow-hidden rounded border border-gray-700 bg-[#1e1e1e]"
        style={{ height: `${heightPx}px` }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
