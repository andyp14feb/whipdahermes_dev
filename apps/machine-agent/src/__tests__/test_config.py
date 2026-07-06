import os
import socket
import pytest
from config import AgentConfig, load_config


def test_load_config_reads_env_vars(monkeypatch):
    monkeypatch.setenv("MACHINE_ID", "vm-1")
    monkeypatch.setenv("API_URL", "http://localhost:8000")
    monkeypatch.setenv("INTERVAL", "5")
    monkeypatch.setenv("COMMAND_POLL_INTERVAL", "7")

    config = load_config()

    assert config.machine_id == "vm-1"
    assert config.api_url == "http://localhost:8000"
    assert config.interval == 5
    assert config.command_poll_interval == 7


def test_load_config_default_command_poll_interval(monkeypatch):
    monkeypatch.setenv("MACHINE_ID", "vm-1")
    monkeypatch.setenv("API_URL", "http://localhost:8000")
    monkeypatch.delenv("COMMAND_POLL_INTERVAL", raising=False)

    config = load_config()

    assert config.command_poll_interval == 5


def test_load_config_default_interval(monkeypatch):
    monkeypatch.setenv("MACHINE_ID", "vm-1")
    monkeypatch.setenv("API_URL", "http://localhost:8000")
    monkeypatch.delenv("INTERVAL", raising=False)

    config = load_config()

    assert config.interval == 2


def test_load_config_uses_hostname_when_machine_id_missing(monkeypatch):
    monkeypatch.delenv("MACHINE_ID", raising=False)
    monkeypatch.setenv("API_URL", "http://localhost:8000")

    config = load_config()
    assert config.machine_id == socket.gethostname()


def test_load_config_raises_on_missing_api_url(monkeypatch):
    monkeypatch.setenv("MACHINE_ID", "vm-1")
    monkeypatch.delenv("API_URL", raising=False)

    with pytest.raises(SystemExit, match="API_URL must be set"):
        load_config()


def test_load_config_raises_on_both_missing(monkeypatch):
    monkeypatch.delenv("MACHINE_ID", raising=False)
    monkeypatch.delenv("API_URL", raising=False)

    with pytest.raises(SystemExit, match="API_URL must be set"):
        load_config()


def test_load_config_raises_on_invalid_interval(monkeypatch):
    monkeypatch.setenv("MACHINE_ID", "vm-1")
    monkeypatch.setenv("API_URL", "http://localhost:8000")
    monkeypatch.setenv("INTERVAL", "not-a-number")

    with pytest.raises(SystemExit, match="INTERVAL must be an integer"):
        load_config()


def test_load_config_strips_whitespace(monkeypatch):
    monkeypatch.setenv("MACHINE_ID", "  vm-1  ")
    monkeypatch.setenv("API_URL", "  http://localhost:8000  ")

    config = load_config()

    assert config.machine_id == "vm-1"
    assert config.api_url == "http://localhost:8000"


def test_load_config_defaults_tmux_socket(monkeypatch):
    monkeypatch.setenv("MACHINE_ID", "vm-1")
    monkeypatch.setenv("API_URL", "http://localhost:8000")
    monkeypatch.delenv("TMUX_SOCKET", raising=False)

    config = load_config()

    assert config.tmux_socket == f"/tmp/tmux-{os.getuid()}/default"


def test_agent_config_dataclass_defaults():
    config = AgentConfig(machine_id="vm-1", api_url="http://localhost:8000")
    assert config.interval == 2
    assert config.tmux_socket is None
