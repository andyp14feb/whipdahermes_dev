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
from modules.session_state.application.ports import AssessmentResult
from modules.session_state.application.session_service import SessionService
from modules.session_state.domain.session import Assessment, Session
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


class FakeAssessor:
    def __init__(self, result: AssessmentResult) -> None:
        self.result = result

    def assess_session(self, session: Session, snapshot: Snapshot | None) -> AssessmentResult:
        return self.result


class TestAssessSessionRouter:
    def test_models_endpoint_fetches_models_without_browser_cors(self, monkeypatch) -> None:
        from modules.query_api.adapters.http import assess_router
        from modules.session_state.adapters.persistence.session_repo import (
            SQLSessionRepo,
            create_session_engine,
        )
        from sqlalchemy.pool import StaticPool
        from sqlmodel import SQLModel

        captured = {}

        def fake_fetch_provider_models(base_url: str, provider_type: str, api_key: str):
            captured["base_url"] = base_url
            captured["provider_type"] = provider_type
            captured["api_key"] = api_key
            return ["model-a", "model-b"]

        monkeypatch.setattr(assess_router, "fetch_provider_models", fake_fetch_provider_models)
        engine = create_session_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)
        session_service = SessionService(SQLSessionRepo(engine))
        app = FastAPI()
        app.include_router(assess_router.create_assess_router(session_service, None))
        client = TestClient(app)

        response = client.post(
            "/assess/models",
            json={
                "base_url": "http://62.171.162.214:20128/v1",
                "provider_type": "openai-compatible",
                "api_key": "super-secret-key",
            },
        )

        assert response.status_code == 200
        assert response.json() == {"models": [{"id": "model-a"}, {"id": "model-b"}]}
        assert captured == {
            "base_url": "http://62.171.162.214:20128/v1",
            "provider_type": "openai-compatible",
            "api_key": "super-secret-key",
        }

    def test_assess_endpoint_stores_and_returns_assessment(self) -> None:
        """RED: This test should fail because the endpoint does not exist yet."""
        session_reader = FakeSessionReader()
        machine_reader = FakeMachineReader()
        query_service = QueryService(machine_reader, session_reader)

        session = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="test",
            status="waiting_input",
            last_seen_at=NOW,
        )
        session_reader.sessions["s-1"] = session
        machine_reader.machines["vm-1"] = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at=NOW,
            session_count=1,
        )

        assessor = FakeAssessor(AssessmentResult(Assessment.waiting, "user input"))

        from modules.session_state.adapters.persistence.session_repo import (
            SQLSessionRepo,
            create_session_engine,
        )
        from sqlalchemy.pool import StaticPool
        from sqlmodel import SQLModel

        engine = create_session_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)
        repo = SQLSessionRepo(engine)
        session_service = SessionService(repo)
        session_service.repo.upsert(session)
        session_service.repo.append_snapshot(Snapshot(
            session_id="s-1",
            machine_id="vm-1",
            preview="Proceed? [y/N]",
            diff_pct=0.0,
            stable_counter=1,
            cwd="/home/user",
            captured_at=NOW,
        ))

        from modules.query_api.adapters.http.assess_router import create_assess_router
        app = FastAPI()
        app.include_router(create_assess_router(session_service, assessor))
        client = TestClient(app)

        response = client.post("/assess/vm-1/s-1")

        assert response.status_code == 200
        body = response.json()
        assert body["ai_assessment"] == "waiting"
        assert body["ai_assessment_reason"] == "user input"

        updated = session_service.get_session("vm-1", "s-1")
        assert updated is not None
        assert updated.ai_assessment == "waiting"

    def test_assess_endpoint_409_for_ineligible_status(self) -> None:
        from modules.session_state.adapters.persistence.session_repo import (
            SQLSessionRepo,
            create_session_engine,
        )
        from sqlalchemy.pool import StaticPool
        from sqlmodel import SQLModel

        engine = create_session_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)
        repo = SQLSessionRepo(engine)
        session_service = SessionService(repo)
        repo.upsert(
            Session(
                session_id="s-1",
                machine_id="vm-1",
                label="test",
                status="active",
                last_seen_at=NOW,
            )
        )

        from modules.query_api.adapters.http.assess_router import create_assess_router
        from modules.session_state.application.ports import AssessmentResult
        local_assessor = FakeAssessor(AssessmentResult(Assessment.stuck, ""))
        a = FastAPI()
        a.include_router(create_assess_router(session_service, local_assessor))
        c = TestClient(a)

        r = c.post("/assess/vm-1/s-1")
        assert r.status_code == 409

    def test_assess_endpoint_404_for_missing_session(self) -> None:
        from modules.session_state.adapters.persistence.session_repo import (
            SQLSessionRepo,
            create_session_engine,
        )
        from sqlalchemy.pool import StaticPool
        from sqlmodel import SQLModel

        engine = create_session_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)
        repo = SQLSessionRepo(engine)
        session_service = SessionService(repo)

        from modules.query_api.adapters.http.assess_router import create_assess_router
        app = FastAPI()
        app.include_router(create_assess_router(session_service, None))
        client = TestClient(app)

        response = client.post("/assess/vm-1/missing")
        assert response.status_code == 404

    def test_assess_endpoint_rejects_get_method(self) -> None:
        from modules.session_state.adapters.persistence.session_repo import (
            SQLSessionRepo,
            create_session_engine,
        )
        from sqlalchemy.pool import StaticPool
        from sqlmodel import SQLModel

        engine = create_session_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)
        repo = SQLSessionRepo(engine)
        session_service = SessionService(repo)

        from modules.query_api.adapters.http.assess_router import create_assess_router
        app = FastAPI()
        app.include_router(create_assess_router(session_service, None))
        client = TestClient(app)

        response = client.get("/assess/vm-1/s-1")
        assert response.status_code == 405
