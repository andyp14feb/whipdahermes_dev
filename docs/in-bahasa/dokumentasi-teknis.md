# Dokumentasi Teknis WhipAI / Hermes

## Tujuan

WhipAI / Hermes Control Plane memantau dan mengontrol sesi AI coding berbasis tmux di banyak mesin.

Sistem ini sengaja didesain human-in-the-loop:

- Mengamati sesi agent.
- Mengklasifikasi kesehatan session.
- Menampilkan state terminal terbaru.
- Mengantrekan command operator.
- Membiarkan mesin pemilik tmux mengeksekusi command secara lokal.

Dashboard bukan remote shell langsung. Dashboard adalah control surface operator yang berbasis state dari API.

## Struktur Repository

Kode aplikasi berada di child implementation repository:

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

Parent repository dipakai untuk planning, artifact BMad/WDS, dan asset orchestration.

## Tech Stack

### API Server

Lokasi:

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
- SQLite dengan WAL mode
- pytest dan httpx untuk test

### Machine Agent

Lokasi:

```text
apps/machine-agent
```

Stack:

- Python 3.12+
- requests
- tmux command line interface
- pytest untuk test

### Web Dashboard

Lokasi:

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

- Docker Compose untuk local full-stack deployment.
- Database SQLite dipersist di `./data/hcp.db` pada Docker Compose.
- Port API: `8000`.
- Port dashboard: `3000`.
- Default heartbeat interval machine-agent: `2` detik.
- Default command polling interval: `5` detik.

## Arsitektur High-Level

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

## Batas Kepemilikan Komponen

### Machine Agent Memiliki Interaksi tmux Lokal

Machine agent adalah satu-satunya komponen yang seharusnya memanggil tmux. Agent memiliki tanggung jawab:

- Listing tmux panes.
- Capture output pane.
- Membaca current working directory.
- Mengirim key ke tmux session.
- Membuat tmux session.
- Rename tmux session.
- Menerapkan local agent control command.

### API Server Memiliki Shared State

API server memiliki tanggung jawab:

- Machine records.
- Session records.
- Snapshot records.
- Session classification.
- Command lifecycle.
- Query response untuk dashboard.
- Stale machine detection.

### Dashboard Memiliki Interaksi Operator

Dashboard memiliki tanggung jawab:

- Selection state.
- Window layout state.
- Template action yang dikonfigurasi user.
- Theme settings.
- AI provider settings.
- Nudge settings.
- User-triggered command enqueueing.

Dashboard tidak boleh berbicara langsung ke worker machine.

## Modul Aplikasi

### Modul API Server

#### `shared_kernel`

Utility dan contract lintas modul:

- ID wrappers.
- Time utilities.
- Error envelopes.
- DTOs.
- Settings.
- SQLite write lock.

#### `machine_registry`

Melacak machine yang diketahui:

- Machine ID.
- Display name.
- Last seen timestamp.
- Session count.
- Stale flag.

Machine registry diperbarui saat heartbeat diproses.

#### `ingest`

Menerima heartbeat dari machine:

```text
POST /heartbeat
```

Tanggung jawab:

- Validasi heartbeat payload.
- Register atau update machine.
- Write sessions dan snapshots.
- Mengembalikan accepted session count.

#### `session_state`

Menyimpan latest known session state:

- Status session saat ini.
- Latest seen timestamp.
- Seconds since change.
- Current working directory.
- Latest snapshot preview.
- Field AI assessment opsional.

Modul ini menulis data heartbeat dan menyimpan snapshot history.

#### `detection`

Mengklasifikasi state session dari sinyal:

- Preview text.
- Diff percentage.
- Stable counter.
- Seconds since change.
- Last seen timestamp.

Urutan klasifikasi:

1. `stale` jika heartbeat machine terlalu lama.
2. `waiting_input` jika ada teks seperti prompt.
3. `active` jika diff signifikan.
4. `stable` jika baru saja quiet.
5. `waiting` jika quiet durasi sedang.
6. `active` jika idle lama tetapi masih menunjukkan progress.
7. `stuck` jika idle lama tanpa progress.
8. `unknown` sebagai fallback.

Pattern prompt saat ini:

- `continue?`
- `y/n`
- `confirm`
- `press enter`

#### `command_router`

Mengantrekan dan melacak command:

```text
POST /command
GET /commands/{identifier}
POST /commands/{command_id}/delivery
```

State command saat ini:

- `accepted`
- `delivered`
- `failed`

Perilaku saat ini:

- Dashboard enqueue command melalui `POST /command`.
- Machine agent polling pending commands untuk machine-nya.
- Machine agent mengeksekusi command secara lokal.
- Machine agent melaporkan delivery result.

Catatan desain:

Route `GET /commands/{identifier}` saat ini melayani dua fungsi: command detail dan pending-command fetch untuk machine. Implementasi mencoba command detail terlebih dahulu, lalu fallback ke machine queue lookup. Ini bekerja, tetapi sebaiknya dipisah pada refactor berikutnya.

Endpoint yang direkomendasikan ke depan:

```text
GET  /commands/{command_id}
GET  /machines/{machine_id}/commands/pending
POST /machines/{machine_id}/commands/claim
POST /commands/{command_id}/delivery
```

#### `query_api`

Read API untuk dashboard:

```text
GET    /machines
DELETE /machines/{machine_id}
GET    /sessions
GET    /sessions/{machine_id}/{session_id}
DELETE /sessions/{machine_id}/{session_id}
POST   /assess/models
POST   /assess/{machine_id}/{session_id}
```

Modul ini menghitung stale status saat read time dan mengembalikan session detail dengan latest snapshot preview.

#### Admin Cleanup

API server juga memiliki:

```text
POST /admin/session-cleanup
```

Endpoint ini menghapus stale session rows menggunakan path database Docker `/data/hcp.db`.

## Modul Machine Agent

### `config.py`

Memuat:

- `MACHINE_ID`
- `API_URL`
- `INTERVAL`
- `COMMAND_POLL_INTERVAL`
- `TMUX_SOCKET`

Jika `MACHINE_ID` kosong, agent memakai hostname. `API_URL` wajib ada.

### `capture/tmux_capture.py`

Menjalankan command tmux:

```text
tmux list-panes -a -F "#{session_name}:#{window_index}.#{pane_index}\t#{pane_current_path}"
tmux capture-pane -t <target> -p
```

Mengembalikan raw pane captures dengan:

- target
- text
- current working directory

### `parse/capture_parser.py`

Mengubah raw pane captures menjadi heartbeat session snapshots.

Field snapshot:

- `session_id`
- `label`
- `preview`
- `cwd`
- `diff_pct`
- `stable_counter`
- `seconds_since_change`
- `captured_at`

Preview dibatasi ke 2000 karakter terakhir.

### `heartbeat/heartbeat_client.py`

Mengirim heartbeat payload ke:

```text
POST /heartbeat
```

Konstanta saat ini:

- Heartbeat request timeout: 10 detik.
- Max attempts: 3.
- Retry backoff: 0.5 detik dikali nomor attempt.
- Retry pada connection error, timeout, dan response 5xx tertentu.

### `heartbeat/scheduler.py`

Main heartbeat loop:

1. Cek apakah updates enabled.
2. Capture tmux panes.
3. Parse sessions.
4. Simpan local capture state di bawah `/tmp`.
5. Kirim heartbeat.
6. Sleep selama configured interval.

Path local capture state:

```text
/tmp/whipai-capture-state-<machine_id>.json
```

### `command/command_poller.py`

Polling API untuk pending commands:

```text
GET /commands/{machine_id}
```

Mengembalikan command ID, target session ID, dan payload.

### `command/executor.py`

Mengeksekusi command secara lokal.

Payload normal memakai:

```text
tmux send-keys -t <session_id> <payload> Enter
```

Payload internal:

| Payload | Efek |
| --- | --- |
| `__whipai__:pause` | Pause heartbeat updates. |
| `__whipai__:resume` | Resume heartbeat updates. |
| `__whipai__:shutdown` | Request machine-agent shutdown. |
| `__whipai__:restart` | Request machine-agent restart. |
| `__whipai__:create_session:<name>` | Membuat detached tmux session. |
| `__whipai__:rename_session:<current>|<new>` | Rename tmux session. |

### `command/command_reporter.py`

Melaporkan delivery result:

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
2. Execute setiap command.
3. Report delivery.
4. Sleep selama configured command poll interval.

### `main.py`

Menjalankan dua daemon thread:

- Heartbeat scheduler.
- Command scheduler.

Jika restart diminta, proses melakukan re-exec dengan Python executable dan argv yang sama.

## Struktur Web Dashboard

### `app/App.tsx`

Top-level application:

- Membuat TanStack Query client.
- Menampilkan connection banner.
- Routing antara dashboard dan settings.
- Menerapkan theme variables.
- Render machine list dan session windows.

Default query:

- Retry count: 2.
- Stale time: 1000 ms.

### `features/machine-list`

Sidebar machine dan session:

- Fetch machines.
- Fetch sessions.
- Group sessions by machine.
- Sort machines dan sessions.
- Manual drag ordering.
- Create tmux session.
- Delete machine row.
- Delete session row.
- Rename tmux session.
- Configure nudges.
- Cleanup stale sessions.

### `features/session-preview`

Watched session windows:

- Memilih watched session.
- Menampilkan status dan working directory.
- Menampilkan terminal preview.
- Resize preview height.
- Trigger AI assessment.
- Auto-assess transisi status tertentu.
- Render command panel.

### `features/command-panel`

Kontrol command operator:

- Free-form command input.
- Template actions.
- Machine-agent control commands.
- Command history.
- Command status polling.
- Resend command.

### `features/settings`

User settings:

- Theme mode.
- Color themes dan custom presets.
- Quick templates.
- Worker API URL untuk generated worker script.
- AI provider settings.
- Refresh interval.
- Request timeout.
- Stale timeout.
- Generated worker machine script.

Sebagian besar settings dipersist ke browser local storage.

## Model Persistence

API memakai SQLite melalui SQLModel.

Tabel utama:

- `machines`
- `sessions`
- `snapshots`
- `commands`

Konfigurasi SQLite:

- WAL journal mode.
- Busy timeout.
- Foreign keys enabled.
- QueuePool untuk file-backed SQLite.
- StaticPool untuk in-memory tests.

Ada process-local `RLock` di sekitar write transaction untuk mengurangi SQLite write contention.

Batasan penting:

SQLite lock saat ini hanya process-local. Jika API server di-scale menjadi beberapa process atau beberapa container, lock tersebut tidak akan mengkoordinasikan writes lintas process. Pada titik itu, gunakan server database seperti Postgres atau tambahkan distributed queue/lock layer yang sesuai.

## Detail Alur Data

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

Perilaku session write:

- Session yang hilang dari heartbeat berikutnya untuk machine yang sama akan dihapus.
- Heartbeat dengan zero sessions hanya menghapus sessions milik machine tersebut.
- Snapshot records ditambahkan.
- Latest session row di-merge.
- Restart-zero baseline logic menjaga idle time sebelumnya saat agent restart dan melaporkan counter nol dengan preview yang sama.

### Dashboard Read Flow

```text
Dashboard
  -> GET /machines
  -> GET /sessions
  -> GET /sessions/{machine_id}/{session_id}
  -> render machine list, status summary, preview, command controls
```

Frekuensi polling dashboard dikontrol oleh `refreshIntervalMs` di local settings.

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

Lifecycle command saat ini:

```text
accepted -> delivered
accepted -> failed
```

Lifecycle yang direkomendasikan ke depan:

```text
accepted -> claimed -> delivered
accepted -> claimed -> failed
claimed -> accepted  (lease expired)
```

Mengapa ini penting:

Jika command berhasil dieksekusi lokal tetapi delivery reporting gagal, sistem saat ini bisa mengekspos command accepted yang sama lagi. Fase claim/lease mengurangi risiko duplicate execution.

### Stale Detection Flow

API menjalankan background sweeper saat startup.

Sweep interval:

```text
max(1, STALE_TIMEOUT_SECONDS // 2)
```

Untuk setiap machine:

- Jika age lebih besar dari cleanup timeout, delete machine dan sessions.
- Jika age lebih besar dari stale timeout, mark machine stale.

Query API juga menghitung stale session status saat read time jika machine stale.

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

Status yang eligible:

- `stuck`
- `waiting`
- `waiting_input`

Provider model discovery:

```text
POST /assess/models
```

API memanggil provider dari sisi server. Provider harus reachable dari host API server.

## Referensi API

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

Response `GET /machines`:

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

Response `GET /sessions`:

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

Response session detail:

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

## Referensi Konfigurasi

### Docker Compose Services

`api-server`:

- Build dari `apps/api-server`.
- Expose `8000`.
- Memakai `DATABASE_URL=sqlite:////data/hcp.db`.
- Persist `./data:/data`.
- Health check memanggil `/health`.

`web-dashboard`:

- Build dari `apps/web-dashboard`.
- Expose `3000`.
- Memakai `API_PROXY_TARGET=http://api-server:8000`.
- Start setelah API server healthy.

`machine-agent`:

- Build dari `apps/machine-agent`.
- Memakai `API_URL=http://api-server:8000`.
- Memakai `INTERVAL=2`.
- Memakai `COMMAND_POLL_INTERVAL=5`.
- Mount direktori host tmux socket.

### API Settings

Settings dimuat oleh `modules.shared_kernel.config.Settings`.

Setting penting:

- `DATABASE_URL`
- `STALE_TIMEOUT_SECONDS`
- `CLEANUP_TIMEOUT_SECONDS`

### Machine Agent Settings

Dimuat dari environment:

- `API_URL`
- `MACHINE_ID`
- `INTERVAL`
- `COMMAND_POLL_INTERVAL`
- `TMUX_SOCKET`

### Dashboard Settings

Browser local state berisi:

- Refresh interval.
- Request timeout.
- Stale timeout.
- Worker API URL untuk generated scripts.
- AI provider settings.
- Theme settings.
- Template actions.
- Nudge configs.

## Testing dan Validasi

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

Repository memiliki e2e tests di:

```text
tests/e2e
```

Test ini mencakup scaffold checks, multi-machine aggregation, machine-agent capture/parse behavior, dan compose smoke testing.

## Perilaku Operasional dan Tradeoff Saat Ini

### Polling Model

Sistem saat ini memakai polling:

- Machine agent push heartbeat ke API.
- Machine agent polling API untuk commands.
- Dashboard polling API untuk machines, sessions, selected details, dan command status.

Model ini sederhana dan cukup baik untuk deployment internal kecil.

Improvement potensial:

- Pertahankan heartbeat sebagai agent push.
- Pertahankan command dispatch sebagai agent pull atau long-poll.
- Tambahkan Server-Sent Events dari API ke dashboard untuk live updates.
- Gunakan WebSocket hanya jika browser perlu komunikasi bidirectional.

### Pertimbangan Redis / Queue

Redis belum wajib untuk desain single-API-server saat ini.

Tambahkan Redis atau queue lain jika satu atau lebih kondisi ini benar:

- Beberapa API server instance membutuhkan koordinasi shared command queue.
- Banyak worker agent polling terlalu sering dan membebani SQLite/API.
- Command claiming, retry, delayed jobs, atau backpressure mulai terlalu berat untuk SQLite.
- API-to-dashboard fanout membutuhkan pub/sub layer.
- Background jobs sebaiknya berjalan di luar request handler.

Refactor jangka pendek yang direkomendasikan sebelum Redis:

1. Pisahkan command routes.
2. Tambahkan command claim/lease states.
3. Tambahkan local executed-command journal di machine-agent.
4. Tambahkan subprocess timeouts.
5. Centralize dashboard polling.

### Risiko Timeout

Heartbeat client saat ini bisa menghabiskan sampai tiga attempt masing-masing 10 detik saat failure path. Ini bisa membuat agent terlihat stale meski heartbeat interval rendah.

Tuning yang direkomendasikan:

- Heartbeat request timeout lebih pendek.
- Immediate retry lebih sedikit.
- Exponential backoff antar cycle.
- Jitter antar retry.
- tmux subprocess timeout.

### Semantik Command Delivery

Eksekusi command saat ini bersifat at-least-once pada beberapa skenario gagal.

Contoh:

1. Agent fetch command accepted.
2. Agent berhasil menjalankan tmux send-keys.
3. Agent gagal report delivery.
4. Command tetap accepted.
5. Agent bisa fetch dan eksekusi command yang sama lagi.

Desain claim/lease di masa depan mengurangi risiko ini tetapi tidak bisa menjamin exactly-once untuk side effect tmux. Untuk proteksi lebih kuat, tambahkan local machine-agent journal berisi command ID yang sudah dieksekusi.

### Batas Scaling SQLite

SQLite cocok untuk:

- Satu API server instance.
- Deployment internal.
- Jumlah machine moderat.
- Persistence sederhana.

Pindah ke Postgres atau server database lain saat:

- Menjalankan beberapa API instance.
- Write contention meningkat.
- Audit history membesar.
- Dibutuhkan transactional concurrency yang lebih kuat.

## Catatan Keamanan

Implementasi saat ini harus diperlakukan sebagai software untuk trusted network.

Risiko:

- Dashboard bisa enqueue teks arbitrary ke sesi tmux.
- API belum memiliki authentication built-in pada kode saat ini.
- Machine IDs adalah string yang ditentukan operator.
- API tidak boleh diekspos ke public internet.
- AI provider keys dikirim dari dashboard ke API untuk assessment calls.

Hardening yang direkomendasikan sebelum production:

- Tambahkan authentication untuk dashboard dan API.
- Tambahkan authorization per machine/session.
- Tambahkan TLS.
- Tambahkan audit log untuk commands.
- Tambahkan CSRF protection jika browser cookies dipakai.
- Tambahkan rate limit.
- Tambahkan command allowlist eksplisit untuk deployment berisiko tinggi.
- Simpan provider secrets di server-side, bukan browser local storage.

## Maintenance Tasks

Secara rutin:

- Cek API logs untuk heartbeat failures.
- Cek machine-agent logs untuk tmux socket errors.
- Monitor ukuran file database.
- Cleanup stale sessions.
- Review command history untuk failed deliveries.
- Pastikan worker machine IDs tetap stabil.
- Jalankan tests sebelum deployment.

Sebelum deployment besar:

- Tune heartbeat interval.
- Tune dashboard refresh interval.
- Putuskan apakah perlu SSE untuk dashboard updates.
- Putuskan apakah command claim/lease sudah diperlukan.
- Putuskan apakah SQLite masih cukup.

