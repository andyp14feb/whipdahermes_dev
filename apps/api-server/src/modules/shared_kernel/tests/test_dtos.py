from modules.shared_kernel.dto.machine_dto import MachineDTO
from modules.shared_kernel.dto.session_dto import SessionDTO
from modules.shared_kernel.dto.command_dto import CommandDTO
from modules.shared_kernel.dto.heartbeat_dto import HeartbeatPayload


class TestMachineDTO:
    def test_minimal(self) -> None:
        dto = MachineDTO(
            machine_id="m-001",
            display_name="Workstation",
            last_seen_at="2025-01-15T10:30:00+00:00",
        )
        assert dto.machine_id == "m-001"
        assert dto.display_name == "Workstation"


class TestSessionDTO:
    def test_required_fields(self) -> None:
        dto = SessionDTO(
            machine_id="m-001",
            session_id="s-001",
            label="tmux main",
            status="active",
            seconds_since_change=42,
            last_seen_at="2025-01-15T10:30:00+00:00",
        )
        assert dto.preview is None
        assert dto.cwd is None

    def test_all_fields(self) -> None:
        dto = SessionDTO(
            machine_id="m-001",
            session_id="s-001",
            label="tmux main",
            status="active",
            seconds_since_change=42,
            last_seen_at="2025-01-15T10:30:00+00:00",
            preview="echo hello",
            cwd="/home/user",
        )
        assert dto.preview == "echo hello"
        assert dto.cwd == "/home/user"


class TestCommandDTO:
    def test_required_fields(self) -> None:
        dto = CommandDTO(
            command_id="c-001",
            session_id="s-001",
            machine_id="m-001",
            payload="ls -la",
            state="pending",
            requested_at="2025-01-15T10:30:00+00:00",
        )
        assert dto.delivered_at is None
        assert dto.failure_reason is None

    def test_all_fields(self) -> None:
        dto = CommandDTO(
            command_id="c-001",
            session_id="s-001",
            machine_id="m-001",
            payload="ls -la",
            state="delivered",
            requested_at="2025-01-15T10:30:00+00:00",
            delivered_at="2025-01-15T10:30:05+00:00",
            failure_reason=None,
        )
        assert dto.state == "delivered"
        assert dto.delivered_at == "2025-01-15T10:30:05+00:00"


class TestHeartbeatPayload:
    def test_empty_sessions(self) -> None:
        payload = HeartbeatPayload(machine_id="m-001", sessions=[])
        assert payload.machine_id == "m-001"
        assert payload.sessions == []

    def test_with_sessions(self) -> None:
        session = SessionDTO(
            machine_id="m-001",
            session_id="s-001",
            label="main",
            status="active",
            seconds_since_change=10,
            last_seen_at="2025-01-15T10:30:00+00:00",
        )
        payload = HeartbeatPayload(
            machine_id="m-001",
            sessions=[session],
        )
        assert len(payload.sessions) == 1
        assert payload.sessions[0].session_id == "s-001"
