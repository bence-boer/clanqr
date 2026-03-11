#!/bin/bash
# Spawn Manager Agent to break a feature into tasks
# Usage: ./spawn-manager.sh <work_dir>

set -euo pipefail

WORK_DIR="${1:?Usage: spawn-manager.sh <work_dir>}"

if [ ! -f "$WORK_DIR/feature-spec.json" ]; then
  echo "ERROR: feature-spec.json not found in $WORK_DIR"
  exit 1
fi

echo "🔨 Starting Manager Agent in $WORK_DIR"

cd "$WORK_DIR"

# Generate prompt dynamically using the single source of truth template
PROMPT=$(bun run "$(dirname "$0")/render-prompt.ts" manager .)

copilot -p "$PROMPT" --allow-all-tools 2>&1 | tee agent.log

echo "✅ Manager Agent completed"
