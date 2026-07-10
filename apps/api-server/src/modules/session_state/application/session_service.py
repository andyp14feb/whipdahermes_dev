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
        self, machine_id: MachineId, sessions: list[SessionSnapshot], db=None
    ) -> None:
        """Write session records, then process any AI assessments.

        When `db` is supplied, the write is merged into the caller's shared
        transaction/lock (see `write_heartbeat`), but assessment always runs
        afterward, outside that transaction/lock — it may call a slow
        external assessor and must not hold the shared SQLite write lock.
        """
        candidates = self.write_heartbeat(machine_id, sessions, db=db)
        self.process_assessments(candidates)

    def write_heartbeat(
        self, machine_id: MachineId, sessions: list[SessionSnapshot], db=None
    ) -> list[tuple[Session, Snapshot, str]]:
        now = now_utc()
        records: list[tuple[Session, Snapshot]] = []
        assessment_candidates: list[tuple[Session, Snapshot, str]] = []
        for snap in sessions:
            previous = self.repo.get(str(machine_id), snap.session_id)
            previous_snapshot = self.repo.get_latest_snapshot(str(machine_id), snap.session_id)
            old_status: str | None = previous.status if previous else None
            preview = snap.preview or ""
            previous_preview = previous_snapshot.preview if previous_snapshot else None
            is_restart_zero_baseline = (
                previous is not None
                and previous_snapshot is not None
                and snap.seconds_since_change == 0
                and snap.stable_counter == 0
                and preview == previous_preview
            )
            seconds_since_change = (
                previous.seconds_since_change
                if is_restart_zero_baseline
                else snap.seconds_since_change
            )
            stable_counter = (
                previous_snapshot.stable_counter
                if is_restart_zero_baseline
                else snap.stable_counter
            )
            initial_status = previous.status if previous is not None else "unknown"

            session = Session(
                session_id=snap.session_id,
                machine_id=str(machine_id),
                label=snap.label,
                status=initial_status,
                seconds_since_change=seconds_since_change,
                last_seen_at=now,
                cwd=snap.cwd or "",
            )

            snapshot_record = Snapshot(
                session_id=snap.session_id,
                machine_id=str(machine_id),
                preview=preview,
                diff_pct=0.0 if is_restart_zero_baseline else snap.diff_pct,
                stable_counter=stable_counter,
                cwd=snap.cwd or "",
                captured_at=snap.captured_at,
            )

            if self.classifier:
                status = self.classifier.classify_session(session, snapshot_record)
                session.status = status.value
                new_status = status.value
            else:
                new_status = "unknown"

            records.append((session, snapshot_record))

            if (
                self.assessor is not None
                and should_assess_transition(old_status, new_status)
                and should_assess_status(new_status)
            ):
                assessment_candidates.append((session, snapshot_record, now))

        self.repo.batch_upsert_heartbeat(
            str(machine_id), {snap.session_id for snap in sessions}, records, db=db
        )
        if db is not None:
            db.commit()

        return assessment_candidates

    def process_assessments(
        self, candidates: list[tuple[Session, Snapshot, str]]
    ) -> None:
        for session, snapshot_record, assessed_at in candidates:
            assess_and_update_session(
                self.repo, self.assessor, session, snapshot_record, assessed_at
            )

    def upsert_from_command_result(
        self,
        machine_id: str,
        session_id: str,
        status_update: str | None = None,
    ) -> None:
        session = self.repo.get(machine_id, session_id)
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
        self.repo.update_status(machine_id, session_id, status)

    def get_session(self, machine_id: str, session_id: str) -> Session | None:
        return self.repo.get(machine_id, session_id)

    def list_sessions(self) -> list[Session]:
        return self.repo.list_all()

    def list_sessions_by_machine(self, machine_id: str) -> list[Session]:
        return self.repo.list_by_machine(machine_id)

    def delete_session_by_id(self, machine_id: str, session_id: str) -> None:
        self.repo.delete_by_id(machine_id, session_id)

    def assess_session(
        self,
        machine_id: str,
        session_id: str,
        assessor: ISessionAssessor,
    ) -> Session | None:
        session = self.repo.get(machine_id, session_id)
        if session is None or session.machine_id != machine_id:
            return None
        snapshot = self.repo.get_latest_snapshot(machine_id, session_id)
        assessed_at = now_utc()
        return assess_and_update_session(self.repo, assessor, session, snapshot, assessed_at)
