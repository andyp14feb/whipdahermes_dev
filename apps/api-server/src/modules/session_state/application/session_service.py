from __future__ import annotations

from modules.ingest.domain.heartbeat_payload import SessionSnapshot
from modules.session_state.application.ports import ISessionRepo
from modules.session_state.domain.session import Session
from modules.session_state.domain.snapshot import Snapshot
from modules.shared_kernel.ids import MachineId
from modules.shared_kernel.time_utils import now_utc, parse_iso


class SessionService:
    def __init__(self, repo: ISessionRepo) -> None:
        self.repo = repo

    def upsert_from_heartbeat(
        self, machine_id: MachineId, sessions: list[SessionSnapshot]
    ) -> None:
        now = now_utc()
        for snap in sessions:
            captured_dt = parse_iso(snap.captured_at)
            now_dt = parse_iso(now)
            seconds_since = int((now_dt - captured_dt).total_seconds())
            seconds_since = max(0, seconds_since)

            session = Session(
                session_id=snap.session_id,
                machine_id=str(machine_id),
                label=snap.label,
                status="unknown",
                seconds_since_change=seconds_since,
                last_seen_at=now,
                cwd=snap.cwd or "",
            )
            self.repo.upsert(session)

            self.repo.append_snapshot(
                Snapshot(
                    session_id=snap.session_id,
                    machine_id=str(machine_id),
                    preview=snap.preview or "",
                    diff_pct=snap.diff_pct,
                    stable_counter=snap.stable_counter,
                    cwd=snap.cwd or "",
                    captured_at=snap.captured_at,
                )
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
