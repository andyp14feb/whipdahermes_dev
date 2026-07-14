# Panduan Pengguna WhipAI / Hermes

## Latar Belakang

WhipAI, juga disebut Hermes Control Plane, adalah dashboard human-in-the-loop untuk memantau dan mengontrol banyak sesi AI coding berbasis tmux dari satu tempat.

Sebelumnya, workflow seperti ini biasanya bergantung pada pengecekan terminal secara manual, script lokal, cron-style checking, dan notifikasi terpisah. Cara tersebut membuat beberapa pertanyaan operasional sulit dijawab dengan cepat:

- Sesi AI coding mana yang masih aktif?
- Sesi mana yang sedang menunggu input?
- Sesi mana yang terlihat stuck?
- Mesin mana yang memiliki sesi tertentu?
- Output terminal terbaru seperti apa?
- Bagaimana operator bisa mengirim command cepat tanpa SSH ke banyak mesin?

WhipAI menyelesaikan masalah ini dengan menjalankan machine agent kecil di setiap mesin worker. Agent menangkap output pane tmux, mengirim heartbeat snapshot ke API server pusat, lalu polling command dari server. Web dashboard membaca state dari API server dan memberi operator tempat untuk melihat session, mengirim command, dan menjalankan workflow umum.

## Konsep Utama

### Server Machine

Server machine menjalankan:

- FastAPI API server.
- React web dashboard.
- Database SQLite yang dipakai API server.

Server adalah control plane pusat. Machine agent dari mesin worker terhubung ke server melalui HTTP.

### Client / Worker Machine

Client machine, atau worker machine, menjalankan:

- Satu atau lebih sesi tmux.
- Proses `machine-agent`.

Worker machine memiliki tmux socket lokal. Worker bertanggung jawab menangkap output tmux dan mengeksekusi command tmux secara lokal.

### Machine Agent

Machine agent adalah proses Python yang berjalan di setiap worker machine. Agent memiliki dua loop utama:

- Heartbeat loop: menangkap pane tmux, mem-parse state session, dan mengirim data terbaru ke API.
- Command loop: polling command yang pending dari API, mengeksekusinya melalui tmux, lalu melaporkan hasil delivery.

### Heartbeat

Heartbeat adalah snapshot terbaru dari satu mesin. Payload heartbeat berisi machine ID dan daftar session tmux yang terlihat, termasuk preview text, working directory, idle time, diff percentage, dan timestamp capture.

### Command

Command adalah instruksi operator yang di-queue di API lalu dieksekusi oleh machine agent. Contoh command umum:

- `yes`
- `continue`
- `retry`
- Teks bebas yang diketik operator.
- Payload kontrol internal seperti pause, resume, restart, shutdown, create tmux session, atau rename tmux session.

### Dashboard

Dashboard adalah UI browser untuk melihat machine dan session. Dashboard tidak terhubung langsung ke worker machine. Dashboard hanya berbicara dengan API server.

## Prasyarat

### Prasyarat Server Machine

Wajib:

- Git.
- Docker dan Docker Compose untuk deployment paling sederhana.
- Akses jaringan dari worker machine ke server pada port `8000`.
- Akses jaringan dari browser operator ke dashboard pada port `3000`.

Mode development manual juga membutuhkan:

- Python 3.12 atau lebih baru.
- Node.js dan npm.

Direkomendasikan:

- Linux server atau Linux VM untuk deployment yang mirip production.
- LAN, VPN, atau SSH tunnel antara server dan worker machine.
- Firewall rule yang hanya membuka API untuk mesin terpercaya.

### Prasyarat Client / Worker Machine

Wajib:

- Linux atau environment lain yang mendukung tmux.
- tmux sudah terpasang.
- Python 3.12 atau lebih baru jika menjalankan agent secara manual.
- Git jika clone repository langsung.
- Akses jaringan ke URL API server.

Opsional:

- Docker jika ingin menjalankan machine agent dalam container.
- systemd, tmux, screen, atau supervisor lain untuk menjaga agent tetap berjalan.

### Asumsi Keamanan

WhipAI dapat mengirim teks ke sesi tmux. Perlakukan API server dan dashboard sebagai tool internal yang trusted.

Jangan expose API server langsung ke public internet sebelum menambahkan authentication, authorization, TLS, dan access control.

## Gambaran Instalasi

Ada dua model deployment umum:

1. Deployment lokal satu mesin: API server, dashboard, dan machine agent berjalan di mesin yang sama.
2. Deployment multi-mesin: API server dan dashboard berjalan di server pusat; setiap worker machine hanya menjalankan machine agent.

## Instalasi di Server Machine

### Opsi A: Docker Compose

Dari child implementation repository:

```bash
cd D:/__KALICODE/whipdahermes/whipdahermes_dev
docker compose up --build
```

Stack compose akan menjalankan:

- API server: `http://localhost:8000`
- Dashboard: `http://localhost:3000`
- Machine agent: agent lokal berbasis container dengan mount tmux socket sesuai konfigurasi

Cek API:

```bash
curl http://localhost:8000/health
```

Response yang diharapkan:

```json
{"status":"ok"}
```

Stop stack:

```bash
docker compose down
```

Database SQLite disimpan di:

```text
./data/hcp.db
```

### Opsi B: API Server Manual

Gunakan opsi ini untuk development atau saat ingin menjalankan service secara terpisah.

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

### Opsi C: Web Dashboard Manual

Di terminal kedua:

```bash
cd whipdahermes_dev/apps/web-dashboard
npm install
npm run dev
```

Buka URL Vite yang muncul di terminal. Pada development lokal biasanya:

```text
http://localhost:5173
```

Untuk Docker Compose, gunakan:

```text
http://localhost:3000
```

## Instalasi di Client / Worker Machine

### Langkah 1: Temukan URL API Server

Di server, cari alamat LAN:

```bash
ip addr show
```

Contoh API URL:

```text
http://192.168.1.100:8000
```

Dari worker machine, cek koneksi:

```bash
curl http://192.168.1.100:8000/health
```

Response yang diharapkan:

```json
{"status":"ok"}
```

### Langkah 2: Install Dependency Worker

Di Debian atau Ubuntu:

```bash
sudo apt update
sudo apt install -y tmux python3.12 python3.12-venv git curl
```

Buat minimal satu sesi tmux untuk dipantau:

```bash
tmux new -d -s agent-1
tmux ls
```

### Langkah 3: Jalankan Machine Agent Secara Manual

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

Gunakan `MACHINE_ID` yang unik untuk setiap worker.

### Langkah 4: Jalankan Machine Agent dengan systemd

Buat file service:

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

Enable dan start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now whipai-machine-agent
sudo systemctl status whipai-machine-agent
```

Lihat log:

```bash
journalctl -u whipai-machine-agent -f
```

### Langkah 5: Jalankan Machine Agent dengan Docker

Opsi Docker berguna jika container agent bisa mengakses host tmux socket.

Build image:

```bash
cd whipdahermes_dev/apps/machine-agent
docker build -t whipai-machine-agent .
```

Run container:

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

Sesuaikan `/tmp/tmux-1000` dengan direktori tmux socket milik user host.

Cek path socket:

```bash
tmux display-message -p '#{socket_path}'
```

## Environment Variables

### Machine Agent

| Variable | Wajib | Default | Deskripsi |
| --- | --- | --- | --- |
| `API_URL` | Ya | none | Base URL API server pusat. |
| `MACHINE_ID` | Tidak | hostname | Identitas unik mesin yang tampil di dashboard. |
| `INTERVAL` | Tidak | `2` | Detik antar heartbeat cycle. |
| `COMMAND_POLL_INTERVAL` | Tidak | `5` | Detik antar command polling cycle. |
| `TMUX_SOCKET` | Tidak | `/tmp/tmux-<uid>/default` | Path tmux socket yang dipakai agent. |

### API Server

| Variable | Wajib | Default | Deskripsi |
| --- | --- | --- | --- |
| `DATABASE_URL` | Tidak | app default | SQLModel database URL. Docker Compose memakai `sqlite:////data/hcp.db`. |
| `STALE_TIMEOUT_SECONDS` | Tidak | `60` | Menandai machine stale jika heartbeat tidak masuk dalam periode ini. |
| `CLEANUP_TIMEOUT_SECONDS` | Tidak | `86400` | Menghapus record machine yang stale terlalu lama. |

### Dashboard

| Variable | Wajib | Default | Deskripsi |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | Tidak | same origin / proxy | Base URL API langsung untuk build dashboard yang tidak memakai proxy. |
| `API_PROXY_TARGET` | Tidak | nilai compose | Target API URL yang dipakai proxy container dashboard. |

User settings dashboard disimpan di browser local storage.

## Checklist First Run

1. Start API server.
2. Pastikan `GET /health` mengembalikan `{"status":"ok"}`.
3. Start dashboard.
4. Start satu atau lebih machine agent.
5. Pastikan setiap worker bisa mencapai URL API server.
6. Pastikan setiap worker memiliki sesi tmux yang terlihat melalui `tmux ls`.
7. Buka dashboard dan pastikan machine muncul di panel kiri.
8. Pilih session dan cek CLI preview.
9. Kirim command aman seperti `pwd` atau `echo ok` untuk memverifikasi command routing.

## Cara Menggunakan Dashboard

### Machine List

Panel kiri menampilkan machine yang diketahui API server. Setiap machine card menampilkan:

- Machine display name.
- Jumlah session.
- Waktu last registered.
- Marker stale jika machine tidak heartbeat baru-baru ini.
- Daftar session yang bisa expand/collapse.

Kontrol yang tersedia:

- Mengurutkan machine card secara manual dengan drag.
- Sort machine berdasarkan manual order, name, atau last registered time.
- Sort session berdasarkan manual order, name, status, atau stable time.
- Expand atau collapse semua session list.
- Cleanup stale sessions.

### Session List

Setiap baris session menampilkan:

- Session label.
- Status saat ini.
- Waktu sejak session terakhir berubah.

Klik baris session untuk memilihnya.

### Arti Status

| Status | Arti |
| --- | --- |
| `active` | Output session berubah cukup signifikan. |
| `stable` | Session baru berubah dan sekarang sedang quiet. |
| `waiting` | Session sudah quiet beberapa waktu tetapi belum dianggap stuck. |
| `waiting_input` | Output session terlihat meminta input manusia. |
| `stuck` | Session terlalu lama quiet dan tidak menunjukkan progress. |
| `stale` | Machine belum mengirim heartbeat terbaru. |
| `unknown` | Classifier belum bisa menentukan state. |

### Watch Windows

Dashboard bisa menampilkan satu atau lebih session window.

Gunakan:

- `Add window` untuk menambah panel watched session.
- `Columns` untuk memilih layout satu kolom atau dua kolom.
- Session selector di setiap window untuk memilih session tmux yang dipantau.
- `Unwatch` untuk mengosongkan window.
- `Remove Window` untuk menghapus window tambahan.
- Resize handle di bawah terminal preview untuk mengatur tinggi CLI preview.

### CLI Preview

CLI preview menampilkan teks terbaru yang ditangkap dari pane tmux terpilih. Preview diperbarui melalui polling API.

Preview ini bukan terminal emulator live. Ini adalah snapshot terbaru yang dikirim machine agent saat heartbeat.

### Free-Form Commands

Untuk mengirim command custom:

1. Pilih session.
2. Ketik command di text area `Command Actions`.
3. Klik `Send` atau tekan `Ctrl+Enter`.

Machine agent mengeksekusi payload dengan:

```text
tmux send-keys -t <session_id> <payload> Enter
```

Gunakan dengan hati-hati. Command dikirim sebagai input ke session tmux terpilih.

### Template Actions

Template actions adalah tombol cepat untuk command yang sering dipakai. Default example:

- `yes`
- `continue`
- `retry`
- `skip`
- `explain`

Konfigurasi template ada di:

```text
Settings -> Quick Templates
```

Setiap template memiliki:

- Label: teks tombol di dashboard.
- Payload: teks yang dikirim ke session tmux.

### Command History

Setelah command dikirim, command muncul di history dengan state:

- `pending`: dashboard sudah queue command dan sedang polling status.
- `accepted`: API sudah menerima command.
- `delivered`: machine agent melaporkan eksekusi berhasil.
- `failed`: machine agent atau API melaporkan kegagalan.

Gunakan `Resend` untuk queue payload yang sama lagi.

### Machine-Agent Control

Command panel memiliki action kontrol machine-agent:

| Action | Efek |
| --- | --- |
| Start updates | Resume heartbeat updates pada agent. |
| Stop updates | Pause heartbeat updates pada agent. |
| Restart service | Meminta proses agent restart sendiri. |
| Shutdown service | Meminta proses agent berhenti. |

Semua action ini di-queue melalui command router yang sama dengan command biasa.

### Membuat Session tmux Baru

Pada machine card, klik `New tmux`.

Dashboard akan meminta nama session. Jika kosong, dashboard memakai nama generated. Request di-queue sebagai control command dan dieksekusi machine agent.

Session baru muncul setelah heartbeat berikutnya berhasil.

### Rename Session tmux

Pada baris session, klik `Rename`.

Masukkan nama session tmux baru. Request di-queue dan dieksekusi machine agent. Session dengan nama baru muncul setelah heartbeat berikutnya.

Karakter nama session yang diizinkan:

```text
letters, numbers, dot, underscore, colon, hyphen
```

Nama harus diawali huruf atau angka.

### Menghapus Machine dari Tampilan

Klik tombol remove pada machine card.

Ini menghapus record machine dari database API, tetapi tidak menghentikan machine agent dan tidak membunuh sesi tmux. Jika machine agent masih berjalan, machine bisa muncul lagi pada heartbeat berikutnya.

### Menghapus Session dari Tampilan

Klik tombol remove pada baris session.

Ini menghapus session dari database API, tetapi tidak membunuh sesi tmux. Jika sesi tmux masih ada, session bisa muncul lagi pada heartbeat berikutnya.

### Cleanup Stale Sessions

Klik `Cleanup Stale Sessions` di kontrol machine list.

Action ini memanggil admin cleanup endpoint dan menghapus stale session rows dari database API. Gunakan saat dashboard menampilkan record lama yang tidak perlu.

### Nudges

Nudge otomatis mengirim prompt tertentu ke session yang tetap stable, waiting, waiting for input, atau stuck melewati threshold.

Cara mengaktifkan:

1. Cari baris session.
2. Centang `Nudge this`.
3. Klik `Configure`.
4. Set stable time threshold.
5. Set jumlah maksimum nudge.
6. Opsional: isi custom prompt.

Default nudge prompt:

```text
Please continue if you are waiting for input.
```

Gunakan `Mark nudge sent` jika sudah melakukan intervensi manual dan ingin menaikkan local nudge count.

Konfigurasi nudge disimpan di browser local storage.

### AI Assessment

AI assessment memungkinkan dashboard meminta provider OpenAI-compatible, Anthropic-compatible, Gemini-compatible, Ollama-compatible, atau 9Router-compatible untuk mengklasifikasi session terpilih.

Konfigurasi provider:

```text
Settings -> Connection
```

Field yang diperlukan:

- Provider type.
- Provider base URL.
- API key jika diperlukan.
- Nama model atau model yang di-fetch.
- Request timeout.

Cara memakai:

1. Pilih session.
2. Klik `Assess` di watched window.
3. Lihat assessment banner di atas preview.

Dashboard juga bisa auto-assess saat watched session berubah menjadi `waiting`, `waiting_input`, atau `stuck`.

### Appearance dan Themes

Gunakan Settings untuk:

- Switch light/dark mode.
- Memilih color theme.
- Customize colors.
- Menyimpan custom preset.
- Load atau delete saved preset.

Theme settings disimpan di browser local storage.

### Refresh dan Timeout Settings

Gunakan Settings untuk mengatur:

- Refresh interval: seberapa sering dashboard polling API state.
- Request timeout: berapa lama AI assessment call boleh berjalan.
- Stale timeout: setting user-facing untuk interpretasi stale machine.

API server juga memiliki environment variable `STALE_TIMEOUT_SECONDS`. Untuk perilaku yang konsisten, samakan dashboard stale timeout dengan API stale timeout.

### Worker Machine Script

Settings menyediakan worker machine script yang generated. Script tersebut:

- Clone atau update repository.
- Membuat Python virtual environment.
- Install machine agent.
- Export environment variables worker.
- Start machine agent.

Review dan sesuaikan path sebelum menjalankan script di worker machine.

## Troubleshooting

### API Health Check Gagal

Gejala:

- `curl http://server:8000/health` gagal.
- Dashboard menampilkan connection error.

Cek:

```bash
docker compose ps
docker compose logs api-server
```

Mode manual:

```bash
cd apps/api-server
source .venv/bin/activate
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

Penyebab umum:

- API server belum berjalan.
- Port `8000` diblokir.
- IP server salah.
- Docker container gagal build atau start.

### Dashboard Tidak Bisa Menghubungi API

Gejala:

- Connection banner muncul.
- Machine list tidak refresh.
- Request timeout.

Cek:

- Pastikan API health bisa diakses dari mesin browser.
- Pastikan dashboard proxy target benar jika memakai Docker.
- Jika memakai `VITE_API_BASE_URL`, pastikan CORS mengizinkan origin dashboard.
- Naikkan refresh interval jika banyak window terbuka.

### Machine Tidak Muncul

Cek di worker:

```bash
echo "$API_URL"
echo "$MACHINE_ID"
curl "$API_URL/health"
tmux ls
```

Log agent:

```bash
journalctl -u whipai-machine-agent -f
```

atau:

```bash
docker logs -f whipai-machine-agent
```

Penyebab umum:

- `API_URL` kosong atau salah.
- Firewall memblokir worker dari server.
- Machine agent tidak berjalan.
- tmux belum terinstall.
- Path tmux socket salah.

### Machine Muncul Sebagai Stale

Machine dianggap stale saat API server tidak menerima heartbeat dalam `STALE_TIMEOUT_SECONDS`.

Cek:

- Apakah agent berjalan?
- Apakah agent bisa reach API?
- Apakah heartbeat loop terblokir network lambat atau API timeout?
- Apakah worker sleep, offline, atau IP berubah?

Recovery sementara:

```bash
sudo systemctl restart whipai-machine-agent
```

atau:

```bash
docker restart whipai-machine-agent
```

### Session Tidak Muncul

Cek:

```bash
tmux ls
tmux list-panes -a
tmux display-message -p '#{socket_path}'
```

Penyebab umum:

- Tidak ada sesi tmux.
- Agent berjalan sebagai user berbeda dari sesi tmux.
- `TMUX_SOCKET` menunjuk socket yang salah.
- Docker container tidak bisa mengakses mount host tmux socket.

### Command Tetap Pending atau Accepted

Cek:

- Pastikan command loop machine agent berjalan.
- Pastikan `COMMAND_POLL_INTERVAL` diset.
- Cek log agent untuk command fetch atau delivery error.
- Pastikan session terpilih masih ada.
- Pastikan tmux target name sesuai session yang tampil di dashboard.

### Command Gagal

Penyebab umum:

- Sesi tmux sudah ditutup setelah snapshot dashboard.
- tmux command return non-zero exit code.
- Binary tmux tidak terinstall.
- Agent tidak bisa mengakses tmux socket.
- Payload invalid untuk control command.

### CLI Preview Terlambat

Preview berubah berdasarkan heartbeat dan dashboard polling interval. Delay bisa berasal dari:

- Machine-agent `INTERVAL`.
- Dashboard refresh interval.
- Latensi network.
- API overload.
- tmux capture lambat.

Untuk refresh lebih cepat, turunkan `INTERVAL` dan dashboard refresh interval. Untuk load lebih rendah, naikkan keduanya.

### Dashboard Timeout Warning

Penyebab mungkin:

- Request API melewati default timeout dashboard 5 detik.
- Dashboard memiliki banyak watched window yang polling pada interval sama.
- API server sibuk dengan SQLite write atau cleanup.
- Network lambat atau tidak stabil.
- AI assessment provider lambat.

Mitigasi:

- Naikkan dashboard refresh interval.
- Kurangi watched window.
- Cek API logs.
- Hindari cleanup saat aktivitas tinggi.
- Naikkan AI request timeout untuk model lambat.

### AI Assessment Gagal

Cek:

- Provider base URL benar.
- Provider type sesuai endpoint.
- API key benar.
- Nama model valid.
- Request timeout cukup panjang.
- Provider bisa dijangkau dari API server, bukan hanya dari browser.

### Cleanup Gagal

Endpoint cleanup saat ini mengharapkan path database Docker:

```text
/data/hcp.db
```

Jika menjalankan manual dengan lokasi database lain, cleanup bisa return `DB not found`. Gunakan Docker Compose atau samakan database path.

## Praktik Operasional yang Disarankan

- Gunakan `MACHINE_ID` yang stabil dan unik.
- Jalankan API pada IP atau DNS server yang stabil.
- Jaga worker agent dengan systemd atau Docker restart policy.
- Simpan API dan dashboard di trusted network.
- Hindari public exposure sampai authentication dan authorization ditambahkan.
- Gunakan heartbeat interval moderat untuk banyak machine.
- Gunakan template action yang jelas untuk response operator umum.
- Perlakukan free-form command sebagai aksi privileged operator.

