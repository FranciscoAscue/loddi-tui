#!/usr/bin/env bash
set -euo pipefail

source_url='https://codeload.github.com/FranciscoAscue/loddi-tui/tar.gz/refs/heads/master'

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
command -v curl >/dev/null 2>&1 || fail 'curl is required.'
command -v tar >/dev/null 2>&1 || fail 'tar is required.'

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 20) ? 0 : 1)' || fail 'Node.js 22.20+ is required.'

work_dir="$(mktemp -d)" || fail 'Could not create a temporary directory.'
cleanup() {
  if [[ -n "$work_dir" && -d "$work_dir" ]]; then
    rm -rf -- "$work_dir"
  fi
}
trap cleanup EXIT

printf 'Downloading and building Loddi...\n'
mkdir "$work_dir/source"
curl -fsSL "$source_url" -o "$work_dir/source.tar.gz" || fail 'Could not download the Loddi source archive.'
tar -xzf "$work_dir/source.tar.gz" -C "$work_dir/source" --strip-components=1 || fail 'Could not unpack the Loddi source archive.'

cd "$work_dir/source"
npm ci --no-audit --no-fund || fail 'Could not install the build dependencies.'
archive_name="$(npm pack --ignore-scripts --pack-destination "$work_dir" --silent)" || fail 'Could not package Loddi.'
case "$archive_name" in
  loddi-tui-*.tgz) ;;
  *) fail 'npm pack returned an unexpected archive name.' ;;
esac
npm install --global --no-audit --no-fund "$work_dir/$archive_name" || fail 'npm installation failed. Check that your global npm prefix is writable; this installer does not use sudo.'

if command -v loddi >/dev/null 2>&1; then
  printf 'Loddi installed: '
  loddi --version
else
  printf 'Loddi installed, but the npm global bin directory is not on PATH.\n' >&2
  printf 'Check the prefix with: npm prefix --global\n' >&2
fi
