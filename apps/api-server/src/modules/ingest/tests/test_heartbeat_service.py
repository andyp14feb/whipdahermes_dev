from __future__ import annotations

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
