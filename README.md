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

WhipAI uses idle time and output signals to classify sessions.

| State | Meaning |
| --- | --- |
| `ACTIVE` | Output is changing or recent activity was detected |
| `STABLE` | Session is quiet but not yet suspicious |
| `WAITING` | Session has been idle long enough to need attention |
| `WAITING_INPUT` | Output appears to contain a prompt or confirmation request |
| `STUCK` | Session has been idle past the stuck threshold |

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
