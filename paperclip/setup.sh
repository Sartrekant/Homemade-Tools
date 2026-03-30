#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Check docker ──────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "Error: docker is not installed. Get it at https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "Error: docker compose plugin not found. Update Docker Desktop or install the plugin."
  exit 1
fi

# ── Create .env if missing ────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

# ── Generate BETTER_AUTH_SECRET if not set ────────────────────────────────────
if ! grep -qE '^BETTER_AUTH_SECRET=.+' .env; then
  SECRET="$(openssl rand -base64 32)"
  # Replace the empty value in-place
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=${SECRET}|" .env
  else
    sed -i "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=${SECRET}|" .env
  fi
  echo "Generated BETTER_AUTH_SECRET."
fi

# ── Start Paperclip ───────────────────────────────────────────────────────────
echo ""
echo "Starting Paperclip..."
docker compose up -d --pull always

# ── Done ──────────────────────────────────────────────────────────────────────
PORT="$(grep -E '^PORT=' .env | cut -d= -f2)"
PORT="${PORT:-3100}"

echo ""
echo "Paperclip is running at: http://localhost:${PORT}"
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:${PORT} and create your account"
echo "  2. Import .paperclip/company.yaml to load your agent company"
echo "  3. Add your ANTHROPIC_API_KEY or OPENAI_API_KEY to .env, then restart:"
echo "       docker compose restart"
echo ""
echo "To stop:    docker compose down"
echo "To upgrade: docker compose pull && docker compose up -d"
