#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

mkdir -p public

GOOS=js GOARCH=wasm go build -o public/trailscan.wasm ./wasm

cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" public/wasm_exec.js
