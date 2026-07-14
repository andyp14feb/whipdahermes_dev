# WhipAI / Hermes User Manual

## Background

WhipAI, also called Hermes Control Plane, is a human-in-the-loop dashboard for monitoring and controlling multiple tmux-based AI coding sessions.

The original workflow relied on manually checking terminals, local scripts, cron-style checks, and ad hoc notifications. That made it hard to answer simple operational questions:

- Which AI coding sessions are active?
- Which sessions are waiting for input?
- Which sessions look stuck?
- Which machine owns a session?
- What is the latest terminal output?
- How can an operator send a quick command without SSH-ing into every machine?

WhipAI solves this by putting a small machine agent on each worker machine. Each agent captures tmux panes, sends heartbeat snapshots to a central API server, and polls the server for commands. The web dashboard reads from the API server and lets the operator inspect sessions, send commands, and manage common workflows from one place.

## Core Concepts

### Server Machine

The server machine runs:

- The FastAPI API server.
- The React web dashboard.
- The SQLite database used by the API server.

It is the central control plane. Machine agents connect to it over HTTP.

### Client / Worker Machine

A client machine, also called a worker machine, runs:

- One or more tmux sessions.
- The `machine-agent` process.

The worker machine owns the local tmux socket. It captures tmux pane output and executes tmux commands locally.

### Machine Agent

The machine agent is a Python process that runs on every worker machine. It has two loops:

- Heartbeat loop: capture tmux panes, parse session state, and post the latest data to the API.
- Command loop: poll the API for pending commands, execute them through tmux, and report delivery.

### Heartbeat

A heartbeat is the latest snapshot from one machine. It includes the machine ID and a list of observed tmux sessions with preview text, working directory, idle time, diff percentage, and capture timestamp.

### Command

A command is an operator instruction queued in the API and later executed by the machine agent. Common commands are:

- `yes`
- `continue`
- `retry`
- Free-form text typed by the operator.
- Internal control payloads such as pause, resume, restart, shutdown, create tmux session, or rename tmux session.

### Dashboard

The dashboard is a browser UI for viewing machines and sessions. It does not connect directly to worker machines. It only talks to the API server.

## Prerequisites

### Server Machine Prerequisites

Required:

- Git.
- Docker and Docker Compose, for the simplest deployment.
- Network access from worker machines to the server on port `8000`.
- Network access from operator browsers to the dashboard on port `3000`.

Manual development mode also requires:

- Python 3.12 or newer.
- Node.js and npm.

Recommended:

- Linux server or Linux VM for production-like deployment.
- LAN, VPN, or SSH tunnel between server and worker machines.
- Firewall rules that expose the API only to trusted machines.

### Client / Worker Machine Prerequisites

Required:

- Linux or another environment where tmux is available.
- tmux installed.
- Python 3.12 or newer if running manually.
- Git if cloning the repository directly.
- Network access to the API server URL.

Optional:

- Docker, if running the machine agent in a container.
- systemd, tmux, screen, or another supervisor for keeping the agent running.

### Security Assumptions

WhipAI can send text into tmux sessions. Treat the API server and dashboard as trusted internal tools.

Do not expose the API server directly to the public internet without adding authentication, authorization, TLS, and access controls.

## Installation Overview

There are two common deployment models:

1. Single-machine local deployment: API server, dashboard, and machine agent all run on one machine.
2. Multi-machine deployment: API server and dashboard run centrally; each worker machine runs only the machine agent.

## Install on the Server Machine

### Option A: Docker Compose

From the child implementation repository:

```bash
cd D:/__KALICODE/whipdahermes/whipdahermes_dev
docker compose up --build
```

The compose stack starts:

- API server: `http://localhost:8000`
- Dashboard: `http://localhost:3000`
- Machine agent: containerized local agent using the configured tmux socket mount

Check the API:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{"status":"ok"}
```

Stop the stack:

```bash
docker compose down
```

The SQLite database is persisted in:

```text
./data/hcp.db
```

### Option B: Manual API Server

Use this for development or when running services independently.

```bash
cd whipdahermes_dev/apps/api-server
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

### Option C: Manual Web Dashboard

In a second terminal:

```bash
cd whipdahermes_dev/apps/web-dashboard
npm install
npm run dev
```

Open the Vite URL shown in the terminal. During normal local development it is usually:

```text
http://localhost:5173
```

For Docker Compose, use:

```text
http://localhost:3000
```

## Install on a Client / Worker Machine

### Step 1: Find the Server API URL

On the server, find its LAN address:

```bash
ip addr show
```

Example API URL:

```text
http://192.168.1.100:8000
```

From the worker machine, verify connectivity:

```bash
curl http://192.168.1.100:8000/health
```

Expected response:

```json
{"status":"ok"}
```

### Step 2: Install Worker Dependencies

On Debian or Ubuntu:

```bash
sudo apt update
sudo apt install -y tmux python3.12 python3.12-venv git curl
```

Create at least one tmux session to monitor:

```bash
tmux new -d -s agent-1
tmux ls
```

### Step 3: Run the Machine Agent Manually

```bash
git clone <REPO_URL> whipdahermes_dev
cd whipdahermes_dev/apps/machine-agent
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

export API_URL="http://192.168.1.100:8000"
export MACHINE_ID="worker-01"
export INTERVAL=2
export COMMAND_POLL_INTERVAL=5

python3 src/main.py
```

Use a unique `MACHINE_ID` for each worker.

### Step 4: Run the Machine Agent with systemd

Create a service file:

```bash
sudo tee /etc/systemd/system/whipai-machine-agent.service << 'EOF'
[Unit]
Description=WhipAI Machine Agent
After=network.target

[Service]
Type=simple
User=andy
WorkingDirectory=/home/andy/whipdahermes_dev/apps/machine-agent
Environment=API_URL=http://192.168.1.100:8000
Environment=MACHINE_ID=worker-01
Environment=INTERVAL=2
Environment=COMMAND_POLL_INTERVAL=5
ExecStart=/home/andy/whipdahermes_dev/apps/machine-agent/.venv/bin/python src/main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now whipai-machine-agent
sudo systemctl status whipai-machine-agent
```

View logs:

```bash
journalctl -u whipai-machine-agent -f
```

### Step 5: Run the Machine Agent with Docker

The Docker option is useful when the agent can access the host tmux socket.

Build:

```bash
cd whipdahermes_dev/apps/machine-agent
docker build -t whipai-machine-agent .
```

Run:

```bash
docker run -d \
  --name whipai-machine-agent \
  --restart unless-stopped \
  -e MACHINE_ID="worker-01" \
  -e API_URL="http://192.168.1.100:8000" \
  -e INTERVAL=2 \
  -e COMMAND_POLL_INTERVAL=5 \
  -e TMUX_SOCKET="/host-tmux/default" \
  -v /tmp/tmux-1000:/host-tmux \
  whipai-machine-agent
```

Adjust `/tmp/tmux-1000` to match the host user's tmux socket directory.

Verify the socket:

```bash
tmux display-message -p '#{socket_path}'
```

## Environment Variables

### Machine Agent

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `API_URL` | Yes | none | Base URL of the central API server. |
| `MACHINE_ID` | No | hostname | Unique machine identifier shown in the dashboard. |
| `INTERVAL` | No | `2` | Seconds between heartbeat cycles. |
| `COMMAND_POLL_INTERVAL` | No | `5` | Seconds between command polling cycles. |
| `TMUX_SOCKET` | No | `/tmp/tmux-<uid>/default` | tmux socket path used by the agent. |

### API Server

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | No | app default | SQLModel database URL. Docker Compose uses `sqlite:////data/hcp.db`. |
| `STALE_TIMEOUT_SECONDS` | No | `60` | Marks machines stale when no heartbeat arrives within this period. |
| `CLEANUP_TIMEOUT_SECONDS` | No | `86400` | Removes long-gone stale machine records after this period. |

### Dashboard

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | No | same origin / proxy | Direct API base URL for dashboard builds that do not use the proxy. |
| `API_PROXY_TARGET` | No | compose value | Target API URL used by the dashboard container proxy. |

Dashboard user settings are stored locally in browser local storage.

## First-Run Checklist

1. Start the API server.
2. Verify `GET /health` returns `{"status":"ok"}`.
3. Start the dashboard.
4. Start one or more machine agents.
5. Confirm each worker can reach the server API URL.
6. Confirm each worker has tmux sessions visible through `tmux ls`.
7. Open the dashboard and confirm machines appear in the left panel.
8. Select a session and inspect the CLI preview.
9. Send a harmless command such as `pwd` or `echo ok` to confirm command routing.

## How to Use the Dashboard

### Machine List

The left panel lists machines known to the API server. Each machine card shows:

- Machine display name.
- Number of sessions.
- Last registered time.
- Stale marker when the machine has not heartbeat recently.
- A collapsible session list.

Available controls:

- Manual drag ordering for machine cards.
- Sort machines by manual order, name, or last registered time.
- Sort sessions by manual order, name, status, or stable time.
- Expand or collapse all session lists.
- Cleanup stale sessions.

### Session List

Each session row shows:

- Session label.
- Current status.
- Time since the session last changed.

Click a session row to select it for viewing.

### Status Meanings

| Status | Meaning |
| --- | --- |
| `active` | The session output is changing significantly. |
| `stable` | The session changed recently and is currently quiet. |
| `waiting` | The session has been quiet for a while but is not yet considered stuck. |
| `waiting_input` | The session output appears to ask for human input. |
| `stuck` | The session has been quiet too long and shows no progress. |
| `stale` | The machine has not sent a recent heartbeat. |
| `unknown` | The classifier cannot determine the state. |

### Watch Windows

The dashboard can show one or more session windows.

Use:

- `Add window` to add another watched session panel.
- `Columns` to switch between one-column and two-column layout.
- The session selector in each window to choose a watched tmux session.
- `Unwatch` to clear a window.
- `Remove Window` to delete extra windows.
- The resize handle below the terminal preview to adjust CLI preview height.

### CLI Preview

The CLI preview shows the latest captured text from the selected tmux pane. It is refreshed through API polling.

The preview is not a live terminal emulator. It is a recent snapshot sent by the machine agent during heartbeat.

### Free-Form Commands

To send a custom command:

1. Select a session.
2. Type a command in the `Command Actions` text area.
3. Click `Send` or press `Ctrl+Enter`.

The machine agent executes the payload with:

```text
tmux send-keys -t <session_id> <payload> Enter
```

Use caution. The command is sent as input to the selected tmux session.

### Template Actions

Template actions are quick buttons for common commands. Default examples include:

- `yes`
- `continue`
- `retry`
- `skip`
- `explain`

Configure templates in:

```text
Settings -> Quick Templates
```

Each template has:

- Label: button text shown in the dashboard.
- Payload: text sent to the tmux session.

### Command History

After a command is sent, it appears in command history with a state:

- `pending`: dashboard has queued the command and is polling status.
- `accepted`: API has accepted the command.
- `delivered`: machine agent reported successful execution.
- `failed`: machine agent or API reported failure.

Use `Resend` to queue the same payload again.

### Machine-Agent Control

The command panel includes machine-agent control actions:

| Action | Effect |
| --- | --- |
| Start updates | Resume heartbeat updates on the agent. |
| Stop updates | Pause heartbeat updates on the agent. |
| Restart service | Request the agent process to restart itself. |
| Shutdown service | Request the agent process to stop. |

These are queued through the same command router as normal commands.

### Create a New tmux Session

On a machine card, click `New tmux`.

The dashboard asks for a session name. If blank, it uses a generated name. The request is queued as a control command and executed by the machine agent.

The new session appears after the next successful heartbeat.

### Rename a tmux Session

On a session row, click `Rename`.

Enter the new tmux session name. The request is queued and executed by the machine agent. The renamed session appears after the next heartbeat.

Allowed session name characters:

```text
letters, numbers, dot, underscore, colon, hyphen
```

The name must start with a letter or number.

### Remove a Machine from the Displayed List

Click the remove button on a machine card.

This removes the machine record from the API database, but it does not stop the machine agent and does not kill tmux sessions. If the machine agent is still running, the machine may reappear on the next heartbeat.

### Remove a Session from the Displayed List

Click the remove button on a session row.

This removes the session from the API database, but it does not kill the tmux session. If the tmux session still exists, it may reappear on the next heartbeat.

### Cleanup Stale Sessions

Click `Cleanup Stale Sessions` in the machine list controls.

This calls the admin cleanup endpoint and removes stale session rows from the API database. Use this when the dashboard has old records that should no longer appear.

### Nudges

Nudges automatically send a configured prompt to sessions that remain stable, waiting, waiting for input, or stuck past a threshold.

To enable:

1. Find a session row.
2. Check `Nudge this`.
3. Click `Configure`.
4. Set stable time threshold.
5. Set maximum number of nudges.
6. Optionally provide a custom prompt.

Default nudge prompt:

```text
Please continue if you are waiting for input.
```

Use `Mark nudge sent` if you manually intervened and want to advance the local nudge count.

Nudge configuration is stored in browser local storage.

### AI Assessment

AI assessment lets the dashboard ask an OpenAI-compatible, Anthropic-compatible, Gemini-compatible, Ollama-compatible, or 9Router-compatible provider to classify a selected session.

Configure provider settings:

```text
Settings -> Connection
```

Required fields:

- Provider type.
- Provider base URL.
- API key if needed.
- Model name or fetched model.
- Request timeout.

To use:

1. Select a session.
2. Click `Assess` in the watched window.
3. Review the assessment banner above the preview.

The dashboard can also auto-assess when a watched session transitions into `waiting`, `waiting_input`, or `stuck`.

### Appearance and Themes

Use Settings to:

- Switch light/dark mode.
- Pick a color theme.
- Customize colors.
- Save custom presets.
- Load or delete saved presets.

Theme settings are stored in browser local storage.

### Refresh and Timeout Settings

Use Settings to adjust:

- Refresh interval: how often the dashboard polls API state.
- Request timeout: how long AI assessment calls may run.
- Stale timeout: user-facing setting for stale machine interpretation.

The API server also has its own `STALE_TIMEOUT_SECONDS` environment variable. For consistent behavior, keep the dashboard stale timeout and API stale timeout aligned.

### Worker Machine Script

Settings includes a generated worker machine script. It:

- Clones or updates the repository.
- Creates a Python virtual environment.
- Installs the machine agent.
- Exports worker environment variables.
- Starts the machine agent.

Review and adjust paths before running it on a worker machine.

## Troubleshooting

### API Health Check Fails

Symptoms:

- `curl http://server:8000/health` fails.
- Dashboard shows connection errors.

Checks:

```bash
docker compose ps
docker compose logs api-server
```

Manual mode:

```bash
cd apps/api-server
source .venv/bin/activate
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

Common causes:

- API server is not running.
- Port `8000` is blocked.
- Wrong server IP.
- Docker container failed to build or start.

### Dashboard Cannot Reach the API

Symptoms:

- Connection banner appears.
- Machine list does not refresh.
- Requests time out.

Checks:

- Confirm API health from the browser machine.
- Confirm dashboard proxy target if using Docker.
- If using `VITE_API_BASE_URL`, confirm CORS allows the dashboard origin.
- Increase refresh interval if many windows are open.

### Machine Does Not Appear

Checks on the worker:

```bash
echo "$API_URL"
echo "$MACHINE_ID"
curl "$API_URL/health"
tmux ls
```

Agent logs:

```bash
journalctl -u whipai-machine-agent -f
```

or:

```bash
docker logs -f whipai-machine-agent
```

Common causes:

- `API_URL` is missing or incorrect.
- Firewall blocks the worker from reaching the server.
- Machine agent is not running.
- tmux is not installed.
- tmux socket path is wrong.

### Machine Shows as Stale

A machine is stale when the API server has not received a heartbeat within `STALE_TIMEOUT_SECONDS`.

Checks:

- Is the agent running?
- Can the agent reach the API?
- Is heartbeat loop blocked by slow network or API timeouts?
- Is the worker sleeping, offline, or behind a changed IP?

Temporary recovery:

```bash
sudo systemctl restart whipai-machine-agent
```

or:

```bash
docker restart whipai-machine-agent
```

### No Sessions Appear

Checks:

```bash
tmux ls
tmux list-panes -a
tmux display-message -p '#{socket_path}'
```

Common causes:

- No tmux sessions exist.
- Agent runs as a different user than the tmux sessions.
- `TMUX_SOCKET` points at the wrong socket.
- Docker container cannot access the host tmux socket mount.

### Commands Stay Pending or Accepted

Checks:

- Confirm the machine agent command loop is running.
- Confirm `COMMAND_POLL_INTERVAL` is set.
- Check agent logs for command fetch or delivery errors.
- Confirm the selected session still exists.
- Confirm the tmux target name matches the session shown in the dashboard.

### Command Fails

Common causes:

- tmux session was closed after the dashboard snapshot.
- tmux command returned a non-zero exit code.
- tmux binary is not installed.
- The agent cannot access the tmux socket.
- Payload is invalid for a control command.

### CLI Preview Is Delayed

The preview updates on heartbeat and dashboard polling intervals. Delay can come from:

- Machine-agent `INTERVAL`.
- Dashboard refresh interval.
- Network latency.
- API overload.
- Slow tmux capture.

For faster refresh, reduce `INTERVAL` and dashboard refresh interval. For lower load, increase them.

### Dashboard Timeout Warnings

Possible causes:

- API requests exceed the dashboard 5 second default timeout.
- Dashboard has multiple watched windows polling at the same interval.
- API server is busy with SQLite writes or cleanup.
- Network is slow or unstable.
- AI assessment provider is slow.

Mitigations:

- Increase dashboard refresh interval.
- Reduce watched windows.
- Check API logs.
- Avoid running cleanup during heavy activity.
- Increase AI request timeout for slow models.

### AI Assessment Fails

Checks:

- Provider base URL is correct.
- Provider type matches the endpoint.
- API key is correct.
- Model name is valid.
- Request timeout is long enough.
- Provider is reachable from the API server, not only from the browser.

### Cleanup Fails

The current cleanup endpoint expects the Docker database path:

```text
/data/hcp.db
```

If running manually with another database location, cleanup may return `DB not found`. Use Docker Compose or align the database path.

## Operational Best Practices

- Use stable, unique `MACHINE_ID` values.
- Run the API on a stable server IP or DNS name.
- Keep worker agents supervised with systemd or Docker restart policies.
- Keep API and dashboard inside a trusted network.
- Avoid public exposure until authentication and authorization are added.
- Use a moderate heartbeat interval for many machines.
- Use clear template actions for common operator responses.
- Treat free-form commands as privileged operator actions.

