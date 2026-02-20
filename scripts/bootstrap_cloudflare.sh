#!/usr/bin/env bash
# bootstrap_cloudflare.sh
# Validates prerequisites and outputs manual steps for Cloudflare resource provisioning.
# Idempotent: safe to run multiple times.

set -euo pipefail

echo "=== POP Brief — Cloudflare Bootstrap ==="
echo ""

# 1. Check wrangler
if ! command -v wrangler &> /dev/null; then
  echo "ERROR: wrangler CLI not found."
  echo "Install: npm install -g wrangler"
  exit 1
fi

WRANGLER_VERSION=$(wrangler --version 2>&1 | head -1)
echo "✓ wrangler found: ${WRANGLER_VERSION}"

# 2. Check auth
echo ""
echo "Checking Cloudflare auth..."
if wrangler whoami &> /dev/null; then
  echo "✓ Authenticated with Cloudflare."
else
  echo "WARNING: Not authenticated. Run: wrangler login"
fi

# 3. Manual provisioning steps
echo ""
echo "=== Manual Provisioning Steps ==="
echo ""
echo "1. Create D1 database:"
echo "   wrangler d1 create pop-brief-db"
echo "   → Copy the database_id into apps/api/wrangler.toml"
echo ""
echo "2. Create R2 bucket:"
echo "   wrangler r2 bucket create pop-brief-uploads"
echo ""
echo "3. Set secrets:"
echo "   wrangler secret put RESEND_API_KEY"
echo "   wrangler secret put EMAIL_FROM"
echo "   wrangler secret put SESSION_SIGNING_SECRET"
echo ""
echo "4. Configure custom domains (after first deploy):"
echo "   API:  api.venterradev.com → pop-brief-api worker"
echo "   Web:  app.venterradev.com → Cloudflare Pages project"
echo ""
echo "=== Bootstrap complete ==="
