from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field

from fastapi import WebSocket

logger = logging.getLogger(__name__)

# Cap concurrent live session streams per machine (distinct session_ids).
MAX_LIVE_SESSIONS_PER_MACHINE = 4


@dataclass
class TerminalHub:
    """In-memory bridge between machine-agent WS and browser terminal WS.

    Supports multiple simultaneous session streams per machine (up to
    MAX_LIVE_SESSIONS_PER_MACHINE) and multiple browser viewers per session.
    """

    _agents: dict[str, WebSocket] = field(default_factory=dict)
    _browsers: dict[tuple[str, str], set[WebSocket]] = field(default_factory=dict)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def register_agent(self, machine_id: str, ws: WebSocket) -> None:
        async with self._lock:
            old = self._agents.get(machine_id)
            self._agents[machine_id] = ws
        if old is not None and old is not ws:
            try:
                await old.close(code=4000, reason="replaced by new agent connection")
            except Exception:
                pass
        logger.info("terminal hub: agent registered machine_id=%s", machine_id)

    async def unregister_agent(self, machine_id: str, ws: WebSocket) -> None:
        async with self._lock:
            if self._agents.get(machine_id) is ws:
                self._agents.pop(machine_id, None)
        logger.info("terminal hub: agent unregistered machine_id=%s", machine_id)

    async def register_browser(
        self, machine_id: str, session_id: str, ws: WebSocket
    ) -> str | None:
        """Register a browser viewer.

        Returns an error message if rejected (e.g. over capacity), else None.
        Multiple browsers may watch the same (machine_id, session_id).
        """
        key = (machine_id, session_id)
        async with self._lock:
            existing_sessions = {
                sid for (mid, sid) in self._browsers.keys() if mid == machine_id
            }
            if (
                session_id not in existing_sessions
                and len(existing_sessions) >= MAX_LIVE_SESSIONS_PER_MACHINE
            ):
                return (
                    f"Max {MAX_LIVE_SESSIONS_PER_MACHINE} concurrent live terminals "
                    f"per machine"
                )
            self._browsers.setdefault(key, set()).add(ws)
        logger.info(
            "terminal hub: browser registered machine_id=%s session_id=%s viewers=%s",
            machine_id,
            session_id,
            len(self._browsers.get(key, ())),
        )
        return None

    async def unregister_browser(
        self, machine_id: str, session_id: str, ws: WebSocket
    ) -> bool:
        """Unregister a browser viewer.

        Returns True if this was the last viewer for the session (caller should
        unsubscribe the agent stream).
        """
        key = (machine_id, session_id)
        async with self._lock:
            bucket = self._browsers.get(key)
            if not bucket or ws not in bucket:
                return False
            bucket.discard(ws)
            if bucket:
                return False
            self._browsers.pop(key, None)
        logger.info(
            "terminal hub: browser unregistered machine_id=%s session_id=%s (last viewer)",
            machine_id,
            session_id,
        )
        return True

    def get_agent(self, machine_id: str) -> WebSocket | None:
        return self._agents.get(machine_id)

    def get_browsers(self, machine_id: str, session_id: str) -> list[WebSocket]:
        return list(self._browsers.get((machine_id, session_id), ()))

    def get_browser(self, machine_id: str, session_id: str) -> WebSocket | None:
        """Return one browser for the session (compat / single-viewer helpers)."""
        browsers = self.get_browsers(machine_id, session_id)
        return browsers[0] if browsers else None

    def browser_sessions_for_machine(self, machine_id: str) -> list[str]:
        return [sid for (mid, sid) in self._browsers if mid == machine_id]

    def live_session_count(self, machine_id: str) -> int:
        return len(self.browser_sessions_for_machine(machine_id))


_hub = TerminalHub()


def get_terminal_hub() -> TerminalHub:
    return _hub
