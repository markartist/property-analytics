#!/usr/bin/env bash
# deploy_api.sh
# Apply D1 migrations and deploy the API Worker.
# Idempotent: migrations use IF NOT EXISTS; deploy overwrites current version.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
API_DIR="${ROOT_DIR}/apps/api"
MIGRATIONS_DIR="${ROOT_DIR}/infra/migrations"

echo "=== POP Brief — API Deploy ==="
echo ""

# 1. Validate wrangler
if ! command -v wrangler &> /dev/null; then
  echo "ERROR: wrangler CLI not found. Run bootstrap_cloudflare.sh first."
  exit 1
fi

# 2. Apply D1 migrations
echo "Applying D1 migrations..."
for migration in "${MIGRATIONS_DIR}"/*.sql; do
  if [ -f "$migration" ]; then
    FILENAME=$(basename "$migration")
    echo "  → ${FILENAME}"
    wrangler d1 execute pop-brief-db --file="$migration" --config="${API_DIR}/wrangler.toml"
  fi
done
echo "✓ Migrations applied."

# 3. Install dependencies
echo ""
echo "Installing API dependencies..."
(cd "$API_DIR" && npm install)
echo "✓ Dependencies installed."

# 4. Deploy Worker
echo ""
echo "Deploying API Worker..."
(cd "$API_DIR" && wrangler deploy)
echo ""
echo "✓ API deployed."
echo ""
echo "=== Deploy complete ==="
