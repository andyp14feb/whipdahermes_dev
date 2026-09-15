from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class TerminalHub:
    """In-memory bridge between machine-agent WS and browser terminal WS."""

    _agents: dict[str, WebSocket] = field(default_factory=dict)
    _browsers: dict[tuple[str, str], WebSocket] = field(default_factory=dict)
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

    async def register_browser(self, machine_id: str, session_id: str, ws: WebSocket) -> None:
        key = (machine_id, session_id)
        async with self._lock:
            old = self._browsers.get(key)
            self._browsers[key] = ws
        if old is not None and old is not ws:
            try:
                await old.close(code=4000, reason="replaced by new browser connection")
            except Exception:
                pass
        logger.info(
            "terminal hub: browser registered machine_id=%s session_id=%s",
            machine_id,
            session_id,
        )

    async def unregister_browser(self, machine_id: str, session_id: str, ws: WebSocket) -> None:
        key = (machine_id, session_id)
        async with self._lock:
            if self._browsers.get(key) is ws:
                self._browsers.pop(key, None)
        logger.info(
            "terminal hub: browser unregistered machine_id=%s session_id=%s",
            machine_id,
            session_id,
        )

    def get_agent(self, machine_id: str) -> WebSocket | None:
        return self._agents.get(machine_id)

    def get_browser(self, machine_id: str, session_id: str) -> WebSocket | None:
        return self._browsers.get((machine_id, session_id))

    def browser_sessions_for_machine(self, machine_id: str) -> list[str]:
        return [sid for (mid, sid) in self._browsers if mid == machine_id]


_hub = TerminalHub()


def get_terminal_hub() -> TerminalHub:
    return _hub
