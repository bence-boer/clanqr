#!/bin/bash
# Spawn Manager Agent for a feature
# Usage: ./spawn-manager.sh <work_dir>

set -euo pipefail

WORK_DIR="${1:?Usage: spawn-manager.sh <work_dir>}"

if [ ! -f "$WORK_DIR/feature-spec.json" ]; then
  echo "ERROR: feature-spec.json not found in $WORK_DIR"
  exit 1
fi

echo "📋 Starting Manager Agent in $WORK_DIR"

cd "$WORK_DIR"

copilot -p "You are a Manager Agent. Your role is to research and plan — you NEVER write implementation code.

Read the file feature-spec.json in the current directory. It contains a feature specification with title, description, project name, and resource URLs.

Your task:
1. Read and understand the feature specification
2. If resource URLs are provided, fetch and read each one to understand the context
3. Break down this feature into concrete, actionable implementation tasks
4. Each task should be a single, clear unit of work

Output: Write a file called tasks.json in the current directory.
Format: [{\"description\": \"Task description here\"}, ...]

RULES:
- Do NOT write any implementation code
- Do NOT create any source files
- ONLY create the tasks.json file
- Keep tasks focused and specific
- Order tasks by dependency (prerequisites first)" --allow-all-tools 2>&1 | tee agent.log

echo "✅ Manager Agent completed"
