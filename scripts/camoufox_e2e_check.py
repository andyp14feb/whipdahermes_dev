from __future__ import annotations

import json
import time
from pathlib import Path
from urllib.request import Request, urlopen

from camoufox.sync_api import Camoufox

API = "http://localhost:8000"
APP = "http://localhost:3000"
OUT = Path("/home/andy/workspace/repositories/whipdahermes/whipdahermes_dev/.e2e-artifacts")
OUT.mkdir(exist_ok=True)


def post_json(path: str, payload: dict) -> dict:
    req = Request(
        API + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(path: str) -> dict:
    with urlopen(API + path, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def seed_machine(machine_id: str, session_id: str, preview: str) -> None:
    payload = {
        "machine_id": machine_id,
        "captured_at": "2026-06-27T00:00:00Z",
        "sessions": [
            {
                "session_id": session_id,
                "label": "camoufox-e2e",
                "preview": preview,
                "seconds_since_change": 1,
                "diff_pct": 0.0,
                "stable_counter": 0,
                "cwd": "/workspace/camoufox-e2e",
                "captured_at": "2026-06-27T00:00:00Z",
            }
        ],
    }
    result = post_json("/heartbeat", payload)
    assert result.get("ok") is True, result


# Seed visible data before opening dashboard.
seed_machine("camoufox-vm-a", "camoufox-vm-a-s1", "$ echo camoufox-a")
seed_machine("camoufox-vm-b", "camoufox-vm-b-s1", "$ echo camoufox-b")
api_machines = get_json("/machines")
api_sessions = get_json("/sessions")
print("API machines:", [m.get("machine_id") for m in api_machines.get("machines", [])])
print("API sessions:", [s.get("session_id") for s in api_sessions.get("sessions", [])])

with Camoufox(headless=True) as browser:
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.goto(APP, wait_until="networkidle", timeout=30000)
    page.screenshot(path=str(OUT / "dashboard-initial.png"), full_page=True)
    body = page.locator("body")
    text = body.inner_text(timeout=10000)
    print("PAGE_TEXT_START")
    print(text[:4000])
    print("PAGE_TEXT_END")

    required = ["camoufox-vm-a", "camoufox-vm-b"]
    missing = [item for item in required if item not in text]
    if missing:
        # Give React Query/polling one extra moment, then retry and capture again.
        time.sleep(5)
        page.reload(wait_until="networkidle", timeout=30000)
        page.screenshot(path=str(OUT / "dashboard-after-reload.png"), full_page=True)
        text = body.inner_text(timeout=10000)
        missing = [item for item in required if item not in text]

    assert not missing, f"Dashboard missing seeded machine ids: {missing}"
    assert "camoufox-e2e" in text, "Dashboard missing seeded session label"
    assert text.count("active") >= 2, "Expected both seeded sessions to be visible as active"
    print("CAMOUFOX_E2E_PASS")
