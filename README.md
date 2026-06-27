# WhipAI / Hermes Control Plane

WhipAI, also called Hermes Control Plane, is a human-in-the-loop control system for monitoring and controlling tmux-based AI coding agents across one or more machines.

It is designed for an operator who runs many AI agent sessions and needs one place to see which sessions are active, waiting, stuck, or need manual intervention.

## What this application does

WhipAI collects tmux session snapshots from each machine, sends them to a central FastAPI server, classifies session state, and displays everything in a web dashboard.

Core capabilities:

- Monitor multiple machines from one dashboard
- Show live tmux session previews
- Detect idle, waiting, stuck, and active sessions
- Track how long a session has not changed
- Select a machine/session and inspect current output
- Send commands or template actions back to a tmux session
- Keep the human operator in control instead of fully automating agent decisions

## Why this exists

The original workflow used local scripts, cron-style checking, and notifications. That made it hard to know:

- which AI coding agents were actually stuck
- how long a session had been idle
- whether a prompt needed input
- what was happening across multiple machines
- how to intervene quickly without opening many terminals

WhipAI solves that by turning scattered tmux sessions into a central control plane.

## Architecture

```text
Machine Agent(s)
  -> capture tmux panes
  -> parse session output
  -> send heartbeat to API

API Server
  -> receives heartbeats
  -> stores machines and sessions
  -> classifies session state
  -> exposes query and command endpoints

Web Dashboard
  -> lists machines and sessions
  -> shows session preview/status
  -> sends operator commands

Command Router
  -> queues commands in the API
  -> machine agent polls commands
  -> agent executes tmux send-keys locally
```

## Repository layout

```text
whipdahermes_dev/
  apps/
    api-server/          FastAPI backend API server
    web-dashboard/       React + Vite dashboard
    machine-agent/       Python tmux capture and command agent
  packages/              Shared packages placeholder
  tests/                 End-to-end tests placeholder
  .env.example           Example runtime environment variables
  .python-version        Python version target
```

## Main components

### API Server

Location: `apps/api-server/`

Responsibilities:

- Receive heartbeat payloads from machine agents
- Register machines
- Store latest session state
- Classify session status
- Provide query APIs for the dashboard
- Queue and track commands for machine agents

Stack:

- Python 3.12+
- FastAPI
- Pydantic
- SQLModel
- Uvicorn
- pytest/httpx for tests

### Web Dashboard

Location: `apps/web-dashboard/`

Responsibilities:

- Display machines and tmux sessions
- Show live-ish session preview data
- Show connection errors while keeping cached data visible
- Provide command input and template actions

Stack:

- React 19
- TypeScript 5
- Vite 8
- Tailwind CSS 4
- TanStack Query
- Zustand
- Vitest

### Machine Agent

Location: `apps/machine-agent/`

Responsibilities:

- Run on every machine that owns tmux sessions
- Capture tmux panes
- Parse session output
- Send periodic heartbeat data to the API server
- Poll pending commands from the API server
- Execute approved commands locally through tmux
- Report command execution results

Stack:

- Python 3.12+
- requests
- pytest for tests

## Prerequisites

Install these before running the project:

- Python 3.12+
- Node.js and npm
- tmux, required on machines running `machine-agent`
- Git

Recommended:

- Linux environment for tmux capture and command execution
- A LAN/VPN connection if using multiple machines

## Environment variables

Copy the example environment file if needed:

```bash
cp .env.example .env
```

Available variables:

| Variable | Used by | Description | Example |
| --- | --- | --- | --- |
| `API_URL` | Machine agent | Base URL of the API server | `http://localhost:8000` |
| `MACHINE_ID` | Machine agent | Unique machine name shown in dashboard | `agent-01` |
| `INTERVAL` | Machine agent | Heartbeat interval in seconds | `2` |
| `COMMAND_POLL_INTERVAL` | Machine agent | Command polling interval in seconds | `5` |
| `STALE_TIMEOUT_SECONDS` | API server | Stale machine sweep interval threshold | `60` |
| `CLEANUP_TIMEOUT_SECONDS` | API server | Remove long-gone stale machines after this many seconds | `86400` |

`MACHINE_ID` and `API_URL` are required for the machine agent.

## Prepare the project

From the child repository root:

```bash
cd whipdahermes_dev
```

### Prepare API server

```bash
cd apps/api-server
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### Prepare web dashboard

```bash
cd apps/web-dashboard
npm install
```

### Prepare machine agent

```bash
cd apps/machine-agent
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Run the application locally

Use three terminals.

### Terminal 1: run API server

```bash
cd apps/api-server
source .venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{"status":"ok"}
```

### Terminal 2: run web dashboard

```bash
cd apps/web-dashboard
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

### Terminal 3: run machine agent

```bash
cd apps/machine-agent
source .venv/bin/activate
export API_URL=http://localhost:8000
export MACHINE_ID=local-dev
export INTERVAL=2
export COMMAND_POLL_INTERVAL=5
python3 src/main.py
```

The agent machine must have tmux sessions available for useful capture data.

## Run with Docker Compose

From this repository root:

```bash
docker compose up --build
```

The compose stack starts:

- `api-server` on `http://localhost:8000`
- `web-dashboard` on `http://localhost:3000`
- `machine-agent` with `MACHINE_ID=vm-local` and `API_URL=http://api-server:8000`

SQLite data is persisted under `./data/hcp.db`. The API server marks machines stale after `STALE_TIMEOUT_SECONDS` without a heartbeat and removes long-gone stale records after `CLEANUP_TIMEOUT_SECONDS`.

The machine-agent image includes tmux. In minimal Docker-only testing it may report no sessions unless tmux sessions are available inside the container or a host tmux socket is mounted for local experimentation.

To stop the stack:

```bash
docker compose down
```

## Multi-machine usage

Run the API server and web dashboard on a central machine. On each worker machine:

```bash
cd apps/machine-agent
source .venv/bin/activate
export API_URL=http://CENTRAL_SERVER_IP:8000
export MACHINE_ID=worker-01
python3 src/main.py
```

Use a different `MACHINE_ID` per machine, such as:

- `worker-01`
- `worker-02`
- `laptop-dev`
- `vm-coder-a`

The dashboard groups sessions by machine.

## Step-by-step: running machine-agent on a remote machine

This section covers everything needed to deploy a machine-agent on a separate machine and connect it to your central dashboard.

### Step 1: find the server IP address

On the machine running the API server, find its LAN IP:

```bash
ip addr show | grep "inet "
```

Example output: `192.168.1.100`. Use this IP in the `API_URL` value on the remote agent machine.

### Step 2: open network access (if needed)

The API server must be reachable from the remote agent machine on port 8000.

- If both machines are on the same LAN, this usually works out of the box.
- If behind a firewall, open port 8000 or use a reverse proxy / VPN / SSH tunnel.
- The docker-compose setup already binds `API_HOST: 0.0.0.0`, so the server listens on all interfaces.

Quick check from the remote machine:

```bash
curl http://192.168.1.100:8000/health
```

Expected response: `{"status":"ok"}`

### Step 3: install dependencies on the remote machine

**Option A: Docker (recommended)**

Install Docker on the remote machine:

```bash
# Debian/Ubuntu
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in, or run: newgrp docker
```

**Option B: manual install**

```bash
# Debian/Ubuntu
sudo apt update
sudo apt install -y tmux python3.12 python3.12-venv git curl
```

### Step 4: run the machine-agent

**Option A: Docker**

```bash
# copy apps/machine-agent to the remote machine, then:
cd apps/machine-agent
docker build -t machine-agent .
docker run -d \
  --name machine-agent \
  --restart unless-stopped \
  -e MACHINE_ID="worker-01" \
  -e API_URL="http://192.168.1.100:8000" \
  -e INTERVAL=2 \
  -e COMMAND_POLL_INTERVAL=5 \
  machine-agent
```

**Option B: manual (without Docker)**

```bash
# clone or copy the repo
git clone <REPO_URL> whipdahermes_dev
cd whipdahermes_dev/apps/machine-agent

# create virtual environment
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e .

# set environment variables
export MACHINE_ID="worker-01"
export API_URL="http://192.168.1.100:8000"
export INTERVAL=2
export COMMAND_POLL_INTERVAL=5

# start the agent
python3 src/main.py
```

To run in the background with auto-restart, use a systemd service or `tmux`/`screen`:

```bash
# quick background with nohup
nohup python3 src/main.py > /var/log/machine-agent.log 2>&1 &

# or use tmux
tmux new -d -s agent "cd apps/machine-agent && source .venv/bin/activate && python3 src/main.py"
```

### Step 5: verify the connection

From the remote machine:

```bash
# check that the API server is reachable
curl http://192.168.1.100:8000/health

# list registered machines (should include your MACHINE_ID)
curl http://192.168.1.100:8000/machines
```

On the dashboard (`http://localhost:3000`), the remote machine should appear in the sidebar with its tmux sessions.

### Step 6: monitor logs

**Docker:**

```bash
docker logs -f machine-agent
```

**Manual / systemd:**

```bash
# if using nohup
tail -f /var/log/machine-agent.log

# if using systemd
journalctl -u machine-agent -f
```

### Step 7: set up auto-start (optional)

To auto-start the agent on boot, create a systemd service:

```bash
sudo tee /etc/systemd/system/machine-agent.service << 'EOF'
[Unit]
Description=WhipAI Machine Agent
After=network.target

[Service]
Type=simple
User=andy
WorkingDirectory=/home/andy/whipdahermes_dev/apps/machine-agent
Environment=MACHINE_ID=worker-01
Environment=API_URL=http://192.168.1.100:8000
Environment=INTERVAL=2
Environment=COMMAND_POLL_INTERVAL=5
ExecStart=/home/andy/whipdahermes_dev/apps/machine-agent/.venv/bin/python src/main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now machine-agent
```

Adjust paths, user, and environment variables to match your setup.

### Environment variables reference

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `MACHINE_ID` | yes | (none) | Unique identifier for this machine, shown in dashboard |
| `API_URL` | yes | (none) | Base URL of the central API server, e.g. `http://192.168.1.100:8000` |
| `INTERVAL` | no | `2` | Seconds between heartbeat sends |
| `COMMAND_POLL_INTERVAL` | no | `5` | Seconds between command poll requests |

### Troubleshooting

| Problem | Solution |
| --- | --- |
| `MACHINE_ID and API_URL must be set` | Export both environment variables before starting |
| Heartbeat fails with connection error | Verify `API_URL` is correct and port 8000 is reachable (`curl` test) |
| No sessions appear on dashboard | Ensure tmux sessions exist on the remote machine (`tmux ls`) |
| Machine shows as stale on dashboard | Check the agent is running and heartbeats are not blocked by firewall |
| Agent crashes with `ModuleNotFoundError` | Activate the virtualenv or ensure `PYTHONPATH=src` is set |

## How to use the dashboard

1. Start the API server.
2. Start one or more machine agents.
3. Start the web dashboard.
4. Select a machine from the sidebar.
5. Select a tmux session.
6. Review status, idle time, and preview output.
7. If the session needs intervention, send a command or template action.

Common operator actions:

- send `yes`
- send `continue`
- send `retry`
- send an instruction to explain, fix, or proceed

## Session states

WhipAI uses idle time, recent screen change, and prompt-like text to classify sessions. The rules below match the API server classifier in `apps/api-server/src/modules/detection/domain/classify.py`.

| State | Meaning |
| --- | --- |
| `ACTIVE` | Output is changing significantly, or a long-idle session still shows progress |
| `STABLE` | Session changed recently and is currently quiet |
| `WAITING` | Session has been quiet for a while, but not long enough to be considered stuck |
| `WAITING_INPUT` | Session output looks like it is asking the operator for input |
| `STUCK` | Session has been quiet for too long and shows no progress |
| `STALE` | The machine itself has not been seen recently |
| `UNKNOWN` | Fallback when the classifier cannot decide |

### Exact classification rules

The classifier checks conditions in this order:

1. **`STALE`** — if the machine heartbeat is older than `STALE_TIMEOUT_SECONDS` (default `60`).
2. **`WAITING_INPUT`** — if the captured preview contains prompt/confirmation text such as:
   - `continue?`
   - `y/n`
   - `confirm`
   - `press enter`
3. **`ACTIVE`** — if the screen diff is large enough: `diff_pct > 10.0`.
4. **`STABLE`** — if the session last changed less than `60` seconds ago.
5. **`WAITING`** — if the session last changed between `60` and `180` seconds ago.
6. **`ACTIVE` again** — if the session has been idle for more than `180` seconds, but the classifier still sees progress (`stable_counter == 0` or `diff_pct > 0.0`).
7. **`STUCK`** — if the session has been idle for more than `180` seconds and shows no progress (`stable_counter > 0` and `diff_pct == 0.0`).
8. **`UNKNOWN`** — fallback when none of the above applies.

### Practical interpretation

- `ACTIVE` usually means the agent is actively producing new output.
- `STABLE` usually means the session just finished a burst of activity and is cooling down.
- `WAITING` usually means the agent may be thinking, waiting on I/O, or paused briefly.
- `WAITING_INPUT` means the agent likely needs a human response before it can continue.
- `STUCK` means the session has likely stopped making progress and needs intervention.
- `STALE` means the machine agent itself has stopped sending heartbeats, so all sessions on that machine should be treated as unavailable until the machine returns.

The goal is not perfect monitoring. The goal is to help the operator decide where to look next.

## Development commands

### API server tests

```bash
cd apps/api-server
source .venv/bin/activate
pytest
```

### Machine agent tests

```bash
cd apps/machine-agent
source .venv/bin/activate
pytest
```

### Web dashboard tests

```bash
cd apps/web-dashboard
npm test
```

### Web dashboard typecheck

```bash
cd apps/web-dashboard
npm run typecheck
```

### Web dashboard build

```bash
cd apps/web-dashboard
npm run build
```

## Security notes

The command router can send commands to tmux sessions. Treat the API server as a trusted internal service.

Recommended deployment rules:

- Run only on trusted LAN/VPN networks
- Do not expose the API server directly to the public internet
- Use unique machine IDs
- Restrict who can access the dashboard
- Add authentication before production use
- Prefer safe command templates for common actions

## Current project status

This repository contains the implementation workspace for the WhipAI/Hermes Control Plane application. The current codebase includes a FastAPI backend, React dashboard, and Python machine agent, with tests around the main backend, dashboard, and agent modules.

The parent repository is used for planning, PRD, UX, and orchestration artifacts. Application code belongs in this child repository.
