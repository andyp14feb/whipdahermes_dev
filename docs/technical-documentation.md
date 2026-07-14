# WhipAI / Hermes Technical Documentation

## Purpose

WhipAI / Hermes Control Plane monitors and controls tmux-based AI coding sessions across multiple machines.

The system is intentionally human-in-the-loop:

- It observes agent sessions.
- It classifies session health.
- It shows recent terminal state.
- It queues operator commands.
- It lets the machine that owns tmux execute those commands locally.

The dashboard is not a direct remote shell. It is an operator control surface backed by API state.

## Repository Layout

Application code lives in the child implementation repository:

```text
whipdahermes_dev/
  apps/
    api-server/
    machine-agent/
    web-dashboard/
  tests/
  scripts/
  docs/
  docker-compose.yml
  README.md
```

The parent repository is reserved for planning, BMad/WDS artifacts, and orchestration assets.

## Tech Stack

### API Server

Location:

```text
apps/api-server
```

Stack:

- Python 3.12+
- FastAPI 0.138.0
- Pydantic 2.13.4
- pydantic-settings
- Uvicorn 0.49.0
- SQLModel 0.0.38
- SQLite with WAL mode
- pytest and httpx for tests

### Machine Agent

Location:

```text
apps/machine-agent
```

Stack:

- Python 3.12+
- requests
- tmux command line interface
- pytest for tests

### Web Dashboard

Location:

```text
apps/web-dashboard
```

Stack:

- React 19
- TypeScript 5
- Vite 8
- Tailwind CSS 4
- TanStack Query 5
- Zustand 5
- ansi-to-html
- Vitest 3
- Testing Library
- jsdom
- MSW

### Runtime / Deployment

- Docker Compose for local full-stack deployment.
- SQLite database persisted at `./data/hcp.db` in Docker Compose.
- API port: `8000`.
- Dashboard port: `3000`.
- Machine-agent heartbeat interval default: `2` seconds.
- Command polling interval default: `5` seconds.

## High-Level Architecture

```text
Worker Machine
  tmux sessions
      |
      v
  machine-agent
      |  POST /heartbeat
      |  GET /commands/{machine_id}
      |  POST /commands/{command_id}/delivery
      v
API Server
  machine registry
  session state
  detection/classification
  command router
  query API
  SQLite persistence
      ^
      |
Web Dashboard
  GET /machines
  GET /sessions
  GET /sessions/{machine_id}/{session_id}
  POST /command
```

## Ownership Boundaries

### Machine Agent Owns Local tmux Interaction

The machine agent is the only component that should call tmux. It owns:

- Listing tmux panes.
- Capturing pane output.
- Reading current working directories.
- Sending keys to tmux sessions.
- Creating tmux sessions.
- Renaming tmux sessions.
- Applying local agent control commands.

### API Server Owns Shared State

The API server owns:

- Machine records.
- Session records.
- Snapshot records.
- Session classification.
- Command lifecycle.
- Query responses for the dashboard.
- Stale machine detection.

### Dashboard Owns Operator Interaction

The dashboard owns:

- Selection state.
- Window layout state.
- User-configured template actions.
- Theme settings.
- AI provider settings.
- Nudge settings.
- User-triggered command enqueueing.

The dashboard should not talk directly to worker machines.

## Application Modules

### API Server Modules

#### `shared_kernel`

Cross-cutting utilities and contracts:

- ID wrappers.
- Time utilities.
- Error envelopes.
- DTOs.
- Settings.
- SQLite write lock.

#### `machine_registry`

Tracks known machines:

- Machine ID.
- Display name.
- Last seen timestamp.
- Session count.
- Stale flag.

The machine registry is updated from heartbeat processing.

#### `ingest`

Receives machine heartbeats:

```text
POST /heartbeat
```

Responsibilities:

- Validate heartbeat payloads.
- Register or update the machine.
- Write sessions and snapshots.
- Return accepted session count.

#### `session_state`

Maintains latest known session state:

- Current session status.
- Latest seen timestamp.
- Seconds since change.
- Current working directory.
- Latest snapshot preview.
- Optional AI assessment fields.

It writes heartbeat data and stores snapshot history.

#### `detection`

Classifies session state from signals:

- Preview text.
- Diff percentage.
- Stable counter.
- Seconds since change.
- Last seen timestamp.

Classification order:

1. `stale` if machine heartbeat is too old.
2. `waiting_input` if prompt-like text is detected.
3. `active` if diff is significant.
4. `stable` if recently quiet.
5. `waiting` if quiet for moderate duration.
6. `active` if long idle but still showing progress.
7. `stuck` if long idle with no progress.
8. `unknown` fallback.

Prompt patterns currently include:

- `continue?`
- `y/n`
- `confirm`
- `press enter`

#### `command_router`

Queues and tracks commands:

```text
POST /command
GET /commands/{identifier}
POST /commands/{command_id}/delivery
```

Current command states:

- `accepted`
- `delivered`
- `failed`

Current behavior:

- Dashboard enqueues command through `POST /command`.
- Machine agent polls pending commands for its machine.
- Machine agent executes command locally.
- Machine agent reports delivery result.

Known design note:

The route `GET /commands/{identifier}` currently serves both command detail and machine pending-command fetch by trying command detail first and falling back to machine queue lookup. This works but should be split in a future refactor.

Recommended future endpoints:

```text
GET  /commands/{command_id}
GET  /machines/{machine_id}/commands/pending
POST /machines/{machine_id}/commands/claim
POST /commands/{command_id}/delivery
```

#### `query_api`

Read API for the dashboard:

```text
GET    /machines
DELETE /machines/{machine_id}
GET    /sessions
GET    /sessions/{machine_id}/{session_id}
DELETE /sessions/{machine_id}/{session_id}
POST   /assess/models
POST   /assess/{machine_id}/{session_id}
```

It derives stale status at read time and returns session detail with latest snapshot preview.

#### Admin Cleanup

The API server also has:

```text
POST /admin/session-cleanup
```

This removes stale session rows using the Docker database path `/data/hcp.db`.

## Machine Agent Modules

### `config.py`

Loads:

- `MACHINE_ID`
- `API_URL`
- `INTERVAL`
- `COMMAND_POLL_INTERVAL`
- `TMUX_SOCKET`

If `MACHINE_ID` is empty, it falls back to the hostname. `API_URL` is required.

### `capture/tmux_capture.py`

Runs tmux commands:

```text
tmux list-panes -a -F "#{session_name}:#{window_index}.#{pane_index}\t#{pane_current_path}"
tmux capture-pane -t <target> -p
```

Returns raw pane captures with:

- target
- text
- current working directory

### `parse/capture_parser.py`

Transforms raw pane captures into heartbeat session snapshots.

Snapshot fields:

- `session_id`
- `label`
- `preview`
- `cwd`
- `diff_pct`
- `stable_counter`
- `seconds_since_change`
- `captured_at`

Preview is limited to the latest 2000 characters.

### `heartbeat/heartbeat_client.py`

Posts heartbeat payloads to:

```text
POST /heartbeat
```

Current constants:

- Heartbeat request timeout: 10 seconds.
- Max attempts: 3.
- Retry backoff: 0.5 seconds multiplied by attempt number.
- Retries on connection errors, timeouts, and selected 5xx responses.

### `heartbeat/scheduler.py`

Main heartbeat loop:

1. Check whether updates are enabled.
2. Capture tmux panes.
3. Parse sessions.
4. Save local capture state under `/tmp`.
5. Post heartbeat.
6. Sleep for configured interval.

Local capture state path:

```text
/tmp/whipai-capture-state-<machine_id>.json
```

### `command/command_poller.py`

Polls the API for pending commands:

```text
GET /commands/{machine_id}
```

Returns command ID, target session ID, and payload.

### `command/executor.py`

Executes commands locally.

Normal payloads use:

```text
tmux send-keys -t <session_id> <payload> Enter
```

Internal payloads:

| Payload | Effect |
| --- | --- |
| `__whipai__:pause` | Pause heartbeat updates. |
| `__whipai__:resume` | Resume heartbeat updates. |
| `__whipai__:shutdown` | Request machine-agent shutdown. |
| `__whipai__:restart` | Request machine-agent restart. |
| `__whipai__:create_session:<name>` | Create a detached tmux session. |
| `__whipai__:rename_session:<current>|<new>` | Rename a tmux session. |

### `command/command_reporter.py`

Reports delivery result:

```text
POST /commands/{command_id}/delivery
```

Payload:

```json
{
  "delivered": true,
  "failure_reason": null
}
```

### `command/command_scheduler.py`

Main command loop:

1. Fetch pending commands.
2. Execute each command.
3. Report delivery.
4. Sleep for configured command poll interval.

### `main.py`

Starts two daemon threads:

- Heartbeat scheduler.
- Command scheduler.

If restart is requested, the process re-execs itself with the same Python executable and argv.

## Web Dashboard Structure

### `app/App.tsx`

Top-level application:

- Creates TanStack Query client.
- Shows connection banner.
- Routes between dashboard and settings.
- Applies theme variables.
- Renders machine list and session windows.

Query defaults:

- Retry count: 2.
- Stale time: 1000 ms.

### `features/machine-list`

Machine and session sidebar:

- Fetch machines.
- Fetch sessions.
- Group sessions by machine.
- Sort machines and sessions.
- Manual drag ordering.
- Create tmux session.
- Delete machine row.
- Delete session row.
- Rename tmux session.
- Configure nudges.
- Cleanup stale sessions.

### `features/session-preview`

Watched session windows:

- Select watched session.
- Display status and working directory.
- Show terminal preview.
- Resize preview height.
- Trigger AI assessment.
- Auto-assess selected status transitions.
- Render command panel.

### `features/command-panel`

Operator command controls:

- Free-form command input.
- Template actions.
- Machine-agent control commands.
- Command history.
- Command status polling.
- Resend command.

### `features/settings`

User settings:

- Theme mode.
- Color themes and custom presets.
- Quick templates.
- Worker API URL used for generated worker script.
- AI provider settings.
- Refresh interval.
- Request timeout.
- Stale timeout.
- Generated worker machine script.

Most settings persist to browser local storage.

## Persistence Model

The API uses SQLite through SQLModel.

Main tables:

- `machines`
- `sessions`
- `snapshots`
- `commands`

SQLite configuration:

- WAL journal mode.
- Busy timeout.
- Foreign keys enabled.
- QueuePool for file-backed SQLite.
- StaticPool for in-memory tests.

There is a process-local `RLock` around write transactions to reduce concurrent SQLite write contention.

Important limitation:

The current SQLite lock is process-local. If the API server is scaled to multiple processes or multiple containers, that lock will not coordinate writes across processes. At that point, use a server database such as Postgres or introduce a proper distributed queue/lock layer.

## Data Flow Details

### Heartbeat Flow

```text
machine-agent heartbeat scheduler
  -> tmux list-panes
  -> tmux capture-pane
  -> parse_sessions
  -> POST /heartbeat
  -> HeartbeatService.process_heartbeat
  -> MachineService.upsert_machine
  -> SessionService.write_heartbeat
  -> SQL session/snapshot write
  -> detection classification
  -> response { ok: true, accepted: count }
```

Session write behavior:

- Sessions missing from the next heartbeat for the same machine are removed.
- A heartbeat with zero sessions removes only that machine's sessions.
- Snapshot records are appended.
- Latest session row is merged.
- Restart-zero baseline logic preserves previous idle time when the agent restarts and reports zero counters with identical preview.

### Dashboard Read Flow

```text
Dashboard
  -> GET /machines
  -> GET /sessions
  -> GET /sessions/{machine_id}/{session_id}
  -> render machine list, status summary, preview, command controls
```

Dashboard polling frequency is controlled by `refreshIntervalMs` in local settings.

### Command Flow

```text
Dashboard
  -> POST /command
  -> CommandService.enqueue_command
  -> SQL commands row state=accepted

machine-agent command scheduler
  -> GET /commands/{machine_id}
  -> execute command locally through tmux
  -> POST /commands/{command_id}/delivery
  -> command state delivered or failed
  -> session state updated with delivery result

Dashboard
  -> polls GET /commands/{command_id}
  -> updates command history state
```

Current command lifecycle:

```text
accepted -> delivered
accepted -> failed
```

Recommended future lifecycle:

```text
accepted -> claimed -> delivered
accepted -> claimed -> failed
claimed -> accepted  (lease expired)
```

Why this matters:

If a command is executed locally but delivery reporting fails, the current system can expose the same accepted command again. A claim/lease phase reduces duplicate execution risk.

### Stale Detection Flow

The API starts a background sweeper on startup.

Sweep interval:

```text
max(1, STALE_TIMEOUT_SECONDS // 2)
```

For each machine:

- If age is greater than cleanup timeout, delete machine and sessions.
- If age is greater than stale timeout, mark machine stale.

The query API also derives stale session status at read time if the machine is stale.

### AI Assessment Flow

```text
Dashboard
  -> POST /assess/{machine_id}/{session_id}
     headers:
       x-ai-provider-type
       x-ai-provider-base-url
       x-ai-api-key
       x-ai-model

API
  -> load session
  -> load latest snapshot
  -> build provider-specific request
  -> call provider
  -> parse JSON classification
  -> update session assessment fields
  -> return assessment summary
```

Eligible statuses:

- `stuck`
- `waiting`
- `waiting_input`

Provider model discovery:

```text
POST /assess/models
```

The API calls the provider from the server side. Provider reachability must be valid from the API server host.

## API Reference

### Health

```text
GET /health
```

Response:

```json
{"status":"ok"}
```

### Heartbeat

```text
POST /heartbeat
```

Request:

```json
{
  "machine_id": "worker-01",
  "sessions": [
    {
      "session_id": "agent-1:0.0",
      "label": "agent-1",
      "preview": "latest terminal text",
      "cwd": "/home/andy/project",
      "diff_pct": 0.0,
      "stable_counter": 4,
      "seconds_since_change": 8,
      "captured_at": "2026-07-10T00:00:00Z"
    }
  ]
}
```

Response:

```json
{
  "ok": true,
  "accepted": 1
}
```

### Machines

```text
GET /machines
DELETE /machines/{machine_id}
```

`GET /machines` response:

```json
{
  "machines": [
    {
      "machine_id": "worker-01",
      "display_name": "worker-01",
      "last_seen_at": "2026-07-10T00:00:00Z",
      "session_count": 3,
      "is_stale": false
    }
  ]
}
```

### Sessions

```text
GET /sessions
GET /sessions/{machine_id}/{session_id}
DELETE /sessions/{machine_id}/{session_id}
```

`GET /sessions` response:

```json
{
  "sessions": [
    {
      "machine_id": "worker-01",
      "session_id": "agent-1:0.0",
      "label": "agent-1",
      "status": "stable",
      "seconds_since_change": 8,
      "last_seen_at": "2026-07-10T00:00:00Z"
    }
  ]
}
```

Session detail response:

```json
{
  "machine_id": "worker-01",
  "session_id": "agent-1:0.0",
  "label": "agent-1",
  "status": "stable",
  "seconds_since_change": 8,
  "preview": "latest terminal text",
  "cwd": "/home/andy/project",
  "last_seen_at": "2026-07-10T00:00:00Z",
  "ai_assessment": null,
  "ai_assessment_reason": null,
  "ai_assessed_at": null
}
```

### Commands

```text
POST /command
GET /commands/{identifier}
POST /commands/{command_id}/delivery
```

Submit command request:

```json
{
  "machine_id": "worker-01",
  "session_id": "agent-1:0.0",
  "payload": "continue"
}
```

Submit command response:

```json
{
  "command_id": "cmd_...",
  "state": "accepted",
  "target": "worker-01:agent-1:0.0"
}
```

Delivery request:

```json
{
  "delivered": true,
  "failure_reason": null
}
```

### AI Assessment

```text
POST /assess/models
POST /assess/{machine_id}/{session_id}
```

Model discovery request:

```json
{
  "base_url": "https://provider.example/v1",
  "provider_type": "openai-compatible",
  "api_key": "..."
}
```

## Configuration Reference

### Docker Compose Services

`api-server`:

- Builds from `apps/api-server`.
- Exposes `8000`.
- Uses `DATABASE_URL=sqlite:////data/hcp.db`.
- Persists `./data:/data`.
- Health check calls `/health`.

`web-dashboard`:

- Builds from `apps/web-dashboard`.
- Exposes `3000`.
- Uses `API_PROXY_TARGET=http://api-server:8000`.
- Starts after API server is healthy.

`machine-agent`:

- Builds from `apps/machine-agent`.
- Uses `API_URL=http://api-server:8000`.
- Uses `INTERVAL=2`.
- Uses `COMMAND_POLL_INTERVAL=5`.
- Mounts host tmux socket directory.

### API Settings

Settings are loaded by `modules.shared_kernel.config.Settings`.

Important settings:

- `DATABASE_URL`
- `STALE_TIMEOUT_SECONDS`
- `CLEANUP_TIMEOUT_SECONDS`

### Machine Agent Settings

Loaded from environment:

- `API_URL`
- `MACHINE_ID`
- `INTERVAL`
- `COMMAND_POLL_INTERVAL`
- `TMUX_SOCKET`

### Dashboard Settings

Local browser state includes:

- Refresh interval.
- Request timeout.
- Stale timeout.
- Worker API URL for generated scripts.
- AI provider settings.
- Theme settings.
- Template actions.
- Nudge configs.

## Testing and Validation

### API Server

```bash
cd apps/api-server
source .venv/bin/activate
pytest
```

### Machine Agent

```bash
cd apps/machine-agent
source .venv/bin/activate
pytest
```

### Web Dashboard

```bash
cd apps/web-dashboard
npm test
npm run typecheck
npm run build
```

### End-to-End Tests

The repository includes e2e tests under:

```text
tests/e2e
```

These cover scaffold checks, multi-machine aggregation, machine-agent capture/parse behavior, and compose smoke testing.

## Operational Behavior and Known Tradeoffs

### Polling Model

Current system uses polling:

- Machine agent pushes heartbeat to API.
- Machine agent polls API for commands.
- Dashboard polls API for machines, sessions, selected details, and command status.

This is simple and works well for a small internal deployment.

Potential improvement:

- Keep heartbeat as agent push.
- Keep command dispatch as agent pull or long-poll.
- Add API-to-dashboard Server-Sent Events for live updates.
- Use WebSocket only when bidirectional browser interaction is needed.

### Redis / Queue Consideration

Redis is not required for the current single-API-server design.

Add Redis or another queue when one or more of these become true:

- Multiple API server instances need shared command queue coordination.
- Many worker agents poll frequently and overload SQLite/API.
- Command claiming, retries, delayed jobs, or backpressure outgrow SQLite.
- API-to-dashboard fanout needs a pub/sub layer.
- Background jobs should run outside request handlers.

Recommended near-term refactor before Redis:

1. Split command routes.
2. Add command claim/lease states.
3. Add local executed-command journal in machine-agent.
4. Add subprocess timeouts.
5. Centralize dashboard polling.

### Timeout Risks

Current heartbeat client can spend up to three 10-second attempts during failure paths. This can make an agent appear stale despite a low heartbeat interval.

Recommended tuning:

- Shorter heartbeat request timeout.
- Fewer immediate retries.
- Exponential backoff across cycles.
- Jitter between retries.
- tmux subprocess timeout.

### Command Delivery Semantics

Current command execution is at-least-once in some failure scenarios.

Example:

1. Agent fetches accepted command.
2. Agent executes tmux send-keys successfully.
3. Agent fails to report delivery.
4. Command remains accepted.
5. Agent may fetch and execute it again.

Future claim/lease design reduces this risk but cannot fully guarantee exactly-once tmux side effects. For stronger protection, add a local machine-agent journal of executed command IDs.

### SQLite Scaling Boundary

SQLite is appropriate for:

- One API server instance.
- Internal deployment.
- Moderate number of machines.
- Simple persistence.

Move to Postgres or another server database when:

- Running multiple API instances.
- Write contention grows.
- Audit history grows large.
- Stronger transactional concurrency is needed.

## Security Notes

Current implementation should be treated as trusted-network software.

Risks:

- Dashboard can enqueue arbitrary text into tmux sessions.
- API has no built-in authentication in the current code.
- Machine IDs are operator-defined strings.
- API should not be public internet exposed.
- AI provider keys are sent from dashboard to API for assessment calls.

Recommended hardening before production:

- Add authentication to dashboard and API.
- Add authorization by machine/session.
- Add TLS.
- Add audit log for commands.
- Add CSRF protection if browser cookies are introduced.
- Add rate limits.
- Add explicit command allowlists for high-risk deployments.
- Store provider secrets server-side instead of browser local storage.

## Maintenance Tasks

Regularly:

- Check API logs for heartbeat failures.
- Check machine-agent logs for tmux socket errors.
- Monitor database file size.
- Clean stale sessions.
- Review command history for failed deliveries.
- Verify worker machine IDs remain stable.
- Run tests before deployment.

Before large deployments:

- Tune heartbeat interval.
- Tune dashboard refresh interval.
- Decide whether to introduce SSE for dashboard updates.
- Decide whether command claim/lease is required.
- Decide whether SQLite is still sufficient.

