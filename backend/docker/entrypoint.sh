#!/bin/sh
set -e

mkdir -p /app/media/documents
chown -R appuser:appuser /app/media 2>/dev/null || true

exec gosu appuser "$@"
