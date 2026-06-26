from __future__ import annotations

from modules.ingest.domain.heartbeat_payload import SessionSnapshot
from modules.session_state.application.session_service import SessionService
from modules.session_state.domain.session import Session
from modules.session_state.domain.snapshot import Snapshot
from modules.shared_kernel.ids import MachineId


class FakeSessionRepo:
    def __init__(self) -> None:
        self.sessions: dict[str, Session] = {}
        self.snapshots: list[Snapshot] = []
        self.upsert_calls: list[Session] = []
        self.status_updates: list[tuple[str, str]] = []

    def upsert(self, session: Session) -> None:
        self.sessions[session.session_id] = session
        self.upsert_calls.append(session)

    def get(self, session_id: str) -> Session | None:
        return self.sessions.get(session_id)

    def list_by_machine(self, machine_id: str) -> list[Session]:
        return [
            s for s in self.sessions.values() if s.machine_id == machine_id
        ]

    def list_all(self) -> list[Session]:
        return list(self.sessions.values())

    def append_snapshot(self, snapshot: Snapshot) -> None:
        self.snapshots.append(snapshot)

    def update_status(self, session_id: str, status: str) -> None:
        self.status_updates.append((session_id, status))
        if session_id in self.sessions:
            self.sessions[session_id].status = status


class TestSessionService:
    def test_upsert_creates_new_session_for_unknown_session_id(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)

        service.upsert_from_heartbeat(
            MachineId("vm-1"),
            [
                SessionSnapshot(
                    session_id="miniwa",
                    label="miniwa",
                    preview="user@host:~$",
                    seconds_since_change=5,
                    diff_pct=0.0,
                    stable_counter=1,
                    cwd="/home/user",
                    captured_at="2026-06-26T12:00:00Z",
                )
            ],
        )

        assert "miniwa" in repo.sessions
        s = repo.sessions["miniwa"]
        assert s.session_id == "miniwa"
        assert s.machine_id == "vm-1"
        assert s.label == "miniwa"
        assert s.status == "unknown"
        assert s.cwd == "/home/user"

    def test_upsert_updates_existing_session_on_subsequent_heartbeat(
        self,
    ) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)

        service.upsert_from_heartbeat(
            MachineId("vm-1"),
            [
                SessionSnapshot(
                    session_id="miniwa",
                    label="miniwa",
                    preview="user@host:~$",
                    seconds_since_change=5,
                    diff_pct=0.0,
                    stable_counter=1,
                    cwd="/home/user",
                    captured_at="2026-06-26T12:00:00Z",
                )
            ],
        )

        service.upsert_from_heartbeat(
            MachineId("vm-1"),
            [
                SessionSnapshot(
                    session_id="miniwa",
                    label="miniwa",
                    preview="user@host:~$ new",
                    seconds_since_change=2,
                    diff_pct=0.5,
                    stable_counter=2,
                    cwd="/home/user/projects",
                    captured_at="2026-06-26T12:05:00Z",
                )
            ],
        )

        s = repo.sessions["miniwa"]
        assert s.cwd == "/home/user/projects"
        assert len(repo.upsert_calls) == 2

    def test_seconds_since_change_is_computed_from_captured_at(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)

        service.upsert_from_heartbeat(
            MachineId("vm-1"),
            [
                SessionSnapshot(
                    session_id="miniwa",
                    label="miniwa",
                    preview="",
                    seconds_since_change=0,
                    diff_pct=0.0,
                    stable_counter=1,
                    cwd="",
                    captured_at="2026-06-26T12:00:00Z",
                )
            ],
        )

        s = repo.sessions["miniwa"]
        assert s.seconds_since_change >= 0
        assert isinstance(s.seconds_since_change, int)

    def test_upsert_appends_a_snapshot_record(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)

        service.upsert_from_heartbeat(
            MachineId("vm-1"),
            [
                SessionSnapshot(
                    session_id="miniwa",
                    label="miniwa",
                    preview="user@host:~$",
                    seconds_since_change=0,
                    diff_pct=0.0,
                    stable_counter=1,
                    cwd="/home/user",
                    captured_at="2026-06-26T12:00:00Z",
                )
            ],
        )

        assert len(repo.snapshots) == 1
        snap = repo.snapshots[0]
        assert snap.session_id == "miniwa"
        assert snap.machine_id == "vm-1"
        assert snap.preview == "user@host:~$"

    def test_upsert_from_command_result_updates_status(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)
        repo.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="test",
            status="unknown",
            last_seen_at="2026-06-26T12:00:00Z",
        )

        service.upsert_from_command_result("vm-1", "s-1", status_update="active")

        assert repo.sessions["s-1"].status == "active"

    def test_upsert_from_command_result_creates_placeholder_if_session_missing(
        self,
    ) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)

        service.upsert_from_command_result("vm-1", "s-new", status_update="active")

        assert "s-new" in repo.sessions
        s = repo.sessions["s-new"]
        assert s.machine_id == "vm-1"
        assert s.status == "active"

    def test_upsert_from_command_result_no_status_update_keeps_unknown(
        self,
    ) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)
        repo.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="test",
            status="unknown",
            last_seen_at="2026-06-26T12:00:00Z",
        )

        service.upsert_from_command_result("vm-1", "s-1")

        assert repo.sessions["s-1"].status == "unknown"

    def test_list_sessions_returns_all_sessions(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)
        s1 = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="test1",
            last_seen_at="2026-06-26T12:00:00Z",
        )
        s2 = Session(
            session_id="s-2",
            machine_id="vm-1",
            label="test2",
            last_seen_at="2026-06-26T12:00:00Z",
        )
        repo.sessions["s-1"] = s1
        repo.sessions["s-2"] = s2

        assert service.list_sessions() == [s1, s2]

    def test_list_sessions_by_machine_filters_correctly(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)
        s1 = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="test1",
            last_seen_at="2026-06-26T12:00:00Z",
        )
        s2 = Session(
            session_id="s-2",
            machine_id="vm-2",
            label="test2",
            last_seen_at="2026-06-26T12:00:00Z",
        )
        repo.sessions["s-1"] = s1
        repo.sessions["s-2"] = s2

        result = service.list_sessions_by_machine("vm-1")
        assert result == [s1]

    def test_get_session_returns_correct_session(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)
        s1 = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="test1",
            last_seen_at="2026-06-26T12:00:00Z",
        )
        repo.sessions["s-1"] = s1

        assert service.get_session("vm-1", "s-1") == s1

    def test_get_session_returns_none_for_unknown(self) -> None:
        service = SessionService(FakeSessionRepo())

        assert service.get_session("vm-1", "missing") is None

    def test_update_status_calls_repo(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)
        repo.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="test",
            status="unknown",
            last_seen_at="2026-06-26T12:00:00Z",
        )

        service.update_status("vm-1", "s-1", "active")

        assert repo.status_updates == [("s-1", "active")]
        assert repo.sessions["s-1"].status == "active"

    def test_upsert_from_heartbeat_classifies_with_detection_service(self) -> None:
        class FakeClassifier:
            def __init__(self) -> None:
                self.calls: list[tuple[str, str]] = []

            def classify_session(self, session: Session, snapshot: Snapshot | None):
                self.calls.append((session.session_id, snapshot.session_id if snapshot else ""))
                return type("EnumLike", (), {"value": "active"})()

        repo = FakeSessionRepo()
        classifier = FakeClassifier()
        service = SessionService(repo, classifier)

        service.upsert_from_heartbeat(
            MachineId("vm-1"),
            [
                SessionSnapshot(
                    session_id="s-1",
                    label="test",
                    preview="building",
                    seconds_since_change=5,
                    diff_pct=0.0,
                    stable_counter=1,
                    cwd="/home/user",
                    captured_at="2026-06-26T12:00:00Z",
                )
            ],
        )

        assert classifier.calls == [("s-1", "s-1")]
        assert repo.sessions["s-1"].status == "active"
