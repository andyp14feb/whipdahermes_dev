from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine

from modules.dashboard_settings.adapters.http.dashboard_settings_router import (
    create_dashboard_settings_router,
)
from modules.dashboard_settings.adapters.persistence.dashboard_settings_repo import (
    SQLDashboardSettingsRepo,
)


def _client_with_repo() -> tuple[TestClient, SQLDashboardSettingsRepo]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    repo = SQLDashboardSettingsRepo(engine)
    app = FastAPI()
    app.include_router(create_dashboard_settings_router(repo))
    return TestClient(app), repo


def test_get_dashboard_settings_returns_empty_marker_before_save() -> None:
    client, _ = _client_with_repo()

    response = client.get("/dashboard/settings")

    assert response.status_code == 200
    assert response.json() == {
        "exists": False,
        "templateActions": [],
        "nudgesBySession": {},
    }


def test_put_dashboard_settings_persists_templates_and_nudges() -> None:
    client, repo = _client_with_repo()
    payload = {
        "templateActions": [
            {"id": "yes", "label": "yes", "payload": "yes"},
            {"id": "custom", "label": "status", "payload": "status please"},
        ],
        "nudgesBySession": {
            "machine-1:A": {
                "enabled": True,
                "stableTimeSeconds": 30,
                "maxNudges": 2,
                "nudgesSent": 1,
                "customPrompt": "please continue",
            },
        },
    }

    put_response = client.put("/dashboard/settings", json=payload)
    get_response = client.get("/dashboard/settings")

    assert put_response.status_code == 200
    assert put_response.json() == {"ok": True}
    assert get_response.status_code == 200
    assert get_response.json() == {"exists": True, **payload}
    assert repo.get() == payload


def test_put_dashboard_settings_rejects_invalid_nudge_values() -> None:
    client, _ = _client_with_repo()

    response = client.put(
        "/dashboard/settings",
        json={
            "templateActions": [],
            "nudgesBySession": {
                "machine-1:A": {
                    "enabled": True,
                    "stableTimeSeconds": 0,
                    "maxNudges": 1,
                    "nudgesSent": 0,
                    "customPrompt": "please continue",
                },
            },
        },
    )

    assert response.status_code == 422
