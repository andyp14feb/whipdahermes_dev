#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"

RESET_PORTS=false
SHOW_HELP=false

usage() {
  cat <<'EOF'
Usage:
  ./stop.sh [options]

Options:
  --reset-ports   Reset API_PORT, DASHBOARD_PORT, and PORT back to defaults
                  in .env after stopping
  -h, --help      Show this help and exit

Examples:
  ./stop.sh
  ./stop.sh --reset-ports
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --reset-ports) RESET_PORTS=true; shift ;;
    -h|--help)     SHOW_HELP=true; shift ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if $SHOW_HELP; then
  usage
  exit 0
fi

echo "Stopping docker compose..."
docker compose down

if $RESET_PORTS; then
  echo "Resetting ports in .env to defaults..."
  if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_EXAMPLE" ]; then
      cp "$ENV_EXAMPLE" "$ENV_FILE"
    else
      touch "$ENV_FILE"
    fi
  fi
  sed -i 's/\r$//' "$ENV_FILE"

  reset_value() {
    local key="$1"
    local value="$2"
    if grep -qE "^${key}=" "$ENV_FILE"; then
      grep -vE "^${key}=" "$ENV_FILE" > "$ENV_FILE.tmp"
      echo "${key}=${value}" >> "$ENV_FILE.tmp"
      mv "$ENV_FILE.tmp" "$ENV_FILE"
    else
      echo "${key}=${value}" >> "$ENV_FILE"
    fi
  }

  reset_value "API_PORT" "8000"
  reset_value "DASHBOARD_PORT" "3000"
  reset_value "PORT" "3000"
  echo "Ports reset: API_PORT=8000, DASHBOARD_PORT=3000, PORT=3000"
fi

echo "Done."
