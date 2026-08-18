"""Story 7.1 — E2E multi-machine aggregation validation tests.

Covers AC1 (two machines appear), AC3 (stale detection), and AC4 (identity stability).
AC2 (cross-machine session selection) is tested via the frontend Zustand store tests.
"""
from __future__ import annotations

import threading
import time
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from conftest import make_heartbeat_payload, _now_iso


def _send_heartbeat(client: TestClient, machine_id: str, sessions=None, captured_at=None) -> dict:
    payload = make_heartbeat_payload(machine_id, sessions, captured_at)
    return client.post("/heartbeat", json=payload).json()


def _get_machines(client: TestClient) -> list[dict]:
    return client.get("/machines").json()["machines"]


def _get_sessions(client: TestClient) -> list[dict]:
    return client.get("/sessions").json()["sessions"]


def _machine_ids(client: TestClient) -> set[str]:
    return {m["machine_id"] for m in _get_machines(client)}


def _session_ids(client: TestClient) -> set[str]:
    return {s["session_id"] for s in _get_sessions(client)}


class TestMultiMachineAggregation:
    """AC1 — Two machines appear in the dashboard."""

    def test_two_machines_visible_after_heartbeats(self, client: TestClient) -> None:
        _send_heartbeat(client, "vm-e2e-a")
        _send_heartbeat(client, "vm-e2e-b")
        machine_ids = _machine_ids(client)
        assert "vm-e2e-a" in machine_ids
        assert "vm-e2e-b" in machine_ids

    def test_sessions_from_both_machines_returned(self, client: TestClient) -> None:
        _send_heartbeat(client, "vm-e2e-c", sessions=[{
            "session_id": "vm-e2e-c-s1",
            "label": "shell",
            "preview": "$ ls",
            "seconds_since_change": 2,
            "diff_pct": 0.0,
            "stable_counter": 1,
            "cwd": "/home/vm-e2e-c",
            "captured_at": _now_iso(),
        }])
        _send_heartbeat(client, "vm-e2e-d", sessions=[{
            "session_id": "vm-e2e-d-s1",
            "label": "shell",
            "preview": "$ pwd",
            "seconds_since_change": 1,
            "diff_pct": 0.0,
            "stable_counter": 0,
            "cwd": "/home/vm-e2e-d",
            "captured_at": _now_iso(),
        }])
        sessions = _get_sessions(client)
        session_machine_map = {s["session_id"]: s["machine_id"] for s in sessions}
        assert session_machine_map["vm-e2e-c-s1"] == "vm-e2e-c"
        assert session_machine_map["vm-e2e-d-s1"] == "vm-e2e-d"

    def test_last_seen_at_is_recent(self, client: TestClient) -> None:
        _send_heartbeat(client, "vm-e2e-e")
        machines = _get_machines(client)
        vm = next(m for m in machines if m["machine_id"] == "vm-e2e-e")
        last_seen = datetime.fromisoformat(vm["last_seen_at"].replace("Z", "+00:00"))
        assert (datetime.now(timezone.utc) - last_seen).total_seconds() < 5

    def test_no_unexpected_machines_or_sessions(self, client: TestClient) -> None:
        machine_ids = _machine_ids(client)
        known = {"vm-e2e-a", "vm-e2e-b", "vm-e2e-c", "vm-e2e-d", "vm-e2e-e"}
        extra = machine_ids - known
        assert not extra, f"Unexpected machines: {extra}"


class TestStaleDetection:
    """AC3 — Stale detection when a machine stops reporting."""

    def test_stopped_machine_sessions_become_stale(self, client: TestClient) -> None:
        stale_machine_id = "vm-e2e-stale"
        active_machine_id = "vm-e2e-active"

        _send_heartbeat(client, stale_machine_id, sessions=[{
            "session_id": f"{stale_machine_id}-s1",
            "label": "shell",
            "preview": "$ echo work",
            "seconds_since_change": 2,
            "diff_pct": 0.0,
            "stable_counter": 1,
            "cwd": "/tmp",
            "captured_at": _now_iso(),
        }])
        _send_heartbeat(client, active_machine_id, sessions=[{
            "session_id": f"{active_machine_id}-s1",
            "label": "shell",
            "preview": "$ echo alive",
            "seconds_since_change": 2,
            "diff_pct": 0.0,
            "stable_counter": 1,
            "cwd": "/tmp",
            "captured_at": _now_iso(),
        }])

        sessions_before = _get_sessions(client)
        stale_session = next(s for s in sessions_before if s["machine_id"] == stale_machine_id)
        assert stale_session["status"] != "stale"

        time.sleep(4)
        _send_heartbeat(client, active_machine_id, sessions=[{
            "session_id": f"{active_machine_id}-s1",
            "label": "shell",
            "preview": "$ echo alive",
            "seconds_since_change": 2,
            "diff_pct": 0.0,
            "stable_counter": 1,
            "cwd": "/tmp",
            "captured_at": _now_iso(),
        }])

        sessions_after = _get_sessions(client)
        stale_sessions = [s for s in sessions_after if s["machine_id"] == stale_machine_id]
        active_sessions = [s for s in sessions_after if s["machine_id"] == active_machine_id]

        for s in stale_sessions:
            assert s["status"] == "stale", f"Session {s['session_id']} should be stale"
        for s in active_sessions:
            assert s["status"] != "stale", f"Active session {s['session_id']} should not be stale"

    def test_stopped_machine_still_present_in_machines(self, client: TestClient) -> None:
        time.sleep(4)
        machines = _get_machines(client)
        stale_machines = [m for m in machines if m["machine_id"] == "vm-e2e-stale"]
        assert len(stale_machines) == 1
        assert stale_machines[0]["last_seen_at"] is not None

    def test_running_machine_stays_active(self, client: TestClient) -> None:
        _send_heartbeat(client, "vm-e2e-active")
        sessions = _get_sessions(client)
        active_sessions = [s for s in sessions if s["machine_id"] == "vm-e2e-active"]
        for s in active_sessions:
            assert s["status"] != "stale"


class TestIdentityStability:
    """AC4 — Identity stability across refresh cycles."""

    def test_machine_ids_stable_across_heartbeats(self, client: TestClient) -> None:
        machine_id = "vm-e2e-stable"
        _send_heartbeat(client, machine_id)
        baseline_machine_ids = _machine_ids(client)

        for _ in range(4):
            _send_heartbeat(client, machine_id)
            current_machine_ids = _machine_ids(client)
            assert current_machine_ids == baseline_machine_ids

    def test_session_ids_stable_across_heartbeats(self, client: TestClient) -> None:
        machine_id = "vm-e2e-stable"
        session_id = "vm-e2e-stable-main"
        _send_heartbeat(client, machine_id, sessions=[{
            "session_id": session_id,
            "label": "main",
            "preview": "$ uptime",
            "seconds_since_change": 3,
            "diff_pct": 0.0,
            "stable_counter": 2,
            "cwd": "/workspace",
            "captured_at": _now_iso(),
        }])
        baseline_session_ids = _session_ids(client)

        for _ in range(4):
            _send_heartbeat(client, machine_id, sessions=[{
                "session_id": session_id,
                "label": "main",
                "preview": "$ uptime",
                "seconds_since_change": 3,
                "diff_pct": 0.0,
                "stable_counter": 2,
                "cwd": "/workspace",
                "captured_at": _now_iso(),
            }])
            current_session_ids = _session_ids(client)
            assert current_session_ids == baseline_session_ids

    def test_no_duplicate_entries_after_repeated_heartbeats(self, client: TestClient) -> None:
        machine_id = "vm-e2e-nodup"
        session_id = "vm-e2e-nodup-s1"

        for _ in range(5):
            _send_heartbeat(client, machine_id, sessions=[{
                "session_id": session_id,
                "label": "shell",
                "preview": "$ test",
                "seconds_since_change": 1,
                "diff_pct": 0.0,
                "stable_counter": 0,
                "cwd": "/tmp",
                "captured_at": _now_iso(),
            }])

        sessions = _get_sessions(client)
        matching = [s for s in sessions if s["session_id"] == session_id]
        assert len(matching) == 1, f"Expected 1 session, got {len(matching)}"

        machine_ids = [m for m in _get_machines(client) if m["machine_id"] == machine_id]
        assert len(machine_ids) == 1, f"Expected 1 machine, got {len(machine_ids)}"

    def test_session_count_per_machine_matches_expected(self, client: TestClient) -> None:
        machine_id = "vm-e2e-count"
        _send_heartbeat(client, machine_id, sessions=[
            {
                "session_id": f"{machine_id}-s1",
                "label": "shell",
                "preview": "$ ls",
                "seconds_since_change": 2,
                "diff_pct": 0.0,
                "stable_counter": 1,
                "cwd": "/tmp",
                "captured_at": _now_iso(),
            },
            {
                "session_id": f"{machine_id}-s2",
                "label": "editor",
                "preview": "vim main.py",
                "seconds_since_change": 5,
                "diff_pct": 1.0,
                "stable_counter": 0,
                "cwd": "/workspace",
                "captured_at": _now_iso(),
            },
        ])
        sessions = _get_sessions(client)
        machine_sessions = [s for s in sessions if s["machine_id"] == machine_id]
        assert len(machine_sessions) == 2


class TestAgentSimulation:
    """Simulated agents posting heartbeats in parallel (threaded smoke test)."""

    def test_parallel_heartbeat_posting(self, client: TestClient) -> None:
        errors = []

        def post_heartbeats(machine_id: str) -> None:
            try:
                for _ in range(3):
                    resp = client.post(
                        "/heartbeat",
                        json=make_heartbeat_payload(machine_id),
                    )
                    assert resp.status_code == 200
                    assert resp.json()["ok"] is True
            except Exception as e:
                errors.append(str(e))

        threads = [
            threading.Thread(target=post_heartbeats, args=("vm-parallel-1",)),
            threading.Thread(target=post_heartbeats, args=("vm-parallel-2",)),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, f"Errors during parallel heartbeat posting: {errors}"
        assert "vm-parallel-1" in _machine_ids(client)
        assert "vm-parallel-2" in _machine_ids(client)


class TestHealthEndpoint:
    """Sanity check that the test backend is running."""

    def test_health_returns_ok(self, client: TestClient) -> None:
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
