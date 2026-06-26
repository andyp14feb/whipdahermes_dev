from __future__ import annotations

from modules.query_api.application.ports import IMachineReader, ISessionReader


class QueryService:
    def __init__(
        self, machine_reader: IMachineReader, session_reader: ISessionReader
    ) -> None:
        self.machine_reader = machine_reader
        self.session_reader = session_reader

    def get_machines(self) -> dict[str, list[dict[str, object]]]:
        machines = self.machine_reader.list_all()
        return {
            "machines": [
                {
                    "machine_id": machine.machine_id,
                    "display_name": machine.display_name,
                    "last_seen_at": machine.last_seen_at,
                    "session_count": machine.session_count,
                }
                for machine in machines
            ]
        }

    def get_sessions(self) -> dict[str, list[dict[str, object]]]:
        sessions = self.session_reader.list_all()
        result = []
        for session in sessions:
            machine = self.machine_reader.get(session.machine_id)
            status = session.status
            if machine is not None and machine.is_stale:
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
        if machine is not None and machine.is_stale:
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
        }
