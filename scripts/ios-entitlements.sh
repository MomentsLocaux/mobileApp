#!/usr/bin/env bash
# Switch iOS entitlements between Personal Team (local Xcode) and paid Apple Developer team.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/ios/boltexponativewind/boltexponativewind.entitlements"
PERSONAL="$ROOT/ios/boltexponativewind/boltexponativewind.personal-team.entitlements"
PAID="$ROOT/ios/boltexponativewind/boltexponativewind.paid-team.entitlements"

usage() {
  echo "Usage: $0 personal|paid"
  echo "  personal — empty entitlements (Personal Team / build Xcode local)"
  echo "  paid     — Push + Sign In with Apple (Apple Developer Program payant / EAS)"
  exit 1
}

[[ $# -eq 1 ]] || usage

case "$1" in
  personal)
    cp "$PERSONAL" "$TARGET"
    echo "OK: entitlements Personal Team (sans push ni Apple Sign In)."
    ;;
  paid)
    cp "$PAID" "$TARGET"
    echo "OK: entitlements payantes (push + Apple Sign In)."
    echo "Pensez à régénérer les profils : npx expo prebuild --no-install ou eas build."
    ;;
  *)
    usage
    ;;
esac
