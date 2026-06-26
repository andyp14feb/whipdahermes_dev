"""CLI script that posts heartbeats as a simulated machine agent.

Usage:
    python tests/e2e/simulate_agent.py --machine-id "vm-e2e-a" [--interval 30] [--backend "http://localhost:8000"]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

REPO = Path(__file__).resolve().parents[2]


def make_heartbeat_payload(machine_id: str) -> dict:
    return {
        "machine_id": machine_id,
        "sessions": [
            {
                "session_id": f"{machine_id}-session-1",
                "label": f"shell on {machine_id}",
                "preview": f"$ echo heartbeat at {datetime.now(timezone.utc).isoformat()}",
                "seconds_since_change": 5,
                "diff_pct": 0.0,
                "stable_counter": 1,
                "cwd": f"/home/{machine_id}",
                "captured_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
        ],
    }


def send_heartbeat(backend_url: str, machine_id: str) -> bool:
    payload = make_heartbeat_payload(machine_id)
    data = json.dumps(payload).encode("utf-8")
    req = Request(
        f"{backend_url}/heartbeat",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            if body.get("ok"):
                print(f"[{machine_id}] Heartbeat accepted ({body.get('accepted', 0)} sessions)")
                return True
            print(f"[{machine_id}] Heartbeat rejected: {body}")
            return False
    except Exception as e:
        print(f"[{machine_id}] Error: {e}", file=sys.stderr)
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulate a machine agent posting heartbeats")
    parser.add_argument("--machine-id", required=True, help="Machine identifier")
    parser.add_argument("--interval", type=int, default=30, help="Heartbeat interval in seconds")
    parser.add_argument("--backend", default="http://localhost:8000", help="Backend URL")
    parser.add_argument("--count", type=int, default=0, help="Number of heartbeats (0 = infinite)")
    args = parser.parse_args()

    count = 0
    while True:
        send_heartbeat(args.backend, args.machine_id)
        count += 1
        if args.count and count >= args.count:
            break
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
