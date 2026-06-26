"""Shared pytest fixtures for multi-machine aggregation e2e tests."""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[2]
API_SRC = REPO / "apps" / "api-server" / "src"

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["STALE_TIMEOUT_SECONDS"] = "3"
os.environ["DEBUG"] = "true"
os.environ["APP_NAME"] = "whipai-api-test"


def _build_full_app() -> FastAPI:
    sys.path.insert(0, str(API_SRC))

    from fastapi import FastAPI as FastAPIClient

    from modules.detection.detection import create_detection_module
    from modules.ingest.ingest import register_ingest_module
    from modules.machine_registry.adapters.persistence.machine_repo import (
        SQLMachineRepo,
        create_machine_engine,
    )
    from modules.machine_registry.application.machine_service import MachineService
    from modules.machine_registry.machine_registry import create_machine_registry_module
    from modules.query_api.application.query_service import QueryService
    from modules.query_api.query_api import create_query_api_router
    from modules.session_state.adapters.persistence.session_repo import (
        SQLSessionRepo,
        create_session_engine,
    )
    from modules.session_state.session_state import create_session_state_module
    from modules.shared_kernel.config import Settings

    settings = Settings.load()

    app = FastAPIClient(title="WhipAI API Server Test")

    machine_engine = create_machine_engine(settings.database_url.get_secret_value())
    machine_repo = SQLMachineRepo(machine_engine)
    machine_service = MachineService(machine_repo)

    session_engine = create_session_engine(settings.database_url.get_secret_value())
    session_repo = SQLSessionRepo(session_engine)
    detection_service = create_detection_module(
        stale_timeout_seconds=settings.stale_timeout_seconds
    )
    session_service = create_session_state_module(session_repo, detection_service)

    register_ingest_module(
        app,
        machine_registry_upserter=machine_service,
        session_upserter=session_service,
    )
    create_machine_registry_module(machine_service)

    query_service = QueryService(
        machine_reader=machine_repo,
        session_reader=session_repo,
        stale_timeout_seconds=settings.stale_timeout_seconds,
    )
    app.include_router(create_query_api_router(query_service))

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    app = _build_full_app()
    with TestClient(app, raise_server_exceptions=False) as tc:
        yield tc


def make_heartbeat_payload(
    machine_id: str,
    sessions: list[dict] | None = None,
    captured_at: str | None = None,
) -> dict:
    if sessions is None:
        sessions = [
            {
                "session_id": f"{machine_id}-session-1",
                "label": f"shell on {machine_id}",
                "preview": "$ echo hello",
                "seconds_since_change": 5,
                "diff_pct": 0.0,
                "stable_counter": 1,
                "cwd": f"/home/{machine_id}",
                "captured_at": captured_at or _now_iso(),
            }
        ]
    return {"machine_id": machine_id, "sessions": sessions}


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
