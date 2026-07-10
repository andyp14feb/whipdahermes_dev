import logging
import subprocess
from pathlib import Path

from capture.tmux_capture import capture_panes


def test_capture_panes_continues_after_single_pane_capture_failure(monkeypatch):
    calls: list[list[str]] = []

    def fake_run(cmd, capture_output, text, check, timeout=None):
        calls.append(cmd)
        if cmd[:2] == ["tmux", "list-panes"]:
            return subprocess.CompletedProcess(
                cmd,
                0,
                stdout="pane-a\t/tmp/a\npane-b\t/tmp/b\n",
                stderr="",
            )
        if cmd[-2] == "pane-a":
            raise subprocess.CalledProcessError(1, cmd, stderr="pane gone")
        return subprocess.CompletedProcess(cmd, 0, stdout="pane b output", stderr="")

    monkeypatch.setattr(subprocess, "run", fake_run)

    assert capture_panes() == [
        {"target": "pane-b", "text": "pane b output", "cwd": "/tmp/b"}
    ]
    assert calls == [
        ["tmux", "list-panes", "-a", "-F", "#{session_name}:#{window_index}.#{pane_index}\t#{pane_current_path}"],
        ["tmux", "capture-pane", "-t", "pane-a", "-p"],
        ["tmux", "capture-pane", "-t", "pane-b", "-p"],
    ]


def test_capture_panes_uses_configured_tmux_socket(monkeypatch):
    calls: list[list[str]] = []

    def fake_run(cmd, capture_output, text, check, timeout=None):
        calls.append(cmd)
        if "list-panes" in cmd:
            return subprocess.CompletedProcess(cmd, 0, stdout="pane-a\t/tmp/a\n", stderr="")
        return subprocess.CompletedProcess(cmd, 0, stdout="pane a output", stderr="")

    monkeypatch.setattr(subprocess, "run", fake_run)

    assert capture_panes("/host-tmux/default") == [
        {"target": "pane-a", "text": "pane a output", "cwd": "/tmp/a"}
    ]
    assert calls == [
        ["tmux", "-S", "/host-tmux/default", "list-panes", "-a", "-F", "#{session_name}:#{window_index}.#{pane_index}\t#{pane_current_path}"],
        ["tmux", "-S", "/host-tmux/default", "capture-pane", "-t", "pane-a", "-p"],
    ]


def test_capture_panes_warns_when_socket_missing(monkeypatch, caplog, tmp_path):
    missing_socket = str(tmp_path / "no-socket")
    calls: list[list[str]] = []

    def fake_run(cmd, capture_output, text, check, timeout=None):
        calls.append(cmd)
        raise subprocess.CalledProcessError(1, cmd, stderr="no socket")

    monkeypatch.setattr(subprocess, "run", fake_run)

    with caplog.at_level(logging.WARNING):
        assert capture_panes(missing_socket) == []

    assert calls == [["tmux", "-S", missing_socket, "list-panes", "-a", "-F", "#{session_name}:#{window_index}.#{pane_index}\t#{pane_current_path}"]]
    assert f"tmux socket unavailable at {missing_socket}" in caplog.text


def test_capture_panes_warns_when_binary_missing(monkeypatch, caplog):
    def fake_run(cmd, capture_output, text, check, timeout=None):
        raise FileNotFoundError("tmux not installed")

    monkeypatch.setattr(subprocess, "run", fake_run)

    with caplog.at_level(logging.WARNING):
        assert capture_panes() == []

    assert "tmux binary not found" in caplog.text


def test_capture_panes_warns_on_list_panes_failure(monkeypatch, caplog):
    def fake_run(cmd, capture_output, text, check, timeout=None):
        raise subprocess.CalledProcessError(1, cmd, stderr="list panes failed")

    monkeypatch.setattr(subprocess, "run", fake_run)

    with caplog.at_level(logging.WARNING):
        assert capture_panes() == []

    assert "list panes failed" in caplog.text
