#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"

AUTO_MODE=false
DRY_RUN=false
NO_BUILD=false
SHOW_HELP=false

usage() {
  cat <<'EOF'
Usage:
  ./start.sh [options] [-- <docker compose args>]

Options:
  --auto         Non-interactive: accept the first available port suggestion
  --dry-run      Print the resolved ports and what would be written, but do
                 not modify .env and do not start docker compose
  --no-build     Pass --no-build to docker compose (skip image rebuild)
  -h, --help     Show this help and exit

Examples:
  ./start.sh
  ./start.sh --auto
  ./start.sh --no-build
  ./start.sh --auto -- -d          # auto-pick ports, then run compose up -d
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --auto)    AUTO_MODE=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --no-build) NO_BUILD=true; shift ;;
    -h|--help) SHOW_HELP=true; shift ;;
    --) shift; break ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if $SHOW_HELP; then
  usage
  exit 0
fi

# ── helpers ──────────────────────────────────────────────────────────

port_in_use() {
  local port="$1"
  # ss is faster than lsof; -l = listening, -t = tcp, -n = numeric
  ss -tlnH "sport = :$port" 2>/dev/null | grep -q .
}

find_available_port() {
  local start="$1"
  local port="$start"
  while port_in_use "$port"; do
    port=$((port + 1))
    if [ "$port" -gt 65535 ]; then
      echo "ERROR: could not find an available port starting from $start" >&2
      exit 1
    fi
  done
  echo "$port"
}

read_env_value() {
  local key="$1"
  local default="$2"
  if [ -f "$ENV_FILE" ]; then
    local val
    val=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d'=' -f2- | tr -d '\r\n')
    if [ -n "$val" ]; then
      echo "$val"
      return
    fi
  fi
  echo "$default"
}

ask_port() {
  local label="$1"     # e.g. "API" or "Dashboard"
  local env_key="$2"   # e.g. "API_PORT" or "DASHBOARD_PORT"
  local default="$3"

  local current
  current="$(read_env_value "$env_key" "$default")"

  if ! port_in_use "$current"; then
    printf "  %-12s port %s — available ✓\n" "$label" "$current" >&2
    echo "$current"
    return
  fi

  local suggestion
  suggestion="$(find_available_port $((current + 1)))"

  printf "  %-12s port %s — IN USE ✗\n" "$label" "$current" >&2
  local chosen
  if $AUTO_MODE; then
    chosen="$suggestion"
    printf "  %-12s auto-selecting port %s\n" "$label" "$chosen" >&2
  else
    printf "  Suggested alternative: %s\n" "$suggestion" >&2
    read -rp "  Enter port for $label [$suggestion]: " chosen
    chosen="${chosen:-$suggestion}"
  fi
  echo "$chosen"
}

write_env_value() {
  local key="$1"
  local value="$2"
  if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_EXAMPLE" ]; then
      cp "$ENV_EXAMPLE" "$ENV_FILE"
    else
      touch "$ENV_FILE"
    fi
  fi
  # Strip \r from Windows line endings so grep/sed work correctly
  sed -i 's/\r$//' "$ENV_FILE"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    grep -vE "^${key}=" "$ENV_FILE" > "$ENV_FILE.tmp"
    echo "${key}=${value}" >> "$ENV_FILE.tmp"
    mv "$ENV_FILE.tmp" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

# ── main ─────────────────────────────────────────────────────────────

echo "Checking ports..."
API_PORT="$(ask_port 'API server' API_PORT 8000)"
DASHBOARD_PORT="$(ask_port 'Dashboard' DASHBOARD_PORT 3000)"

# Also set PORT (the vite / server.mjs variable) to match DASHBOARD_PORT
write_env_value "API_PORT"    "$API_PORT"
write_env_value "DASHBOARD_PORT" "$DASHBOARD_PORT"
write_env_value "PORT"        "$DASHBOARD_PORT"

if $DRY_RUN; then
  echo ""
  echo "DRY RUN — would write to .env:"
  echo "  API_PORT=$API_PORT"
  echo "  DASHBOARD_PORT=$DASHBOARD_PORT"
  echo "  PORT=$DASHBOARD_PORT"
  echo ""
  echo "Would run: docker compose up --build${NO_BUILD:+ --no-build} $*"
  exit 0
fi

echo ""
echo "Starting docker compose (API=$API_PORT, Dashboard=$DASHBOARD_PORT)..."
echo "  Dashboard URL: http://localhost:$DASHBOARD_PORT"
echo "  API health:    http://localhost:$API_PORT/health"
echo ""
COMPOSE_ARGS=()
if $NO_BUILD; then
  COMPOSE_ARGS+=(--no-build)
fi
exec docker compose up "${COMPOSE_ARGS[@]}" "$@"
