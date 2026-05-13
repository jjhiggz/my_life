#!/bin/bash
# Daily backup of higgzlife SQLite database
# Keeps last 35 days of backups, then auto-prunes older ones

set -e

DB="$HOME/.higgzlife/data.db"
BACKUP_DIR="$HOME/.higgzlife/backups"
DATE=$(date +%Y-%m-%d)
TARGET="$BACKUP_DIR/data-$DATE.db"

mkdir -p "$BACKUP_DIR"

# Use sqlite's .backup command (safe for concurrent reads/WAL mode)
sqlite3 "$DB" ".backup '$TARGET'"

# Prune backups older than 35 days
find "$BACKUP_DIR" -name "data-*.db" -mtime +35 -delete

echo "[$(date)] Backup created: $TARGET" >> "$BACKUP_DIR/backup.log"
