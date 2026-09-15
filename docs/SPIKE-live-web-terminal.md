# SPIKE: Live Web Terminal (P0)

Interactive tmux pane in the browser via **xterm.js + WebSocket**, bridged through the API to the machine-agent.

## Architecture

```text
Browser (xterm.js)
  WS /ws/terminal/{machine_id}/{session_id}?token=...
       ↕
API TerminalHub (in-memory)
       ↕
Machine Agent (outbound WS)
  WS /ws/agent/{machine_id}?token=...
       ↕
tmux: capture-pane snapshot + pipe-pane stream
      send-keys -l for keystrokes
```

- **Atch**: no live PTY — API and agent reject with a clear error.
- Existing heartbeat / snapshot / `POST /command` poll path is unchanged.

## Auth

Shared token via env `WHIPAI_TERMINAL_TOKEN` (query `token=` or header `X-WhipAI-Terminal-Token`).

- If unset: WS accepts without token (dev convenience).
- Dashboard: optional `VITE_WHIPAI_TERMINAL_TOKEN` (else rely on empty token when API also empty).
- Agent: reads `WHIPAI_TERMINAL_TOKEN`.

## How to run (local preferred)

From repo root (example ports matching G470 smoke: API **8004**, dashboard **3003**):

```bash
export WHIPAI_TERMINAL_TOKEN=dev-terminal-token
export API_PORT=8004
export PORT=3003
export DASHBOARD_PORT=3003

# API
cd apps/api-server
WHIPAI_TERMINAL_TOKEN=dev-terminal-token API_PORT=8004 \
  uvicorn src.main:app --app-dir src --host 0.0.0.0 --port 8004 --reload

# Dashboard (proxies /ws to API)
cd apps/web-dashboard
WHIPAI_TERMINAL_TOKEN=dev-terminal-token \
VITE_WHIPAI_TERMINAL_TOKEN=dev-terminal-token \
API_PROXY_TARGET=http://127.0.0.1:8004 PORT=3003 npm run dev

# Agent (on the machine with tmux)
cd apps/machine-agent
pip install -e .
WHIPAI_TERMINAL_TOKEN=dev-terminal-token \
MACHINE_ID=<your-machine-id> \
API_URL=http://127.0.0.1:8004 \
SESSION_BACKENDS=tmux \
python -m main
```

If using Docker only for api+dashboard: set `WHIPAI_TERMINAL_TOKEN` in `.env`, rebuild **only** those two services if needed. Do not compose-down CMS or unrelated stacks.

## WS URLs

| Role    | URL |
|---------|-----|
| Browser | `ws://<api-host>:<port>/ws/terminal/{machine_id}/{session_id}?token=...` |
| Agent   | `ws://<api-host>:<port>/ws/agent/{machine_id}?token=...` |

Via Vite proxy (dashboard origin): `ws://localhost:3003/ws/terminal/...`

## Test steps

1. Ensure a **tmux** session exists on the agent machine and appears in the dashboard.
2. Open dashboard (`http://localhost:3003`).
3. Select that tmux session in a Window.
4. Click **Live**.
5. Type in the xterm pane — characters should appear in the real tmux pane (`tmux attach -t ...`).
6. Output from the real pane (e.g. `echo hello` in tmux) should stream into the browser.
7. Select an **atch** session → Live disabled / error: not supported.

## P1 blockers / follow-ups

- Snapshot poll + pipe-pane can flicker; prefer tmux control mode (`tmux -C`) or a single reliable stream.
- No multi-viewer sync / presence; hub is in-memory (single API process only).
- Token is shared secret, not per-user session auth.
- Resize maps to `resize-pane` (pane size), not necessarily the outer client size.
- Special keys: relies on xterm `onData` + `send-keys -l`; some sequences may need key-name mapping.
- Agent WS reconnect storm under flaky networks.
- Production TLS / cookie auth / CSRF for WS.
- Dashboard build needs token baked or a small settings field for token.
- Atch live still out of scope.
