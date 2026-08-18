from __future__ import annotations

from sqlmodel import Field, SQLModel


class Machine(SQLModel, table=True):
    __tablename__ = "machines"

    machine_id: str = Field(primary_key=True)
    display_name: str
    last_seen_at: str
    session_count: int = 0
    is_stale: bool = False

    def __init__(self, **data: object) -> None:
        machine_id = data.get("machine_id")
        if "display_name" not in data and isinstance(machine_id, str):
            data["display_name"] = machine_id
        super().__init__(**data)
