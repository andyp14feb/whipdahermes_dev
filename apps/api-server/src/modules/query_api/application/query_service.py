from __future__ import annotations

from typing import Callable

from modules.query_api.application.ports import IMachineReader, ISessionReader
from modules.shared_kernel.time_utils import now_utc, parse_iso

DEPRECATED_LOCAL_MACHINE_ID = "vm-local"
REAL_WORKER_PREFIX = "worker-"


class QueryService:
    def __init__(
        self,
        machine_reader: IMachineReader,
        session_reader: ISessionReader,
        stale_timeout_seconds: int = 60,
        delete_session: Callable[[str, str], None] | None = None,
        delete_machine: Callable[[str], bool] | None = None,
        delete_sessions_by_machine: Callable[[str], None] | None = None,
    ) -> None:
        self.machine_reader = machine_reader
        self.session_reader = session_reader
        self.stale_timeout_seconds = stale_timeout_seconds
        self._delete_session = delete_session
        self._delete_machine = delete_machine
        self._delete_sessions_by_machine = delete_sessions_by_machine

    def _is_machine_stale(self, last_seen_at: str) -> bool:
        try:
            return int((parse_iso(now_utc()) - parse_iso(last_seen_at)).total_seconds()) > self.stale_timeout_seconds
        except (ValueError, TypeError):
            return False

    def _has_real_worker_machine(self, machines) -> bool:
        return any(machine.machine_id.startswith(REAL_WORKER_PREFIX) for machine in machines)

    def _filter_deprecated_local_machine(self, machines):
        if not self._has_real_worker_machine(machines):
            return machines
        return [machine for machine in machines if machine.machine_id != DEPRECATED_LOCAL_MACHINE_ID]

    def get_machines(self) -> dict[str, list[dict[str, object]]]:
        machines = self._filter_deprecated_local_machine(self.machine_reader.list_all())
        return {
            "machines": [
                {
                    "machine_id": machine.machine_id,
                    "display_name": machine.display_name,
                    "last_seen_at": machine.last_seen_at,
                    "session_count": machine.session_count,
                    "is_stale": self._is_machine_stale(machine.last_seen_at),
                }
                for machine in machines
            ]
        }

    def _seconds_since_change(self, session, machine) -> int:
        seconds = session.seconds_since_change
        if machine is None or not self._is_machine_stale(machine.last_seen_at):
            return seconds
        try:
            elapsed = int((parse_iso(now_utc()) - parse_iso(session.last_seen_at)).total_seconds())
        except (ValueError, TypeError):
            return seconds
        return max(seconds, seconds + max(0, elapsed))

    def get_sessions(self) -> dict[str, list[dict[str, object]]]:
        machines = self.machine_reader.list_all()
        hide_deprecated_local_machine = self._has_real_worker_machine(machines)
        sessions = [
            session
            for session in self.session_reader.list_all()
            if not hide_deprecated_local_machine or session.machine_id != DEPRECATED_LOCAL_MACHINE_ID
        ]
        machines_by_id = {machine.machine_id: machine for machine in machines}
        result = []
        for session in sessions:
            machine = machines_by_id.get(session.machine_id)
            status = session.status
            if machine is not None and self._is_machine_stale(machine.last_seen_at):
                status = "stale"
            result.append(
                {
                    "machine_id": session.machine_id,
                    "session_id": session.session_id,
                    "label": session.label,
                    "status": status,
                    "seconds_since_change": self._seconds_since_change(session, machine),
                    "last_seen_at": session.last_seen_at,
                }
            )
        return {"sessions": result}

    def get_session_detail(
        self, machine_id: str, session_id: str
    ) -> dict[str, object] | None:
        session = self.session_reader.get(machine_id, session_id)
        if session is None:
            return None
        snapshot = self.session_reader.get_latest_snapshot(machine_id, session_id)
        machine = self.machine_reader.get(machine_id)
        status = session.status
        if machine is not None and self._is_machine_stale(machine.last_seen_at):
            status = "stale"
        return {
            "machine_id": session.machine_id,
            "session_id": session.session_id,
            "label": session.label,
            "status": status,
            "seconds_since_change": self._seconds_since_change(session, machine),
            "preview": snapshot.preview if snapshot else "",
            "cwd": session.cwd,
            "last_seen_at": session.last_seen_at,
            "ai_assessment": session.ai_assessment,
            "ai_assessment_reason": session.ai_assessment_reason,
            "ai_assessed_at": session.ai_assessed_at,
        }

    def delete_session_by_id(self, machine_id: str, session_id: str) -> None:
        if self._delete_session is not None:
            self._delete_session(machine_id, session_id)

    def delete_machine_by_id(self, machine_id: str) -> bool:
        deleted = False
        if self._delete_machine is not None:
            deleted = self._delete_machine(machine_id)
        if self._delete_sessions_by_machine is not None:
            self._delete_sessions_by_machine(machine_id)
        return deleted
