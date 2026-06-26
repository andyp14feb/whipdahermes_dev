from __future__ import annotations

from pydantic import BaseModel


class CommandDTO(BaseModel):
    command_id: str
    session_id: str
    machine_id: str
    payload: str
    state: str
    requested_at: str
    delivered_at: str | None = None
    failure_reason: str | None = None
