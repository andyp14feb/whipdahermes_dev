from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine

from modules.command_router.adapters.persistence.command_repo import SQLCommandRepo
from modules.command_router.application.command_service import CommandService
from modules.command_router.command_router import create_command_router_module


class TestCommandRouter:
    def _app_with_repo(self) -> tuple[TestClient, SQLCommandRepo]:
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)
        repo = SQLCommandRepo(engine)
        service = CommandService(repo)
        app = FastAPI()
        app.include_router(create_command_router_module(service))
        client = TestClient(app)
        return client, repo

    def test_post_command_returns_200_with_command_id_and_state(self) -> None:
        client, _ = self._app_with_repo()

        response = client.post(
            "/command",
            json={"machine_id": "vm-1", "session_id": "sess-1", "payload": "ls"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["command_id"]
        assert body["state"] == "accepted"
        assert body["target"] == "vm-1:sess-1"

    def test_post_command_with_invalid_body_returns_422(self) -> None:
        client, _ = self._app_with_repo()

        response = client.post(
            "/command",
            json={"machine_id": "vm-1", "session_id": "sess-1", "payload": ""},
        )

        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_get_commands_returns_pending_commands(self) -> None:
        client, repo = self._app_with_repo()
        command = repo.enqueue("vm-1", "sess-1", "ls")
        repo.enqueue("vm-2", "sess-2", "pwd")

        response = client.get("/commands/vm-1")

        assert response.status_code == 200
        assert response.json() == {
            "commands": [
                {
                    "command_id": command.command_id,
                    "session_id": "sess-1",
                    "payload": "ls",
                }
            ]
        }

    def test_post_delivery_returns_200(self) -> None:
        client, repo = self._app_with_repo()
        command = repo.enqueue("vm-1", "sess-1", "ls")

        response = client.post(
            f"/commands/{command.command_id}/delivery",
            json={"delivered": True, "failure_reason": None},
        )

        assert response.status_code == 200
        assert response.json() == {"ok": "true"}

    def test_get_command_detail_returns_full_detail(self) -> None:
        client, repo = self._app_with_repo()
        command = repo.enqueue("vm-1", "sess-1", "ls")
        repo.update_state(
            command.command_id,
            "delivered",
            delivered_at="2026-06-26T00:00:01+00:00",
        )

        response = client.get(f"/commands/{command.command_id}")

        assert response.status_code == 200
        assert response.json() == {
            "command_id": command.command_id,
            "state": "delivered",
            "target": "vm-1:sess-1",
            "payload": "ls",
            "accepted_at": command.accepted_at,
            "delivered_at": "2026-06-26T00:00:01+00:00",
            "failure_reason": None,
        }
