#!/bin/bash
# Ставит пакет graphifyy для навыка /graphify в каждой облачной сессии.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if python3 -c "import graphify" 2>/dev/null && command -v graphify >/dev/null 2>&1; then
  exit 0
fi

python3 -m pip install -q graphifyy 2>/dev/null \
  || python3 -m pip install -q --break-system-packages graphifyy
