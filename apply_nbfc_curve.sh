#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path-to-json-config>"
  exit 1
fi

CONFIG_PATH="$1"
if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "Error: file '$CONFIG_PATH' not found" >&2
  exit 1
fi

BASENAME="$(basename "$CONFIG_PATH")"
PROFILE_NAME="${BASENAME%.json}"
TMP_FILE="$(mktemp "/tmp/${PROFILE_NAME}.XXXXXX.json")"
DEST_DIR="/usr/share/nbfc/configs"

cp "$CONFIG_PATH" "$TMP_FILE"

echo "Stopping NBFC service..."
sudo nbfc stop

echo "Deploying config to $DEST_DIR/$BASENAME"
sudo mv "$TMP_FILE" "$DEST_DIR/$BASENAME"
sudo chmod 644 "$DEST_DIR/$BASENAME"

echo "Applying profile '$PROFILE_NAME'..."
sudo nbfc config -a "$PROFILE_NAME"

echo "Done."
