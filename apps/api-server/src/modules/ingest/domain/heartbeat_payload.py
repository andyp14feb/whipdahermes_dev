from __future__ import annotations

from pydantic import BaseModel


class SessionSnapshot(BaseModel):
    session_id: str
    backend: str = "tmux"
    label: str
    preview: str | None = None
    seconds_since_change: int
    diff_pct: float
    stable_counter: int
    cwd: str | None = None
    captured_at: str


class HeartbeatPayload(BaseModel):
    machine_id: str
    sessions: list[SessionSnapshot]
