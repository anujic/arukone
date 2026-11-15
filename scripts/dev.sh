#!/bin/sh
# Starts the containerised Vite dev server (used by .claude/launch.json).
export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"
cd "$(dirname "$0")/.." && exec docker compose up dev
