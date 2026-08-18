from __future__ import annotations

from pydantic import BaseModel


class SessionDTO(BaseModel):
    machine_id: str
    session_id: str
    label: str
    status: str
    seconds_since_change: int
    last_seen_at: str
    preview: str | None = None
    cwd: str | None = None
