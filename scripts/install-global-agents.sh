#!/usr/bin/env bash
set -euo pipefail
SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.agents/agents" && pwd)"
TARGET="$HOME/.gemini/config/agents"
mkdir -p "$TARGET"
cp -R "$SOURCE"/* "$TARGET"/
printf 'Copied Lazy Terminal agents to %s\nOpen Antigravity CLI and run /agents to verify discovery.\n' "$TARGET"
printf 'Project-specific rules still belong in the Lazy Terminal repository.\n'
