from __future__ import annotations

from modules.ingest.domain.heartbeat_payload import SessionSnapshot
from modules.session_state.application.ports import AssessmentResult
from modules.session_state.application.session_service import SessionService
from modules.session_state.domain.session import Assessment, Session
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

    def get_latest_snapshot(self, session_id: str) -> Snapshot | None:
        matching = [s for s in self.snapshots if s.session_id == session_id]
        return matching[-1] if matching else None

    def update_status(self, session_id: str, status: str) -> None:
        self.status_updates.append((session_id, status))
        if session_id in self.sessions:
            self.sessions[session_id].status = status

    def update_assessment(
        self,
        session_id: str,
        assessment: str,
        reason: str,
        assessed_at: str,
    ) -> None:
        if session_id in self.sessions:
            self.sessions[session_id].ai_assessment = assessment
            self.sessions[session_id].ai_assessment_reason = reason
            self.sessions[session_id].ai_assessed_at = assessed_at

    def delete_all_by_machine(self, machine_id: str) -> None:
        stale_session_ids = [
            session_id
            for session_id, session in self.sessions.items()
            if session.machine_id == machine_id
        ]
        for session_id in stale_session_ids:
            del self.sessions[session_id]
        self.snapshots = [
            snapshot
            for snapshot in self.snapshots
            if snapshot.machine_id != machine_id
        ]

    def delete_missing_by_machine(self, machine_id: str, session_ids: set[str]) -> None:
        if not session_ids:
            self.delete_all_by_machine(machine_id)
            return
        stale_session_ids = [
            session_id
            for session_id, session in self.sessions.items()
            if session.machine_id == machine_id and session_id not in session_ids
        ]
        for session_id in stale_session_ids:
            del self.sessions[session_id]
        self.snapshots = [
            snapshot
            for snapshot in self.snapshots
            if snapshot.machine_id != machine_id or snapshot.session_id in session_ids
        ]


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

    def test_seconds_since_change_comes_from_agent_snapshot(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)

        service.upsert_from_heartbeat(
            MachineId("vm-1"),
            [
                SessionSnapshot(
                    session_id="miniwa",
                    label="miniwa",
                    preview="",
                    seconds_since_change=6,
                    diff_pct=0.0,
                    stable_counter=1,
                    cwd="",
                    captured_at="2026-06-26T12:00:00Z",
                )
            ],
        )

        s = repo.sessions["miniwa"]
        assert s.seconds_since_change == 6
        assert isinstance(s.seconds_since_change, int)

    def test_different_sessions_get_different_stable_counters(self) -> None:
        """Per-session stable counter: two sessions in the same heartbeat must not
        share the same seconds_since_change when their agent-reported values differ."""
        repo = FakeSessionRepo()
        service = SessionService(repo)

        service.upsert_from_heartbeat(
            MachineId("vm-1"),
            [
                SessionSnapshot(
                    session_id="session-a",
                    label="session-a",
                    preview="",
                    seconds_since_change=9,
                    diff_pct=0.0,
                    stable_counter=3,
                    cwd="",
                    captured_at="2026-06-26T12:00:00Z",
                ),
                SessionSnapshot(
                    session_id="session-b",
                    label="session-b",
                    preview="",
                    seconds_since_change=0,
                    diff_pct=5.0,
                    stable_counter=0,
                    cwd="",
                    captured_at="2026-06-26T12:00:00Z",
                ),
            ],
        )

        sa = repo.sessions["session-a"]
        sb = repo.sessions["session-b"]
        assert sa.seconds_since_change == 9
        assert sb.seconds_since_change == 0

    def test_stable_counter_resets_to_zero_on_activity(self) -> None:
        """When a session has new activity (diff above threshold), stable_counter
        resets to 0 and seconds_since_change must be 0 for that session."""
        repo = FakeSessionRepo()
        service = SessionService(repo)

        service.upsert_from_heartbeat(
            MachineId("vm-1"),
            [
                SessionSnapshot(
                    session_id="s-active",
                    label="s-active",
                    preview="",
                    seconds_since_change=0,
                    diff_pct=12.5,
                    stable_counter=0,
                    cwd="",
                    captured_at="2026-06-26T12:00:00Z",
                )
            ],
        )

        s = repo.sessions["s-active"]
        assert s.seconds_since_change == 0

    def test_stable_counter_resets_on_change_then_counts_up(self) -> None:
        """After activity resets the counter, subsequent stable heartbeats
        increase seconds_since_change from the per-session baseline."""
        repo = FakeSessionRepo()
        service = SessionService(repo)

        # Heartbeat 1: session just changed (stable_counter=0, seconds=0)
        service.upsert_from_heartbeat(
            MachineId("vm-1"),
            [
                SessionSnapshot(
                    session_id="s-1",
                    label="s-1",
                    preview="output A",
                    seconds_since_change=0,
                    diff_pct=8.0,
                    stable_counter=0,
                    cwd="",
                    captured_at="2026-06-26T12:00:00Z",
                )
            ],
        )
        assert repo.sessions["s-1"].seconds_since_change == 0

        # Heartbeat 2: session stable for 1 tick (stable_counter=1, seconds=3)
        service.upsert_from_heartbeat(
            MachineId("vm-1"),
            [
                SessionSnapshot(
                    session_id="s-1",
                    label="s-1",
                    preview="output A",
                    seconds_since_change=3,
                    diff_pct=0.0,
                    stable_counter=1,
                    cwd="",
                    captured_at="2026-06-26T12:00:03Z",
                )
            ],
        )
        assert repo.sessions["s-1"].seconds_since_change == 3

        # Heartbeat 3: session stable for 2 ticks (stable_counter=2, seconds=6)
        service.upsert_from_heartbeat(
            MachineId("vm-1"),
            [
                SessionSnapshot(
                    session_id="s-1",
                    label="s-1",
                    preview="output A",
                    seconds_since_change=6,
                    diff_pct=0.0,
                    stable_counter=2,
                    cwd="",
                    captured_at="2026-06-26T12:00:06Z",
                )
            ],
        )
        assert repo.sessions["s-1"].seconds_since_change == 6

    def test_multi_session_heartbeat_preserves_per_session_stable_counts(self) -> None:
        """Multiple sessions in the same heartbeat each maintain independent
        stable counters. One session's counter does not affect another."""
        repo = FakeSessionRepo()
        service = SessionService(repo)

        service.upsert_from_heartbeat(
            MachineId("vm-1"),
            [
                SessionSnapshot(
                    session_id="s-active",
                    label="s-active",
                    preview="",
                    seconds_since_change=0,
                    diff_pct=10.0,
                    stable_counter=0,
                    cwd="",
                    captured_at="2026-06-26T12:00:00Z",
                ),
                SessionSnapshot(
                    session_id="s-stable-3s",
                    label="s-stable-3s",
                    preview="",
                    seconds_since_change=3,
                    diff_pct=0.0,
                    stable_counter=1,
                    cwd="",
                    captured_at="2026-06-26T12:00:00Z",
                ),
                SessionSnapshot(
                    session_id="s-stable-15s",
                    label="s-stable-15s",
                    preview="",
                    seconds_since_change=15,
                    diff_pct=0.0,
                    stable_counter=5,
                    cwd="",
                    captured_at="2026-06-26T12:00:00Z",
                ),
            ],
        )

        assert repo.sessions["s-active"].seconds_since_change == 0
        assert repo.sessions["s-stable-3s"].seconds_since_change == 3
        assert repo.sessions["s-stable-15s"].seconds_since_change == 15

    def test_upsert_removes_stale_sessions_missing_from_next_heartbeat(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)

        service.upsert_from_heartbeat(
            MachineId("vm-1"),
            [
                SessionSnapshot(
                    session_id="session-a",
                    label="session-a",
                    preview="",
                    seconds_since_change=3,
                    diff_pct=0.0,
                    stable_counter=1,
                    cwd="",
                    captured_at="2026-06-26T12:00:00Z",
                ),
                SessionSnapshot(
                    session_id="session-b",
                    label="session-b",
                    preview="",
                    seconds_since_change=3,
                    diff_pct=0.0,
                    stable_counter=1,
                    cwd="",
                    captured_at="2026-06-26T12:00:00Z",
                ),
            ],
        )

        service.upsert_from_heartbeat(
            MachineId("vm-1"),
            [
                SessionSnapshot(
                    session_id="session-b",
                    label="session-b",
                    preview="",
                    seconds_since_change=6,
                    diff_pct=0.0,
                    stable_counter=2,
                    cwd="",
                    captured_at="2026-06-26T12:00:03Z",
                )
            ],
        )

        assert "session-a" not in repo.sessions
        assert "session-b" in repo.sessions

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


class FakeAssessor:
    def __init__(self, result: AssessmentResult) -> None:
        self.result = result
        self.last_session: Session | None = None
        self.last_snapshot: Snapshot | None = None

    def assess_session(self, session: Session, snapshot: Snapshot | None) -> AssessmentResult:
        self.last_session = session
        self.last_snapshot = snapshot
        return self.result


class TestAssessSession:
    def test_assess_session_stores_stuck(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)
        repo.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="test",
            status="unknown",
            last_seen_at="2026-06-26T12:00:00Z",
        )

        assessor = FakeAssessor(AssessmentResult(Assessment.stuck, "No output in 60s"))
        result = service.assess_session("vm-1", "s-1", assessor)

        assert result is not None
        assert result.ai_assessment == "stuck"
        assert result.ai_assessment_reason == "No output in 60s"

    def test_assess_session_stores_waiting(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)
        repo.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="test",
            status="unknown",
            last_seen_at="2026-06-26T12:00:00Z",
        )

        assessor = FakeAssessor(AssessmentResult(Assessment.waiting, "Waiting for input"))
        result = service.assess_session("vm-1", "s-1", assessor)

        assert result is not None
        assert result.ai_assessment == "waiting"

    def test_assess_session_stores_running(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)
        repo.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="test",
            status="unknown",
            last_seen_at="2026-06-26T12:00:00Z",
        )

        assessor = FakeAssessor(AssessmentResult(Assessment.running, "Building project"))
        result = service.assess_session("vm-1", "s-1", assessor)

        assert result is not None
        assert result.ai_assessment == "running"

    def test_assess_session_stores_finished(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)
        repo.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="test",
            status="unknown",
            last_seen_at="2026-06-26T12:00:00Z",
        )

        assessor = FakeAssessor(AssessmentResult(Assessment.finished, "Process exited"))
        result = service.assess_session("vm-1", "s-1", assessor)

        assert result is not None
        assert result.ai_assessment == "finished"

    def test_assess_session_missing_returns_none(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)

        assessor = FakeAssessor(AssessmentResult(Assessment.stuck, ""))
        result = service.assess_session("vm-1", "missing", assessor)

        assert result is None

    def test_assess_session_wrong_machine_returns_none(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)
        repo.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="test",
            status="unknown",
            last_seen_at="2026-06-26T12:00:00Z",
        )

        assessor = FakeAssessor(AssessmentResult(Assessment.running, ""))
        result = service.assess_session("vm-2", "s-1", assessor)

        assert result is None

    def test_assess_session_provides_latest_snapshot(self) -> None:
        repo = FakeSessionRepo()
        service = SessionService(repo)
        repo.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="test",
            status="unknown",
            last_seen_at="2026-06-26T12:00:00Z",
        )
        repo.snapshots.append(Snapshot(
            session_id="s-1",
            machine_id="vm-1",
            preview="building something...",
            diff_pct=0.0,
            stable_counter=1,
            cwd="/home/user",
            captured_at="2026-06-26T12:00:00Z",
        ))

        assessor = FakeAssessor(AssessmentResult(Assessment.running, ""))
        service.assess_session("vm-1", "s-1", assessor)

        assert assessor.last_snapshot is not None
        assert assessor.last_snapshot.preview == "building something..."
