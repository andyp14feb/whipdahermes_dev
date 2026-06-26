from __future__ import annotations

from typing import Protocol

from modules.session_state.domain.session import Session
from modules.session_state.domain.snapshot import Snapshot


class ISessionRepo(Protocol):
    def upsert(self, session: Session) -> None: ...

    def get(self, session_id: str) -> Session | None: ...

    def list_by_machine(self, machine_id: str) -> list[Session]: ...

    def list_all(self) -> list[Session]: ...

    def append_snapshot(self, snapshot: Snapshot) -> None: ...

    def update_status(self, session_id: str, status: str) -> None: ...
