# SPIKE: Live Web Terminal (P0 → P2)

Interactive tmux pane in the browser via **xterm.js + WebSocket**, bridged through the API to the machine-agent.

## Architecture

```text
Browser (xterm.js) × up to 4 Live windows
  WS /ws/terminal/{machine_id}/{session_id}?token=...
       ↕
API TerminalHub (in-memory)
  - multiplexes many browser WS ↔ one agent WS per machine
  - up to 4 distinct live session streams per machine
  - multiple browsers may watch the same session (fan-out)
       ↕
Machine Agent (outbound WS)
  WS /ws/agent/{machine_id}?token=...
  - one multiplexed agent connection
  - up to 4 concurrent TmuxLiveSession streams
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

## Concurrency (P1)

| Layer | Limit | Behavior |
|-------|-------|----------|
| Dashboard | 4 concurrent Live mounts | Extra **Live** buttons disabled until a Live is closed |
| API hub | 4 distinct `session_id`s per `machine_id` | 5th unique session rejected with error; same session may have multiple viewers |
| Machine agent | 4 concurrent `TmuxLiveSession`s | Extra subscribe returns error; WS sends are thread-safe |

Heartbeat, snapshot polling, and command poll/execute paths are independent of the live terminal WS and keep working while Lives are open.

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

## Test steps (single Live — P0)

1. Ensure a **tmux** session exists on the agent machine and appears in the dashboard.
2. Open dashboard (`http://localhost:3003`).
3. Select that tmux session in a Window.
4. Click **Live**.
5. Type in the xterm pane — characters should appear in the real tmux pane (`tmux attach -t ...`).
6. Output from the real pane (e.g. `echo hello` in tmux) should stream into the browser.
7. Select an **atch** session → Live disabled / error: not supported.

## Test steps (multi Live — P1, up to 4)

Prereq: at least **4 distinct tmux sessions** on the same machine (or mix machines), visible in the dashboard. Agent connected (status reaches `ready`).

1. In the dashboard header, click **Add window** until you have **4 windows**.
2. In each window, pick a **different tmux** session (not atch).
3. Click **Live** in window 1 → status should become `ready`; type a unique marker (e.g. `echo LIVE1`).
4. Click **Live** in windows 2–4 the same way (`echo LIVE2` … `LIVE4`).
5. Confirm all four stay **Live On** at once (no window drops back to snapshot preview).
6. In a real tmux client, verify each pane received only its own input; browser panes show independent output.
7. Click **Live** on a 5th window (add window 5 first) → button disabled or feedback about max 4 concurrent Lives.
8. Close Live on one window → the 5th window’s Live becomes available; open it and confirm stream works.
9. Optional: open Live on the **same** session in two windows → both should receive the same output (hub fan-out).
10. While 4 Lives are open, confirm heartbeat still updates machine list / session status and **Command** panel still queues commands.
11. Atch session → Live remains disabled / rejected.

## P2 polish (done)

| Item | Behavior |
|------|----------|
| Browser WS reconnect | Auto-retry with exponential backoff + jitter (0.5s → 15s). Status shows `reconnecting…` then hub/agent statuses (`connecting` / `waiting for agent` / `ready`). Fatal close codes `4401` (token) and `4403` (atch) do not retry. |
| Agent WS reconnect | Outbound WS reconnects with exponential backoff (1s → 30s). Remembers `_desired_sessions` across drops; on open re-subscribes them. Hub still re-sends `subscribe` for waiting browsers (duplicate subscribe → `refresh_for_viewer`). |
| Resize sync | xterm `fit` → debounced `resize` WS (150ms, skip unchanged cols/rows). Agent runs `resize-window` then `resize-pane`. ResizeObserver stays rAF-debounced (do not reintroduce fit loop freeze from pre-`f718c33`). |
| UX leftovers (#11) | Max-4 Live rejection still shows toast; caret stays on typing cell after fit/focus. |
| Status hardening | LiveTerminal surfaces: `connecting`, `waiting_agent`, `reconnecting`, `ready`, `agent_disconnected`, `error` (+ message), `closed`. Errors clear when a new socket opens / status becomes `ready`. |

### Verify reconnect

1. Open Live on a tmux session until status is `ready`.
2. Kill/restart the API process (or block the browser WS briefly via DevTools → Network offline then online).
3. Status should flip to `reconnecting…`, then `connecting` / `waiting for agent` / `ready` without clicking Live again.
4. Type again — input should reach tmux.

### Verify resize

1. Open Live; note tmux pane size (`tmux display -p -t <target> '#{pane_width}x#{pane_height}'`).
2. Drag the SessionWindow resize handle taller/wider (or resize the browser).
3. After ~150ms debounce, pane width/height should track xterm cols/rows.
4. Rapidly resize — UI must stay responsive (no fit-loop freeze).

## Remaining blockers / follow-ups (P3+)

- Snapshot poll + pipe-pane can flicker; prefer tmux control mode (`tmux -C`) or a single reliable stream.
- Hub is in-memory (single API process only); no multi-API sticky routing.
- Token is shared secret, not per-user session auth.
- Special keys: relies on xterm `onData` + `send-keys -l`; some sequences may need key-name mapping.
- Production TLS / cookie auth / CSRF for WS.
- Dashboard build needs token baked or a small settings field for token.
- Atch live still out of scope (P3).
- Session window React `key={index}` can shuffle local Live state when removing a middle window.
