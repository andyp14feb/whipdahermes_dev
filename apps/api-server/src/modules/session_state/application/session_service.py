from __future__ import annotations

from modules.ingest.domain.heartbeat_payload import SessionSnapshot
from modules.session_state.application.ports import (
    IDetectionClassifier,
    ISessionAssessor,
    ISessionRepo,
    assess_and_update_session,
)
from modules.session_state.application.transition_gate import (
    should_assess_status,
    should_assess_transition,
)
from modules.session_state.domain.session import Session
from modules.session_state.domain.snapshot import Snapshot
from modules.shared_kernel.ids import MachineId
from modules.shared_kernel.time_utils import now_utc


class SessionService:
    def __init__(
        self,
        repo: ISessionRepo,
        classifier: IDetectionClassifier | None = None,
        assessor: ISessionAssessor | None = None,
    ) -> None:
        self.repo = repo
        self.classifier = classifier
        self.assessor = assessor

    def upsert_from_heartbeat(
        self, machine_id: MachineId, sessions: list[SessionSnapshot]
    ) -> None:
        now = now_utc()
        self.repo.delete_missing_by_machine(str(machine_id), {snap.session_id for snap in sessions})
        for snap in sessions:
            previous = self.repo.get(snap.session_id)
            old_status: str | None = previous.status if previous else None

            session = Session(
                session_id=snap.session_id,
                machine_id=str(machine_id),
                label=snap.label,
                status="unknown",
                seconds_since_change=snap.seconds_since_change,
                last_seen_at=now,
                cwd=snap.cwd or "",
            )
            self.repo.upsert(session)

            snapshot_record = Snapshot(
                session_id=snap.session_id,
                machine_id=str(machine_id),
                preview=snap.preview or "",
                diff_pct=snap.diff_pct,
                stable_counter=snap.stable_counter,
                cwd=snap.cwd or "",
                captured_at=snap.captured_at,
            )
            if self.classifier:
                status = self.classifier.classify_session(session, snapshot_record)
                self.repo.update_status(snap.session_id, status.value)
                new_status = status.value
            else:
                new_status = "unknown"

            self.repo.append_snapshot(snapshot_record)

            if (
                self.assessor is not None
                and should_assess_transition(old_status, new_status)
                and should_assess_status(new_status)
            ):
                refreshed = self.repo.get(snap.session_id)
                if refreshed is not None:
                    latest_snapshot = self.repo.get_latest_snapshot(snap.session_id)
                    assess_and_update_session(
                        self.repo, self.assessor, refreshed, latest_snapshot, now_utc()
                    )

    def upsert_from_command_result(
        self,
        machine_id: str,
        session_id: str,
        status_update: str | None = None,
    ) -> None:
        session = self.repo.get(session_id)
        if session is None:
            session = Session(
                session_id=session_id,
                machine_id=machine_id,
                label=session_id,
                status=status_update or "unknown",
                last_seen_at=now_utc(),
            )
        else:
            if status_update:
                session.status = status_update
            session.last_seen_at = now_utc()
        self.repo.upsert(session)

    def update_status(self, machine_id: str, session_id: str, status: str) -> None:
        self.repo.update_status(session_id, status)

    def get_session(self, machine_id: str, session_id: str) -> Session | None:
        return self.repo.get(session_id)

    def list_sessions(self) -> list[Session]:
        return self.repo.list_all()

    def list_sessions_by_machine(self, machine_id: str) -> list[Session]:
        return self.repo.list_by_machine(machine_id)

    def delete_session_by_id(self, session_id: str) -> None:
        self.repo.delete_by_id(session_id)

    def assess_session(
        self,
        machine_id: str,
        session_id: str,
        assessor: ISessionAssessor,
    ) -> Session | None:
        session = self.repo.get(session_id)
        if session is None or session.machine_id != machine_id:
            return None
        snapshot = self.repo.get_latest_snapshot(session_id)
        assessed_at = now_utc()
        return assess_and_update_session(self.repo, assessor, session, snapshot, assessed_at)
