from __future__ import annotations

from pydantic import BaseModel

from .session_dto import SessionDTO


class HeartbeatPayload(BaseModel):
    machine_id: str
    sessions: list[SessionDTO]
