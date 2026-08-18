from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine

from modules.machine_registry.adapters.persistence.machine_repo import SQLMachineRepo
from modules.machine_registry.application.machine_service import MachineService
from modules.machine_registry.domain.machine import Machine
from modules.machine_registry.machine_registry import create_machine_registry_module


class TestMachineRouter:
    def _app_with_repo(self) -> tuple[TestClient, SQLMachineRepo]:
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)
        repo = SQLMachineRepo(engine)
        service = MachineService(repo)
        app = FastAPI()
        app.include_router(create_machine_registry_module(service))
        client = TestClient(app)
        return client, repo

    def test_get_machines_returns_machine_list(self) -> None:
        client, repo = self._app_with_repo()
        repo.upsert(
            Machine(
                machine_id="vm-1",
                display_name="VM 1",
                last_seen_at="2026-06-24T08:15:00Z",
                session_count=3,
            )
        )

        response = client.get("/machines")

        assert response.status_code == 200
        assert response.json() == {
            "machines": [
                {
                    "machine_id": "vm-1",
                    "display_name": "VM 1",
                    "last_seen_at": "2026-06-24T08:15:00Z",
                    "session_count": 3,
                    "is_stale": False,
                }
            ]
        }

    def test_get_machines_returns_empty_list_when_no_machines(self) -> None:
        client, _ = self._app_with_repo()

        response = client.get("/machines")

        assert response.status_code == 200
        assert response.json() == {"machines": []}

    def test_response_shape_matches_api_contract(self) -> None:
        client, _ = self._app_with_repo()

        response = client.get("/machines")

        assert response.status_code == 200
        body = response.json()
        assert set(body.keys()) == {"machines"}
        assert isinstance(body["machines"], list)

    def test_delete_machine_removes_known_machine(self) -> None:
        client, repo = self._app_with_repo()
        repo.upsert(
            Machine(
                machine_id="vm-1",
                display_name="VM 1",
                last_seen_at="2026-06-24T08:15:00Z",
                session_count=3,
            )
        )

        response = client.delete("/machines/vm-1")

        assert response.status_code == 200
        assert response.json() == {"status": "deleted", "machine_id": "vm-1"}
        assert client.get("/machines").json() == {"machines": []}

    def test_delete_machine_returns_not_found_when_unknown(self) -> None:
        client, _ = self._app_with_repo()

        response = client.delete("/machines/missing")

        assert response.status_code == 200
        assert response.json() == {"status": "not_found", "machine_id": "missing"}
