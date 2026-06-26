from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from modules.shared_kernel.ids import MachineId
from modules.ingest.domain.heartbeat_payload import SessionSnapshot
from modules.ingest.ingest import create_ingest_module


class FakeMachineRegistry:
    def __init__(self) -> None:
        self.calls: list[tuple[MachineId, str]] = []

    def upsert_machine(self, machine_id: MachineId, last_seen_at: str) -> None:
        self.calls.append((machine_id, last_seen_at))


class FakeSessionUpserter:
    def __init__(self) -> None:
        self.calls: list[tuple[MachineId, list[SessionSnapshot]]] = []

    def upsert_from_heartbeat(
        self, machine_id: MachineId, sessions: list[SessionSnapshot]
    ) -> None:
        self.calls.append((machine_id, sessions))


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    registry = FakeMachineRegistry()
    upserter = FakeSessionUpserter()
    router = create_ingest_module(
        machine_registry_upserter=registry,
        session_upserter=upserter,
    )
    app.include_router(router)
    return TestClient(app)


class TestHeartbeatRouter:
    def test_valid_heartbeat_returns_200(self, client: TestClient) -> None:
        payload = {
            "machine_id": "vm-1",
            "sessions": [
                {
                    "session_id": "miniwa",
                    "label": "miniwa",
                    "preview": "echo hello",
                    "seconds_since_change": 12,
                    "diff_pct": 0.0,
                    "stable_counter": 5,
                    "cwd": "/home/user/repos/miniwa",
                    "captured_at": "2026-06-24T08:15:00Z",
                }
            ],
        }
        resp = client.post("/heartbeat", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["accepted"] == 1

    def test_malformed_payload_returns_422(self, client: TestClient) -> None:
        resp = client.post("/heartbeat", json={"machine_id": "vm-1"})
        assert resp.status_code == 422

    def test_empty_sessions_returns_200_with_zero(self, client: TestClient) -> None:
        resp = client.post("/heartbeat", json={"machine_id": "vm-1", "sessions": []})
        assert resp.status_code == 200
        assert resp.json()["accepted"] == 0

    def test_invalid_session_field_returns_422(self, client: TestClient) -> None:
        payload = {
            "machine_id": "vm-1",
            "sessions": [
                {
                    "session_id": "s-1",
                    "label": 123,
                    "seconds_since_change": "not-a-number",
                    "diff_pct": 0.0,
                    "stable_counter": 0,
                    "captured_at": "2026-06-24T08:15:00Z",
                }
            ],
        }
        resp = client.post("/heartbeat", json=payload)
        assert resp.status_code == 422

    def test_missing_sessions_field_returns_422(self, client: TestClient) -> None:
        resp = client.post("/heartbeat", json={"machine_id": "vm-1"})
        assert resp.status_code == 422

    def test_unknown_machine_id_auto_register(
        self, client: TestClient
    ) -> None:
        resp = client.post(
            "/heartbeat",
            json={
                "machine_id": "unknown-42",
                "sessions": [
                    {
                        "session_id": "s-1",
                        "label": "test",
                        "seconds_since_change": 0,
                        "diff_pct": 0.0,
                        "stable_counter": 0,
                        "captured_at": "2026-06-24T08:15:00Z",
                    }
                ],
            },
        )
        assert resp.status_code == 200
        assert resp.json()["accepted"] == 1
