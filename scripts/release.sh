#!/usr/bin/env bash
set -euo pipefail

SIGNING_IDENTITY="Developer ID Application: Inceptyon Labs LLC (3T877KDT79)"
APP_NAME="Prestige"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_DIR="$PROJECT_DIR/src-tauri/target/release/bundle/macos"
APP_PATH="$BUNDLE_DIR/$APP_NAME.app"
DEST="/Applications/$APP_NAME.app"

cd "$PROJECT_DIR"

echo "==> Building release bundle (signed with: $SIGNING_IDENTITY)"
APPLE_SIGNING_IDENTITY="$SIGNING_IDENTITY" bun run tauri:build

if [[ ! -d "$APP_PATH" ]]; then
  echo "ERROR: Expected app bundle not found at $APP_PATH" >&2
  exit 1
fi

echo "==> Verifying signature"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

if [[ -d "$DEST" ]]; then
  echo "==> Removing existing $DEST"
  rm -rf "$DEST"
fi

echo "==> Installing to $DEST"
cp -R "$APP_PATH" "$DEST"

echo "==> Clearing quarantine attribute (if any)"
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true

echo
echo "Done. Launch with: open -a $APP_NAME"
