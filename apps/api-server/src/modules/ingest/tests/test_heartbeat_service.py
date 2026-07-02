from __future__ import annotations

import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from modules.command_router.adapters.persistence.command_repo import SQLCommandRepo
from modules.command_router.application.command_service import CommandService
from modules.ingest.ingest import register_ingest_module
from modules.machine_registry.adapters.persistence.machine_repo import (
    SQLMachineRepo,
    create_machine_engine,
)
from modules.machine_registry.application.machine_service import MachineService
from modules.session_state.adapters.persistence.session_repo import SQLSessionRepo
from modules.session_state.session_state import create_session_state_module
from modules.shared_kernel.error_envelope import APIError
from modules.shared_kernel.ids import MachineId
from modules.ingest.domain.heartbeat_payload import HeartbeatPayload, SessionSnapshot
from modules.ingest.application.heartbeat_service import HeartbeatService


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


class FakeFailingMachineRegistry:
    def upsert_machine(self, machine_id: MachineId, last_seen_at: str) -> None:
        raise APIError(code="DB_ERROR", message="Database unavailable", status_code=500)


class TestHeartbeatService:
    def test_process_heartbeat_calls_both_ports(self) -> None:
        registry = FakeMachineRegistry()
        upserter = FakeSessionUpserter()
        service = HeartbeatService(machine_registry=registry, session_state=upserter)

        session = SessionSnapshot(
            session_id="miniwa",
            label="miniwa",
            preview="echo hello",
            seconds_since_change=12,
            diff_pct=0.0,
            stable_counter=5,
            cwd="/home/user/repos/miniwa",
            captured_at="2026-06-24T08:15:00Z",
        )
        payload = HeartbeatPayload(machine_id="vm-1", sessions=[session])

        accepted = service.process_heartbeat(payload)

        assert accepted == 1
        assert len(registry.calls) == 1
        assert registry.calls[0][0] == MachineId("vm-1")
        assert len(upserter.calls) == 1
        assert upserter.calls[0][0] == MachineId("vm-1")
        assert upserter.calls[0][1] == [session]

    def test_unknown_machine_id_auto_registers(self) -> None:
        registry = FakeMachineRegistry()
        upserter = FakeSessionUpserter()
        service = HeartbeatService(machine_registry=registry, session_state=upserter)

        payload = HeartbeatPayload(machine_id="unknown-99", sessions=[])
        service.process_heartbeat(payload)

        assert registry.calls[0][0] == MachineId("unknown-99")

    def test_multiple_sessions_returned_as_count(self) -> None:
        registry = FakeMachineRegistry()
        upserter = FakeSessionUpserter()
        service = HeartbeatService(machine_registry=registry, session_state=upserter)

        s1 = SessionSnapshot(
            session_id="s-1",
            label="one",
            seconds_since_change=0,
            diff_pct=0.0,
            stable_counter=0,
            captured_at="2026-06-24T08:15:00Z",
        )
        s2 = SessionSnapshot(
            session_id="s-2",
            label="two",
            seconds_since_change=0,
            diff_pct=0.0,
            stable_counter=0,
            captured_at="2026-06-24T08:15:00Z",
        )
        payload = HeartbeatPayload(machine_id="vm-1", sessions=[s1, s2])

        accepted = service.process_heartbeat(payload)
        assert accepted == 2

    def test_machine_registry_error_propagates(self) -> None:
        registry = FakeFailingMachineRegistry()
        upserter = FakeSessionUpserter()
        service = HeartbeatService(machine_registry=registry, session_state=upserter)

        payload = HeartbeatPayload(machine_id="vm-1", sessions=[])

        try:
            service.process_heartbeat(payload)
            assert False, "Expected APIError"
        except APIError as e:
            assert e.code == "DB_ERROR"
            assert e.status_code == 500


class TestConcurrentHeartbeatWithSharedEngine:
    def test_concurrent_heartbeats_on_file_backed_db(self) -> None:
        db_path = Path(tempfile.mktemp(suffix=".db"))
        try:
            shared_engine = create_machine_engine(f"sqlite:///{db_path}")

            machine_repo = SQLMachineRepo(shared_engine)
            session_repo = SQLSessionRepo(shared_engine)
            command_repo = SQLCommandRepo(shared_engine)

            machine_service = MachineService(machine_repo)
            command_service = CommandService(command_repo)

            app = FastAPI()
            register_ingest_module(
                app,
                machine_registry_upserter=machine_service,
                session_upserter=create_session_state_module(session_repo),
            )

            client = TestClient(app)
            n_threads = 5
            iterations_per_thread = 3
            errors: list[Exception] = []

            def heartbeat_request(machine_num: int) -> int:
                machine_id = f"concurrent-vm-{machine_num}"
                payload = {
                    "machine_id": machine_id,
                    "sessions": [
                        {
                            "session_id": f"session-{machine_num}-{i}",
                            "label": f"Session {i}",
                            "preview": "ps aux",
                            "seconds_since_change": 0,
                            "diff_pct": 0.0,
                            "stable_counter": i,
                            "cwd": "/tmp",
                            "captured_at": "2026-07-01T12:00:00Z",
                        }
                        for i in range(3)
                    ],
                }
                resp = client.post("/heartbeat", json=payload)
                if resp.status_code != 200:
                    raise RuntimeError(
                        f"heartbeat failed (status={resp.status_code} body={resp.text})"
                    )
                return resp.json()["accepted"]

            with ThreadPoolExecutor(max_workers=n_threads) as pool:
                futures = [
                    pool.submit(heartbeat_request, n)
                    for n in range(n_threads * iterations_per_thread)
                ]
                for future in as_completed(futures):
                    try:
                        result = future.result()
                        assert result == 3
                    except Exception as exc:
                        errors.append(exc)

            assert not errors, f"Concurrent heartbeat errors: {errors}"

            machines = machine_repo.list_all()
            assert len(machines) == n_threads * iterations_per_thread

        finally:
            shared_engine.dispose()
            db_path.unlink(missing_ok=True)
