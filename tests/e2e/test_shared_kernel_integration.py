"""Story 1.2 — E2E integration tests for shared_kernel module.

Validates that the shared_kernel module works end-to-end: imports resolve,
value objects behave correctly, error envelopes follow the API contract,
time utilities produce valid ISO 8601 UTC timestamps, and DTOs serialize properly.
"""
import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
API_VENV_PYTHON = REPO / "apps" / "api-server" / ".venv" / "bin" / "python"
API_SRC = REPO / "apps" / "api-server" / "src"
SK_DIR = REPO / "apps" / "api-server" / "src" / "modules" / "shared_kernel"


def _run_shared_kernel_script(script: str) -> str:
    result = subprocess.run(
        [str(API_VENV_PYTHON), "-c", script],
        cwd=str(API_SRC),
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise AssertionError(
            f"Script failed (rc={result.returncode}):\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )
    return result.stdout.strip()


def test_shared_kernel_module_files_exist():
    expected_files = [
        "__init__.py",
        "ids.py",
        "time_utils.py",
        "error_envelope.py",
        "config.py",
        "dto/__init__.py",
        "dto/machine_dto.py",
        "dto/session_dto.py",
        "dto/command_dto.py",
        "dto/heartbeat_dto.py",
    ]
    for name in expected_files:
        path = SK_DIR / name
        assert path.exists(), f"Missing shared_kernel file: {name}"


def test_shared_kernel_module_imports_successfully():
    output = _run_shared_kernel_script(
        "from modules.shared_kernel import (\n"
        "    MachineId, SessionId, CommandId,\n"
        "    now_utc, parse_iso,\n"
        "    ErrorEnvelope, APIError,\n"
        "    Settings,\n"
        ");\n"
        "from modules.shared_kernel.dto import (\n"
        "    MachineDTO, SessionDTO, CommandDTO, HeartbeatPayload,\n"
        ");\n"
        "print('OK')\n"
    )
    assert output == "OK"


def test_id_value_objects_equality_and_display():
    output = _run_shared_kernel_script(
        "from modules.shared_kernel.ids import MachineId, SessionId, CommandId\n"
        "\n"
        "mid = MachineId('machine-001')\n"
        "sid = SessionId('sess-042')\n"
        "cid = CommandId('cmd-099')\n"
        "\n"
        "# Equality\n"
        "assert MachineId('machine-001') == MachineId('machine-001')\n"
        "assert MachineId('a') != MachineId('b')\n"
        "\n"
        "# Display\n"
        "assert str(mid) == 'machine-001'\n"
        "assert repr(mid) == \"MachineId('machine-001')\"\n"
        "\n"
        "# Cross-type safety\n"
        "assert not isinstance(mid, SessionId)\n"
        "assert not isinstance(sid, CommandId)\n"
        "\n"
        "# Empty values rejected\n"
        "try:\n"
        "    MachineId('')\n"
        "    assert False, 'Expected ValueError'\n"
        "except ValueError:\n"
        "    pass\n"
        "\n"
        "print('OK')\n"
    )
    assert output == "OK"


def test_now_utc_produces_valid_iso8601():
    output = _run_shared_kernel_script(
        "from datetime import datetime, timezone\n"
        "from modules.shared_kernel import now_utc, parse_iso\n"
        "\n"
        "ts = now_utc()\n"
        "\n"
        "# Must be parseable as ISO 8601\n"
        "dt = datetime.fromisoformat(ts)\n"
        "assert dt.tzinfo is not None, 'Timestamp must have timezone'\n"
        "assert dt.tzinfo == timezone.utc, 'Timestamp must be UTC'\n"
        "\n"
        "# Round-trip through parse_iso\n"
        "dt2 = parse_iso(ts)\n"
        "assert dt2.tzinfo == timezone.utc\n"
        "print('OK')\n"
    )
    assert output == "OK"


def test_error_envelope_follows_api_contract():
    output = _run_shared_kernel_script(
        "import json\n"
        "from modules.shared_kernel import ErrorEnvelope, APIError\n"
        "\n"
        "# Basic error without details\n"
        "err = APIError(code='NOT_FOUND', message='Resource not found', status_code=404)\n"
        "env = ErrorEnvelope.from_error(err)\n"
        "assert env == {'error': {'code': 'NOT_FOUND', 'message': 'Resource not found'}}\n"
        "assert 'details' not in env['error']\n"
        "\n"
        "# Error with details\n"
        "err2 = APIError(\n"
        "    code='VALIDATION_FAILED',\n"
        "    message='Invalid input',\n"
        "    details={'field': 'machine_id', 'reason': 'required'},\n"
        "    status_code=422,\n"
        ")\n"
        "env2 = ErrorEnvelope.from_error(err2)\n"
        "assert env2 == {\n"
        "    'error': {\n"
        "        'code': 'VALIDATION_FAILED',\n"
        "        'message': 'Invalid input',\n"
        "        'details': {'field': 'machine_id', 'reason': 'required'},\n"
        "    }\n"
        "}\n"
        "\n"
        "# JSON serialization round-trip\n"
        "j = json.dumps(env2)\n"
        "parsed = json.loads(j)\n"
        "assert parsed == env2\n"
        "print('OK')\n"
    )
    assert output == "OK"


def test_settings_loads_config():
    output = _run_shared_kernel_script(
        "from modules.shared_kernel import Settings\n"
        "\n"
        "settings = Settings()\n"
        "\n"
        "# Must have expected attributes\n"
        "assert hasattr(settings, 'app_name')\n"
        "assert hasattr(settings, 'debug')\n"
        "assert hasattr(settings, 'api_token')\n"
        "assert hasattr(settings, 'heartbeat_interval_seconds')\n"
        "assert hasattr(settings, 'database_url')\n"
        "\n"
        "# Default values should be set\n"
        "assert settings.app_name == 'whipai-api'\n"
        "assert settings.debug is False\n"
        "assert settings.heartbeat_interval_seconds == 30\n"
        "\n"
        "# Secrets are wrapped (not bare strings)\n"
        "from pydantic import SecretStr\n"
        "assert isinstance(settings.api_token, SecretStr)\n"
        "assert isinstance(settings.database_url, SecretStr)\n"
        "\n"
        "print('OK')\n"
    )
    assert output == "OK"


def test_dto_models_validate_correctly():
    output = _run_shared_kernel_script(
        "import json\n"
        "from modules.shared_kernel.dto import (\n"
        "    MachineDTO, SessionDTO, CommandDTO, HeartbeatPayload,\n"
        ")\n"
        "\n"
        "machine = MachineDTO(\n"
        "    machine_id='m-001', display_name='dev-laptop', last_seen_at='2026-06-26T12:00:00+00:00'\n"
        ")\n"
        "assert machine.model_dump()['machine_id'] == 'm-001'\n"
        "\n"
        "session = SessionDTO(\n"
        "    machine_id='m-001', session_id='s-001', label='tmux:0.0',\n"
        "    status='active', seconds_since_change=5, last_seen_at='2026-06-26T12:00:00+00:00',\n"
        "    preview='ls -la', cwd='/home/user',\n"
        ")\n"
        "assert session.model_dump()['session_id'] == 's-001'\n"
        "\n"
        "command = CommandDTO(\n"
        "    command_id='c-001', session_id='s-001', machine_id='m-001',\n"
        "    payload='ls -la', state='delivered', requested_at='2026-06-26T12:00:00+00:00',\n"
        "    delivered_at='2026-06-26T12:00:01+00:00',\n"
        ")\n"
        "assert command.model_dump()['command_id'] == 'c-001'\n"
        "\n"
        "heartbeat = HeartbeatPayload(\n"
        "    machine_id='m-001',\n"
        "    sessions=[session.model_dump()],\n"
        ")\n"
        "assert heartbeat.model_dump()['machine_id'] == 'm-001'\n"
        "assert len(heartbeat.model_dump()['sessions']) == 1\n"
        "\n"
        "# JSON round-trip\n"
        "j = json.dumps(heartbeat.model_dump())\n"
        "parsed = json.loads(j)\n"
        "assert parsed == heartbeat.model_dump()\n"
        "print('OK')\n"
    )
    assert output == "OK"


def test_dto_validation_rejects_invalid_data():
    output = _run_shared_kernel_script(
        "from modules.shared_kernel.dto import MachineDTO\n"
        "\n"
        "# Missing required field should raise ValidationError\n"
        "try:\n"
        "    MachineDTO()\n"
        "    print('FAIL: Expected validation error')\n"
        "except Exception as e:\n"
        "    assert type(e).__name__ == 'ValidationError'\n"
        "    print('OK')\n"
    )
    assert output == "OK"


def test_api_error_carries_status_code():
    output = _run_shared_kernel_script(
        "from modules.shared_kernel import APIError\n"
        "\n"
        "err = APIError(code='TIMEOUT', message='Request timed out', status_code=504)\n"
        "assert err.code == 'TIMEOUT'\n"
        "assert err.message == 'Request timed out'\n"
        "assert err.status_code == 504\n"
        "assert err.details is None\n"
        "\n"
        "# With details\n"
        "err2 = APIError(code='BUSY', message='Machine busy', details={'queue': 3}, status_code=429)\n"
        "assert err2.details == {'queue': 3}\n"
        "assert err2.status_code == 429\n"
        "print('OK')\n"
    )
    assert output == "OK"
