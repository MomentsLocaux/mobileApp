#!/usr/bin/env bash
# SSOT: content/lumia/knowledge.json → Edge Function + mobile import path
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/content/lumia/knowledge.json"
cp "$SRC" "$ROOT/supabase/functions/lumia-chat/knowledge.json"
mkdir -p "$ROOT/src/content/lumia"
cp "$SRC" "$ROOT/src/content/lumia/knowledge.json"
echo "Synced Lumia knowledge → edge + src/content"
