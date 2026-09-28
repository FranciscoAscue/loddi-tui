#!/usr/bin/env bash
set -euo pipefail

repo='github:FranciscoAscue/loddi-tui#master'

fail() {
  printf 'Loddi installer: %s\n' "$1" >&2
  exit 1
}

case "$(uname -s)" in
  Linux|Darwin) ;;
  *) fail 'This script supports Linux and macOS. On Windows, use npm in PowerShell (see docs/INSTALL.md).' ;;
esac

command -v node >/dev/null 2>&1 || fail 'Node.js 22.20+ is required: https://nodejs.org/'
command -v npm >/dev/null 2>&1 || fail 'npm is required: https://nodejs.org/'
command -v git >/dev/null 2>&1 || fail 'Git is required while installing Loddi from GitHub.'

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 20) ? 0 : 1)' || fail 'Node.js 22.20+ is required.'

printf 'Installing Loddi from %s ...\n' "$repo"
npm install --global --no-audit --no-fund "$repo" || fail 'npm installation failed. Check that your npm global prefix is writable; this installer does not use sudo.'

if command -v loddi >/dev/null 2>&1; then
  printf 'Loddi installed: '
  loddi --version
else
  printf 'Loddi installed, but the npm global bin directory is not on PATH.\n' >&2
  printf 'Check the prefix with: npm prefix --global\n' >&2
fi
