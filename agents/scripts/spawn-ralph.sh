#!/bin/bash
# Spawn Ralph Agent for a task
# Usage: ./spawn-ralph.sh <work_dir>

set -euo pipefail

WORK_DIR="${1:?Usage: spawn-ralph.sh <work_dir>}"

if [ ! -f "$WORK_DIR/task-spec.json" ]; then
  echo "ERROR: task-spec.json not found in $WORK_DIR"
  exit 1
fi

echo "🔨 Starting Ralph Agent in $WORK_DIR"

cd "$WORK_DIR"

# Generate prompt dynamically using the single source of truth template
PROMPT=$(bun run "$(dirname "$0")/render-prompt.ts" ralph .)

copilot -p "$PROMPT" --allow-all-tools 2>&1 | tee agent.log

echo "✅ Ralph Agent completed"
