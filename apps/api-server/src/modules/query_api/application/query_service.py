from __future__ import annotations

from typing import Callable

from modules.query_api.application.ports import IMachineReader, ISessionReader
from modules.shared_kernel.time_utils import now_utc, parse_iso


class QueryService:
    def __init__(
        self,
        machine_reader: IMachineReader,
        session_reader: ISessionReader,
        stale_timeout_seconds: int = 60,
        delete_session: Callable[[str], None] | None = None,
    ) -> None:
        self.machine_reader = machine_reader
        self.session_reader = session_reader
        self.stale_timeout_seconds = stale_timeout_seconds
        self._delete_session = delete_session

    def _is_machine_stale(self, last_seen_at: str) -> bool:
        try:
            return int((parse_iso(now_utc()) - parse_iso(last_seen_at)).total_seconds()) > self.stale_timeout_seconds
        except (ValueError, TypeError):
            return False

    def get_machines(self) -> dict[str, list[dict[str, object]]]:
        machines = self.machine_reader.list_all()
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

    def get_sessions(self) -> dict[str, list[dict[str, object]]]:
        sessions = self.session_reader.list_all()
        machines_by_id = {machine.machine_id: machine for machine in self.machine_reader.list_all()}
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
                    "seconds_since_change": session.seconds_since_change,
                    "last_seen_at": session.last_seen_at,
                }
            )
        return {"sessions": result}

    def get_session_detail(
        self, machine_id: str, session_id: str
    ) -> dict[str, object] | None:
        session = self.session_reader.get(session_id)
        if session is None or session.machine_id != machine_id:
            return None
        snapshot = self.session_reader.get_latest_snapshot(session_id)
        machine = self.machine_reader.get(machine_id)
        status = session.status
        if machine is not None and self._is_machine_stale(machine.last_seen_at):
            status = "stale"
        return {
            "machine_id": session.machine_id,
            "session_id": session.session_id,
            "label": session.label,
            "status": status,
            "seconds_since_change": session.seconds_since_change,
            "preview": snapshot.preview if snapshot else "",
            "cwd": session.cwd,
            "last_seen_at": session.last_seen_at,
            "ai_assessment": session.ai_assessment,
            "ai_assessment_reason": session.ai_assessment_reason,
            "ai_assessed_at": session.ai_assessed_at,
        }

    def delete_session_by_id(self, session_id: str) -> None:
        if self._delete_session is not None:
            self._delete_session(session_id)
