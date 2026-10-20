#!/usr/bin/env sh
# OpenShelf setup for macOS / Linux: run `./setup.sh` from the repo folder.
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install the LTS version from https://nodejs.org and run ./setup.sh again."
  exit 1
fi
exec node scripts/setup.mjs "$@"
