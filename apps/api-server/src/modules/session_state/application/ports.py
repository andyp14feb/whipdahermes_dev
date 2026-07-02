from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Protocol

from modules.session_state.domain.session import Assessment, Session
from modules.session_state.domain.snapshot import Snapshot


@dataclass(frozen=True)
class AssessmentResult:
    classification: Assessment
    reason: str


class IDetectionClassifier(Protocol):
    def classify_session(self, session: Session, snapshot: Snapshot | None) -> Enum: ...


class ISessionAssessor(Protocol):
    def assess_session(self, session: Session, snapshot: Snapshot | None) -> AssessmentResult: ...


class ISessionRepo(Protocol):
    def upsert(self, session: Session) -> None: ...

    def batch_upsert_heartbeat(
        self,
        machine_id: str,
        active_session_ids: set[str],
        records: list[tuple[Session, Snapshot]],
    ) -> None: ...

    def get(self, machine_id: str, session_id: str) -> Session | None: ...

    def list_by_machine(self, machine_id: str) -> list[Session]: ...

    def list_all(self) -> list[Session]: ...

    def append_snapshot(self, machine_id: str, snapshot: Snapshot) -> None: ...

    def get_latest_snapshot(self, machine_id: str, session_id: str) -> Snapshot | None: ...

    def update_status(self, machine_id: str, session_id: str, status: str) -> None: ...

    def update_assessment(
        self,
        machine_id: str,
        session_id: str,
        assessment: str,
        reason: str,
        assessed_at: str,
    ) -> None: ...

    def delete_all_by_machine(self, machine_id: str) -> None: ...

    def mark_missing_by_machine_as_stale(
        self, machine_id: str, session_ids: set[str]
    ) -> None: ...

    def delete_by_id(self, machine_id: str, session_id: str) -> None: ...

    def delete_sessions_older_than(self, seconds: int) -> None: ...


def assess_and_update_session(
    repo: ISessionRepo,
    assessor: ISessionAssessor,
    session: Session,
    snapshot: Snapshot | None,
    assessed_at: str,
) -> Session:
    result = assessor.assess_session(session, snapshot)
    repo.update_assessment(
        session.machine_id,
        session.session_id,
        result.classification.value,
        result.reason,
        assessed_at,
    )
    updated_session = repo.get(session.machine_id, session.session_id)
    return updated_session if updated_session is not None else session
