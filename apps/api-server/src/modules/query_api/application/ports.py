from __future__ import annotations

from typing import Protocol

from modules.machine_registry.domain.machine import Machine
from modules.session_state.domain.session import Session
from modules.session_state.domain.snapshot import Snapshot


class IMachineReader(Protocol):
    def list_all(self) -> list[Machine]: ...

    def get(self, machine_id: str) -> Machine | None: ...


class ISessionReader(Protocol):
    def list_all(self) -> list[Session]: ...

    def get(self, session_id: str) -> Session | None: ...

    def get_latest_snapshot(self, session_id: str) -> Snapshot | None: ...
