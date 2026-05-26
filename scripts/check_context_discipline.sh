#!/bin/bash
set -euo pipefail

ROOT="/Users/mark/Property_Analytics"
MEMORY_FILE="ATLAS_WORKING_MEMORY.md"
REGISTER_FILE="docs/CAPABILITY_REGISTER_2026-04-10.md"
AUDIT_FILE="docs/FULL_SYSTEM_AUDIT_2026-04-10.md"

cd "$ROOT"

changed_files="$(git status --short)"

if [ -z "$changed_files" ]; then
  echo "Context discipline check: no working tree changes detected."
  exit 0
fi

non_context_changes="$(printf '%s\n' "$changed_files" | awk '{print $2}' | grep -v -E "^(${MEMORY_FILE}|${REGISTER_FILE}|${AUDIT_FILE})$" || true)"
changed_paths="$(printf '%s\n' "$changed_files" | awk '{print $2}')"

if [ -z "$non_context_changes" ]; then
  echo "Context discipline check: only context docs changed."
  exit 0
fi

missing=()

grep -Fxq "$MEMORY_FILE" <<< "$changed_paths" || missing+=("$MEMORY_FILE")
grep -Fxq "$REGISTER_FILE" <<< "$changed_paths" || missing+=("$REGISTER_FILE")

if [ ${#missing[@]} -gt 0 ]; then
  echo "Context discipline check failed."
  echo "Non-context files changed, but required context docs were not all updated."
  echo ""
  echo "Changed non-context files:"
  printf ' - %s\n' $non_context_changes
  echo ""
  echo "Missing required updates:"
  printf ' - %s\n' "${missing[@]}"
  echo ""
  echo "If the system narrative changed materially, also update:"
  echo " - $AUDIT_FILE"
  exit 1
fi

echo "Context discipline check passed."
echo "Memory and capability register were both updated alongside other changes."
