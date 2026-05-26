#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
python3 Data_Collection/utils/property_identity.py "$@"
