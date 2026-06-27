from __future__ import annotations

from sqlalchemy.pool import StaticPool
from sqlmodel import Session as SQLSession, SQLModel, create_engine, select

from modules.session_state.adapters.persistence.session_repo import SQLSessionRepo
from modules.session_state.domain.session import Session
from modules.session_state.domain.snapshot import Snapshot


class TestSQLSessionRepo:
    def create_repo(self) -> SQLSessionRepo:
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)
        return SQLSessionRepo(engine)

    def test_upsert_creates_record(self) -> None:
        repo = self.create_repo()
        session = Session(
            session_id="miniwa",
            machine_id="vm-1",
            label="miniwa",
            last_seen_at="2026-06-26T12:00:00Z",
        )

        repo.upsert(session)

        assert repo.get("miniwa") == session

    def test_upsert_updates_existing_record(self) -> None:
        repo = self.create_repo()
        first = Session(
            session_id="miniwa",
            machine_id="vm-1",
            label="miniwa",
            last_seen_at="2026-06-26T12:00:00Z",
        )
        repo.upsert(first)
        updated = Session(
            session_id="miniwa",
            machine_id="vm-1",
            label="miniwa",
            status="active",
            last_seen_at="2026-06-26T12:05:00Z",
            cwd="/home/user",
        )

        repo.upsert(updated)

        fetched = repo.get("miniwa")
        assert fetched is not None
        assert fetched.status == "active"
        assert fetched.last_seen_at == "2026-06-26T12:05:00Z"
        assert fetched.cwd == "/home/user"

    def test_append_snapshot_creates_snapshot(self) -> None:
        repo = self.create_repo()
        snapshot = Snapshot(
            session_id="miniwa",
            machine_id="vm-1",
            preview="user@host:~$",
            diff_pct=0.0,
            stable_counter=1,
            cwd="/home/user",
            captured_at="2026-06-26T12:00:00Z",
        )

        repo.append_snapshot(snapshot)

        with SQLSession(repo.engine) as db:
            snapshots = list(db.exec(select(Snapshot)).all())

        assert len(snapshots) == 1
        assert snapshots[0].snapshot_id is not None
        assert snapshots[0].session_id == "miniwa"

    def test_list_all_returns_all_sessions(self) -> None:
        repo = self.create_repo()
        s1 = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="s1",
            last_seen_at="2026-06-26T12:00:00Z",
        )
        s2 = Session(
            session_id="s-2",
            machine_id="vm-1",
            label="s2",
            last_seen_at="2026-06-26T12:00:00Z",
        )
        repo.upsert(s1)
        repo.upsert(s2)

        sessions = repo.list_all()

        assert [s.session_id for s in sessions] == ["s-1", "s-2"]

    def test_list_by_machine_filters_correctly(self) -> None:
        repo = self.create_repo()
        s1 = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="s1",
            last_seen_at="2026-06-26T12:00:00Z",
        )
        s2 = Session(
            session_id="s-2",
            machine_id="vm-2",
            label="s2",
            last_seen_at="2026-06-26T12:00:00Z",
        )
        repo.upsert(s1)
        repo.upsert(s2)

        result = repo.list_by_machine("vm-1")

        assert [s.session_id for s in result] == ["s-1"]

    def test_update_status_modifies_status_only(self) -> None:
        repo = self.create_repo()
        session = Session(
            session_id="miniwa",
            machine_id="vm-1",
            label="miniwa",
            status="unknown",
            last_seen_at="2026-06-26T12:00:00Z",
            cwd="/home/user",
        )
        repo.upsert(session)

        repo.update_status("miniwa", "active")

        fetched = repo.get("miniwa")
        assert fetched is not None
        assert fetched.status == "active"
        assert fetched.last_seen_at == "2026-06-26T12:00:00Z"  # unchanged
        assert fetched.cwd == "/home/user"  # unchanged

    def test_update_status_noop_for_missing_session(self) -> None:
        repo = self.create_repo()

        repo.update_status("non-existent", "active")  # should not raise

    def test_get_latest_snapshot_returns_most_recent(self) -> None:
        repo = self.create_repo()
        s1 = Snapshot(
            session_id="miniwa",
            machine_id="vm-1",
            preview="first",
            diff_pct=0.0,
            stable_counter=1,
            cwd="/home",
            captured_at="2026-06-26T12:00:00Z",
        )
        s2 = Snapshot(
            session_id="miniwa",
            machine_id="vm-1",
            preview="second",
            diff_pct=0.5,
            stable_counter=2,
            cwd="/home/user",
            captured_at="2026-06-26T12:05:00Z",
        )
        repo.append_snapshot(s1)
        repo.append_snapshot(s2)

        result = repo.get_latest_snapshot("miniwa")

        assert result is not None
        assert result.preview == "second"

    def test_get_latest_snapshot_returns_none_when_no_snapshots(self) -> None:
        repo = self.create_repo()

        result = repo.get_latest_snapshot("nonexistent")

        assert result is None

    def test_delete_all_by_machine_removes_sessions_and_snapshots(self) -> None:
        repo = self.create_repo()
        session = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="s1",
            last_seen_at="2026-06-26T12:00:00Z",
        )
        repo.upsert(session)
        repo.append_snapshot(
            Snapshot(
                session_id="s-1",
                machine_id="vm-1",
                preview="first",
                diff_pct=0.0,
                stable_counter=1,
                cwd="/home",
                captured_at="2026-06-26T12:00:00Z",
            )
        )

        repo.delete_all_by_machine("vm-1")

        assert repo.get("s-1") is None
        assert repo.list_by_machine("vm-1") == []
        with SQLSession(repo.engine) as db:
            assert list(db.exec(select(Snapshot)).all()) == []
