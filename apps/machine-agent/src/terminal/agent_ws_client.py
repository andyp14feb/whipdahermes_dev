from __future__ import annotations

import json
import logging
import threading
import time
from urllib.parse import urlparse, urlunparse

from terminal.tmux_live import TmuxLiveSession, is_atch_session

logger = logging.getLogger(__name__)

# Cap concurrent live tmux streams on this machine.
MAX_LIVE_SESSIONS = 4


def http_to_ws_url(api_url: str, path: str, token: str | None = None) -> str:
    parsed = urlparse(api_url.rstrip("/"))
    scheme = "wss" if parsed.scheme == "https" else "ws"
    netloc = parsed.netloc
    query = f"token={token}" if token else ""
    return urlunparse((scheme, netloc, path, "", query, ""))


class TerminalAgentClient:
    """Outbound WebSocket client from machine-agent to api-server bridge.

    Multiplexes up to MAX_LIVE_SESSIONS simultaneous tmux live streams over a
    single agent WebSocket connection.
    """

    def __init__(
        self,
        api_url: str,
        machine_id: str,
        tmux_socket: str | None,
        token: str | None = None,
        reconnect_seconds: float = 2.0,
        max_live_sessions: int = MAX_LIVE_SESSIONS,
    ) -> None:
        self.api_url = api_url
        self.machine_id = machine_id
        self.tmux_socket = tmux_socket
        self.token = token or ""
        self.reconnect_seconds = reconnect_seconds
        self.max_live_sessions = max_live_sessions
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._ws = None
        self._ws_lock = threading.Lock()
        self._sessions: dict[str, TmuxLiveSession] = {}
        self._sessions_lock = threading.Lock()

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run_forever, name="terminal-agent-ws", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        with self._sessions_lock:
            sessions = list(self._sessions.values())
            self._sessions.clear()
        for session in sessions:
            session.stop()
        with self._ws_lock:
            if self._ws is not None:
                try:
                    self._ws.close()
                except Exception:
                    pass

    def _run_forever(self) -> None:
        try:
            import websocket
        except ImportError:
            logger.error(
                "websocket-client not installed; live terminal disabled. "
                "Install with: pip install websocket-client"
            )
            return

        path = f"/ws/agent/{self.machine_id}"
        url = http_to_ws_url(self.api_url, path, self.token or None)
        logger.info("terminal agent connecting to %s", url.split("?")[0])

        while not self._stop.is_set():
            try:
                ws = websocket.WebSocketApp(
                    url,
                    header=[f"X-WhipAI-Terminal-Token: {self.token}"] if self.token else [],
                    on_open=self._on_open,
                    on_message=self._on_message,
                    on_error=self._on_error,
                    on_close=self._on_close,
                )
                with self._ws_lock:
                    self._ws = ws
                ws.run_forever(ping_interval=20, ping_timeout=10)
            except Exception as exc:
                logger.warning("terminal agent WS loop error: %s", exc)
            with self._ws_lock:
                self._ws = None
            self._stop_all_sessions()
            if self._stop.is_set():
                break
            time.sleep(self.reconnect_seconds)

    def _on_open(self, ws) -> None:
        logger.info("terminal agent WS open machine_id=%s", self.machine_id)
        try:
            ws.send(json.dumps({"type": "hello", "machine_id": self.machine_id}))
        except Exception as exc:
            logger.warning("failed to send hello: %s", exc)

    def _on_error(self, _ws, error) -> None:
        logger.warning("terminal agent WS error: %s", error)

    def _on_close(self, _ws, status_code, msg) -> None:
        logger.info("terminal agent WS closed code=%s msg=%s", status_code, msg)

    def _on_message(self, _ws, message: str) -> None:
        try:
            data = json.loads(message)
        except json.JSONDecodeError:
            return
        if not isinstance(data, dict):
            return

        msg_type = data.get("type")
        session_id = str(data.get("session_id", ""))
        if msg_type == "subscribe" and session_id:
            self._subscribe(session_id)
        elif msg_type == "unsubscribe" and session_id:
            self._unsubscribe(session_id)
        elif msg_type == "input" and session_id:
            self._input(session_id, str(data.get("data", "")))
        elif msg_type == "resize" and session_id:
            self._resize(session_id, int(data.get("cols", 80)), int(data.get("rows", 24)))

    def _send(self, payload: dict) -> None:
        # Hold the lock for the entire send — multiple TmuxLiveSession threads
        # emit concurrently when several Lives are open.
        raw = json.dumps(payload)
        with self._ws_lock:
            ws = self._ws
            if ws is None:
                return
            try:
                ws.send(raw)
            except Exception as exc:
                logger.debug("terminal agent send failed: %s", exc)

    def _subscribe(self, session_id: str) -> None:
        if is_atch_session(session_id):
            self._send(
                {
                    "type": "error",
                    "session_id": session_id,
                    "message": "Live terminal is not supported for atch sessions (tmux only).",
                }
            )
            return

        existing: TmuxLiveSession | None = None
        with self._sessions_lock:
            if session_id in self._sessions:
                existing = self._sessions[session_id]
            elif len(self._sessions) >= self.max_live_sessions:
                self._send(
                    {
                        "type": "error",
                        "session_id": session_id,
                        "message": (
                            f"Max {self.max_live_sessions} concurrent live terminals "
                            f"per machine"
                        ),
                    }
                )
                return
            else:
                live = TmuxLiveSession(
                    session_id=session_id,
                    tmux_socket=self.tmux_socket,
                    on_output=self._emit_output,
                    on_error=self._emit_error,
                    on_ready=self._emit_ready,
                    on_snapshot=self._emit_snapshot,
                )
                self._sessions[session_id] = live
                live.start()
                logger.info(
                    "terminal agent subscribed session_id=%s active=%s/%s",
                    session_id,
                    len(self._sessions),
                    self.max_live_sessions,
                )
                return

        # Already streaming — refresh snapshot/ready for a new (or reconnected) viewer.
        if existing is not None:
            existing.refresh_for_viewer()

    def _unsubscribe(self, session_id: str) -> None:
        with self._sessions_lock:
            live = self._sessions.pop(session_id, None)
        if live:
            live.stop()
            logger.info("terminal agent unsubscribed session_id=%s", session_id)

    def _input(self, session_id: str, data: str) -> None:
        with self._sessions_lock:
            live = self._sessions.get(session_id)
        if live:
            live.send_input(data)

    def _resize(self, session_id: str, cols: int, rows: int) -> None:
        with self._sessions_lock:
            live = self._sessions.get(session_id)
        if live:
            live.resize(cols, rows)

    def _stop_all_sessions(self) -> None:
        with self._sessions_lock:
            sessions = list(self._sessions.values())
            self._sessions.clear()
        for session in sessions:
            session.stop()

    def _emit_output(self, session_id: str, data: str) -> None:
        self._send({"type": "output", "session_id": session_id, "data": data})

    def _emit_error(self, session_id: str, message: str) -> None:
        self._send({"type": "error", "session_id": session_id, "message": message})

    def _emit_ready(self, session_id: str) -> None:
        self._send({"type": "ready", "session_id": session_id})

    def _emit_snapshot(self, session_id: str, data: str) -> None:
        self._send({"type": "snapshot", "session_id": session_id, "data": data})
