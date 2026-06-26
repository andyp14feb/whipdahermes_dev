from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from modules.machine_registry.domain.machine import Machine
from modules.query_api.adapters.http.session_detail_router import (
    create_session_detail_router,
)
from modules.query_api.adapters.http.sessions_router import create_sessions_router
from modules.query_api.application.query_service import QueryService
from modules.query_api.tests.test_query_service import (
    FakeMachineReader,
    FakeSessionReader,
)
from modules.session_state.domain.session import Session
from modules.session_state.domain.snapshot import Snapshot
from modules.shared_kernel.time_utils import now_utc

NOW = now_utc()


def _build_app(service: QueryService) -> FastAPI:
    app = FastAPI()
    app.include_router(create_sessions_router(service))
    app.include_router(create_session_detail_router(service))
    return app


class TestSessionsRouter:
    def test_get_sessions_returns_list(self) -> None:
        machine_reader = FakeMachineReader()
        session_reader = FakeSessionReader()
        service = QueryService(machine_reader, session_reader)
        machine_reader.machines["vm-1"] = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at=NOW,
            session_count=2,
        )
        session_reader.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="Session 1",
            status="active",
            seconds_since_change=5,
            last_seen_at=NOW,
        )
        app = _build_app(service)
        client = TestClient(app)

        response = client.get("/sessions")

        assert response.status_code == 200
        body = response.json()
        assert "sessions" in body
        assert len(body["sessions"]) == 1
        assert body["sessions"][0]["session_id"] == "s-1"

    def test_get_sessions_empty(self) -> None:
        service = QueryService(FakeMachineReader(), FakeSessionReader())
        app = _build_app(service)
        client = TestClient(app)

        response = client.get("/sessions")

        assert response.status_code == 200
        assert response.json() == {"sessions": []}

    def test_get_session_detail_returns_full_detail(self) -> None:
        machine_reader = FakeMachineReader()
        session_reader = FakeSessionReader()
        service = QueryService(machine_reader, session_reader)
        machine_reader.machines["vm-1"] = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at=NOW,
            session_count=1,
        )
        session_reader.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="Session 1",
            status="active",
            seconds_since_change=10,
            last_seen_at=NOW,
            cwd="/home/user",
        )
        session_reader.snapshots["s-1"] = [
            Snapshot(
                snapshot_id=1,
                session_id="s-1",
                machine_id="vm-1",
                preview="user@host:~$",
                diff_pct=0.0,
                stable_counter=1,
                cwd="/home/user",
                captured_at=NOW,
            )
        ]
        app = _build_app(service)
        client = TestClient(app)

        response = client.get("/sessions/vm-1/s-1")

        assert response.status_code == 200
        body = response.json()
        assert body["machine_id"] == "vm-1"
        assert body["session_id"] == "s-1"
        assert body["label"] == "Session 1"
        assert body["seconds_since_change"] == 10
        assert body["preview"] == "user@host:~$"
        assert body["cwd"] == "/home/user"
        assert body["last_seen_at"] == NOW

    def test_get_session_detail_404_for_unknown(self) -> None:
        service = QueryService(FakeMachineReader(), FakeSessionReader())
        app = _build_app(service)
        client = TestClient(app)

        response = client.get("/sessions/vm-1/nonexistent")

        assert response.status_code == 404
        assert response.json() == {
            "error": {"code": "NOT_FOUND", "message": "Session not found"}
        }

    def test_get_session_detail_stale_machine(self) -> None:
        machine_reader = FakeMachineReader()
        session_reader = FakeSessionReader()
        service = QueryService(machine_reader, session_reader)
        machine_reader.machines["vm-1"] = Machine(
            machine_id="vm-1",
            display_name="Stale VM",
            last_seen_at="2026-06-26T10:00:00Z",
            session_count=1,
            is_stale=True,
        )
        session_reader.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="Old Session",
            status="active",
            seconds_since_change=9999,
            last_seen_at="2026-06-26T10:00:00Z",
        )
        app = _build_app(service)
        client = TestClient(app)

        response = client.get("/sessions/vm-1/s-1")

        assert response.status_code == 200
        assert response.json()["status"] == "stale"
