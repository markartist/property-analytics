#!/usr/bin/env bash
set -euo pipefail

# Override only for explicitly approved PIB lock work.
if [[ "${ALLOW_PIB_LOCK_OVERRIDE:-0}" == "1" ]]; then
  echo "PIB guardrails bypassed via ALLOW_PIB_LOCK_OVERRIDE=1"
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repository; cannot run PIB guardrail diff checks."
  exit 1
fi

BASE_REF="${1:-}"
if [[ -z "$BASE_REF" ]]; then
  if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    BASE_REF="HEAD~1"
  else
    BASE_REF="HEAD"
  fi
fi

RANGE="${BASE_REF}..HEAD"

CHANGED="$(git diff --name-only "$RANGE" || true)"
DIFF_TEXT="$(git diff "$RANGE" || true)"

LOCKED_FILES=(
  "Property_Intelligence_Brief/generate_property_intelligence_brief.py"
  "Property_Intelligence_Brief/templates/executive_email_template.py"
  "Property_Intelligence_Brief/send_property_intelligence_brief_email.py"
  "Property_Intelligence_Brief/generate_property_intelligence_brief_v2_2_0.py"
  "Property_Intelligence_Brief/templates/executive_email_template_v2_2_0.py"
  "Property_Intelligence_Brief/send_property_intelligence_brief_email_v2_2_0.py"
)

violations=0

for f in "${LOCKED_FILES[@]}"; do
  if printf '%s\n' "$CHANGED" | rg -xq "$f"; then
    echo "PIB LOCK VIOLATION: modified locked file: $f"
    violations=1
  fi
done

# Disallow adding custom PIB renderers outside canonical PIB module.
PATTERNS=(
  '^\+\s*function\s+buildPibEmailHtml'
  '^\+\s*pib\.post\("/report"'
  '^\+\s*export\s+async\s+function\s+generatePibReport'
  '^\+.*Property Intelligence Brief.*<'
)

for p in "${PATTERNS[@]}"; do
  if printf '%s\n' "$DIFF_TEXT" | rg -n "$p" >/dev/null 2>&1; then
    echo "PIB LOCK VIOLATION: disallowed added pattern matched: $p"
    violations=1
  fi
done

if [[ "$violations" -ne 0 ]]; then
  echo
  echo "Guardrail check failed."
  echo "If this is explicitly approved PIB lock work, rerun with:"
  echo "  ALLOW_PIB_LOCK_OVERRIDE=1 bash scripts/check_pib_guardrails.sh ${BASE_REF}"
  exit 1
fi

echo "PIB guardrail check passed."
