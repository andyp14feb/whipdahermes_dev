import subprocess

from capture.tmux_capture import capture_panes


def test_capture_panes_continues_after_single_pane_capture_failure(monkeypatch):
    calls: list[list[str]] = []

    def fake_run(cmd, capture_output, text, check):
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
