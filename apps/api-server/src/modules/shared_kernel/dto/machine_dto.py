from __future__ import annotations

from pydantic import BaseModel


class MachineDTO(BaseModel):
    machine_id: str
    display_name: str
    last_seen_at: str
