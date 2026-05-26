#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

violations=0

required_files=(
  "reports/captains_log/generate_captains_brief_vnext.py"
  "reports/captains_log/generate_spotlight_captains_brief.py"
)

for file in "${required_files[@]}"; do
  if ! rg -q "render_captain_header" "$file"; then
    echo "CAPTAIN HEADER LOCK VIOLATION: $file does not use render_captain_header"
    violations=1
  fi

  if rg -n "letter-spacing:7px|>VENTERRA<|font-size:32px;line-height:37px;font-weight:800;color:#4b5565" "$file" >/dev/null; then
    echo "CAPTAIN HEADER LOCK VIOLATION: $file contains old custom header styling"
    rg -n "letter-spacing:7px|>VENTERRA<|font-size:32px;line-height:37px;font-weight:800;color:#4b5565" "$file" || true
    violations=1
  fi
done

if ! python3 - <<'PY'
from reports.captains_log.captain_brief_header import load_venterra_logo_data_uri

uri = load_venterra_logo_data_uri()
assert uri.startswith("data:image/png;base64,")
assert len(uri) > 1000
PY
then
  echo "CAPTAIN HEADER LOCK VIOLATION: locked Venterra logo data URI failed validation"
  violations=1
fi

if [[ "$violations" -ne 0 ]]; then
  echo "Captain Brief header lock check failed."
  exit 1
fi

echo "Captain Brief header lock check passed."
