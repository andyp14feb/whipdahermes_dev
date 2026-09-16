from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from modules.terminal_bridge.auth import check_terminal_token
from modules.terminal_bridge.hub import get_terminal_hub

logger = logging.getLogger(__name__)


def _safe_json(raw: str) -> dict[str, Any] | None:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


async def _fanout_json(browsers: list[WebSocket], payload: dict[str, Any]) -> None:
    for browser in browsers:
        try:
            await browser.send_json(payload)
        except Exception:
            pass


def create_terminal_ws_router() -> APIRouter:
    router = APIRouter(tags=["terminal"])
    hub = get_terminal_hub()

    @router.websocket("/ws/agent/{machine_id}")
    async def agent_ws(websocket: WebSocket, machine_id: str) -> None:
        if not check_terminal_token(websocket):
            await websocket.close(code=4401, reason="invalid terminal token")
            return

        await websocket.accept()
        await hub.register_agent(machine_id, websocket)

        # Re-subscribe any browsers already waiting for this machine.
        for session_id in hub.browser_sessions_for_machine(machine_id):
            browsers = hub.get_browsers(machine_id, session_id)
            await _fanout_json(browsers, {"type": "status", "status": "connecting"})
            try:
                await websocket.send_json({"type": "subscribe", "session_id": session_id})
            except Exception as exc:
                logger.warning("failed to re-subscribe session_id=%s: %s", session_id, exc)

        try:
            while True:
                raw = await websocket.receive_text()
                msg = _safe_json(raw)
                if msg is None:
                    continue

                msg_type = msg.get("type")
                session_id = str(msg.get("session_id", ""))
                if not session_id:
                    continue

                browsers = hub.get_browsers(machine_id, session_id)
                if not browsers:
                    continue

                if msg_type == "output":
                    await _fanout_json(
                        browsers, {"type": "output", "data": msg.get("data", "")}
                    )
                elif msg_type == "error":
                    await _fanout_json(
                        browsers,
                        {
                            "type": "error",
                            "message": str(msg.get("message", "agent error")),
                        },
                    )
                elif msg_type == "ready":
                    await _fanout_json(browsers, {"type": "status", "status": "ready"})
                elif msg_type == "snapshot":
                    await _fanout_json(
                        browsers, {"type": "snapshot", "data": msg.get("data", "")}
                    )
        except WebSocketDisconnect:
            logger.info("agent WS disconnected machine_id=%s", machine_id)
        finally:
            await hub.unregister_agent(machine_id, websocket)
            for session_id in hub.browser_sessions_for_machine(machine_id):
                browsers = hub.get_browsers(machine_id, session_id)
                await _fanout_json(
                    browsers, {"type": "status", "status": "agent_disconnected"}
                )

    @router.websocket("/ws/terminal/{machine_id}/{session_id:path}")
    async def browser_ws(websocket: WebSocket, machine_id: str, session_id: str) -> None:
        if not check_terminal_token(websocket):
            await websocket.close(code=4401, reason="invalid terminal token")
            return

        await websocket.accept()
        reject = await hub.register_browser(machine_id, session_id, websocket)
        if reject:
            await websocket.send_json({"type": "error", "message": reject})
            await websocket.close(code=4408, reason="live capacity exceeded")
            return

        agent = hub.get_agent(machine_id)
        if agent is None:
            await websocket.send_json({"type": "status", "status": "waiting_agent"})
        else:
            await websocket.send_json({"type": "status", "status": "connecting"})
            try:
                await agent.send_json({"type": "subscribe", "session_id": session_id})
            except Exception as exc:
                await websocket.send_json(
                    {"type": "error", "message": f"failed to reach agent: {exc}"}
                )

        try:
            while True:
                raw = await websocket.receive_text()
                msg = _safe_json(raw)
                if msg is None:
                    # Treat bare text as raw input keystrokes.
                    agent = hub.get_agent(machine_id)
                    if agent is not None:
                        await agent.send_json(
                            {"type": "input", "session_id": session_id, "data": raw}
                        )
                    continue

                msg_type = msg.get("type")
                agent = hub.get_agent(machine_id)
                if agent is None:
                    await websocket.send_json(
                        {"type": "status", "status": "waiting_agent"}
                    )
                    continue

                if msg_type == "input":
                    await agent.send_json(
                        {
                            "type": "input",
                            "session_id": session_id,
                            "data": str(msg.get("data", "")),
                        }
                    )
                elif msg_type == "resize":
                    await agent.send_json(
                        {
                            "type": "resize",
                            "session_id": session_id,
                            "cols": int(msg.get("cols", 80)),
                            "rows": int(msg.get("rows", 24)),
                        }
                    )
                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
        except WebSocketDisconnect:
            logger.info(
                "browser WS disconnected machine_id=%s session_id=%s",
                machine_id,
                session_id,
            )
        finally:
            last_viewer = await hub.unregister_browser(machine_id, session_id, websocket)
            if last_viewer:
                agent = hub.get_agent(machine_id)
                if agent is not None:
                    try:
                        await agent.send_json(
                            {"type": "unsubscribe", "session_id": session_id}
                        )
                    except Exception:
                        pass

    return router
