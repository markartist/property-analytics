#!/bin/bash
set -euo pipefail

ROOT="/Users/mark/Property_Analytics"
HOOKS_DIR="$ROOT/.git/hooks"

if [ ! -d "$HOOKS_DIR" ]; then
  echo "Git hooks directory not found: $HOOKS_DIR"
  exit 1
fi

cat > "$HOOKS_DIR/pre-commit" <<'EOF'
#!/bin/bash
set -euo pipefail

ROOT="/Users/mark/Property_Analytics"

bash "$ROOT/scripts/check_context_discipline.sh"
bash "$ROOT/scripts/check_pib_guardrails.sh"
EOF

chmod +x "$HOOKS_DIR/pre-commit"

echo "Installed repo-managed pre-commit hook:"
echo " - $HOOKS_DIR/pre-commit"
echo ""
echo "This hook now runs:"
echo " - scripts/check_context_discipline.sh"
echo " - scripts/check_pib_guardrails.sh"
