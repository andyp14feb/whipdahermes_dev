import subprocess

from capture.atch_capture import capture_sessions


def test_capture_sessions_reads_active_atch_logs(monkeypatch):
    calls = []

    def fake_run(cmd, capture_output, text, check, timeout):
        calls.append(cmd)
        if cmd == ["atch", "list"]:
            return subprocess.CompletedProcess(cmd, 0, stdout="worker [attached]\nbuild\n", stderr="")
        return subprocess.CompletedProcess(cmd, 0, stdout=f"output for {cmd[-1]}", stderr="")

    monkeypatch.setattr(subprocess, "run", fake_run)

    assert capture_sessions() == [
        {"backend": "atch", "target": "worker", "label": "worker", "text": "output for worker", "cwd": None},
        {"backend": "atch", "target": "build", "label": "build", "text": "output for build", "cwd": None},
    ]
    assert calls[0] == ["atch", "list"]
    assert calls[1][:3] == ["atch", "tail", "-n"]


def test_capture_sessions_returns_empty_when_atch_is_not_installed(monkeypatch):
    monkeypatch.setattr(subprocess, "run", lambda *args, **kwargs: (_ for _ in ()).throw(FileNotFoundError()))
    assert capture_sessions() == []
