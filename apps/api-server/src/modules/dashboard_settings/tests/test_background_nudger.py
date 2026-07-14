from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine

from modules.command_router.adapters.persistence.command_repo import SQLCommandRepo
from modules.command_router.application.command_service import CommandService
from modules.dashboard_settings.adapters.http.background_nudger_router import (
    create_background_nudger_router,
)
from modules.dashboard_settings.adapters.persistence.dashboard_settings_repo import (
    SQLDashboardSettingsRepo,
)
from modules.dashboard_settings.adapters.persistence.nudge_runtime_repo import (
    SQLNudgeRuntimeRepo,
)
from modules.dashboard_settings.application.background_nudger import BackgroundNudger
from modules.session_state.adapters.persistence.session_repo import SQLSessionRepo
from modules.session_state.domain.session import Session


def _engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


def _build_nudger() -> tuple[
    BackgroundNudger,
    SQLDashboardSettingsRepo,
    SQLSessionRepo,
    SQLCommandRepo,
]:
    engine = _engine()
    settings_repo = SQLDashboardSettingsRepo(engine)
    session_repo = SQLSessionRepo(engine)
    command_repo = SQLCommandRepo(engine)
    nudger = BackgroundNudger(
        settings_repo=settings_repo,
        runtime_repo=SQLNudgeRuntimeRepo(engine),
        session_repo=session_repo,
        command_service=CommandService(command_repo),
        interval_seconds=1,
    )
    return nudger, settings_repo, session_repo, command_repo


def test_background_nudger_enqueues_once_per_stable_bucket() -> None:
    nudger, settings_repo, session_repo, command_repo = _build_nudger()
    session_repo.upsert(
        Session(
            machine_id="machine-1",
            session_id="A",
            label="Frontend Agent",
            status="stable",
            seconds_since_change=35,
            last_seen_at="2026-07-14T00:00:00Z",
        )
    )
    settings_repo.put(
        {
            "templateActions": [],
            "nudgesBySession": {
                "machine-1:A": {
                    "enabled": True,
                    "stableTimeSeconds": 30,
                    "maxNudges": 2,
                    "nudgesSent": 0,
                    "customPrompt": "please continue",
                }
            },
        }
    )

    first = nudger.tick()
    second = nudger.tick()

    assert first.sent_nudges == 1
    assert second.sent_nudges == 0
    commands = command_repo.find_pending_by_machine("machine-1")
    assert len(commands) == 1
    assert commands[0].payload == "please continue"
    assert settings_repo.get()["nudgesBySession"]["machine-1:A"]["nudgesSent"] == 1


def test_background_nudger_sends_next_bucket_and_disables_at_max() -> None:
    nudger, settings_repo, session_repo, command_repo = _build_nudger()
    session_repo.upsert(
        Session(
            machine_id="machine-1",
            session_id="A",
            label="Frontend Agent",
            status="waiting",
            seconds_since_change=30,
            last_seen_at="2026-07-14T00:00:00Z",
        )
    )
    settings_repo.put(
        {
            "templateActions": [],
            "nudgesBySession": {
                "machine-1:A": {
                    "enabled": True,
                    "stableTimeSeconds": 30,
                    "maxNudges": 2,
                    "nudgesSent": 0,
                    "customPrompt": "",
                }
            },
        }
    )
    nudger.tick()
    session_repo.upsert(
        Session(
            machine_id="machine-1",
            session_id="A",
            label="Frontend Agent",
            status="waiting",
            seconds_since_change=60,
            last_seen_at="2026-07-14T00:00:00Z",
        )
    )

    result = nudger.tick()

    assert result.sent_nudges == 1
    assert len(command_repo.find_pending_by_machine("machine-1")) == 2
    config = settings_repo.get()["nudgesBySession"]["machine-1:A"]
    assert config["nudgesSent"] == 2
    assert config["enabled"] is False


@pytest.mark.asyncio
async def test_background_nudger_can_start_and_stop_task() -> None:
    nudger, _, _, _ = _build_nudger()

    started = nudger.start()
    stopped = await nudger.stop()

    assert started is True
    assert stopped is True
    assert nudger.status()["running"] is False


def test_background_nudger_status_router_reports_status() -> None:
    nudger, _, _, _ = _build_nudger()
    app = FastAPI()
    app.include_router(create_background_nudger_router(nudger))
    client = TestClient(app)

    status = client.get("/dashboard/nudger/status")

    assert status.status_code == 200
    assert status.json()["running"] is False
    assert status.json()["interval_seconds"] == 1
