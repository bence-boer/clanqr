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

copilot -p "You are Ralph, a coding agent. Your job is to execute a specific implementation task.

Read the file task-spec.json in the current directory. It contains the task to execute along with project and feature context.

Your task:
1. Read the task description carefully
2. Execute the task — write code, run commands, create files as needed
3. Test your work when possible (run builds, linters, tests)
4. Write a progress report

Output: Write a file called progress.json in the current directory.
Format: {\"status\": \"complete\", \"summary\": \"What you did\", \"files_changed\": [...]}
On error: {\"status\": \"error\", \"summary\": \"What went wrong\"}

RULES:
- Focus only on this specific task
- Write clean, well-structured code
- Test your work
- Do not modify unrelated files" --allow-all-tools 2>&1 | tee agent.log

echo "✅ Ralph Agent completed"
