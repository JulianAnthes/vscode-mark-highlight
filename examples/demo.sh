#!/usr/bin/env bash
set -euo pipefail

# MARK: - Configuration

readonly BACKUP_DIR="/var/backups"
readonly KEEP_DAYS=14

# MARK: - Helpers

log() {
    echo "[$(date +%H:%M:%S)] $*"
}

# MARK: Cleanup (dashless mark)

remove_old_backups() {
    find "$BACKUP_DIR" -name '*.tar.gz' -mtime "+$KEEP_DAYS" -delete
}

# MARK: -

log "starting backup"
remove_old_backups
