#!/bin/bash
# Sauvegarde Mon Armoire : base PostgreSQL (tous les jours) et photos (le dimanche).
# À lancer par cron cPanel (voir DEPLOIEMENT_LWS.md). Les copies de plus de 14 jours sont supprimées.
#
# Prérequis (une seule fois) : fichier ~/.pgpass (chmod 600) contenant la ligne
#   localhost:5432:NOM_BASE:UTILISATEUR_BASE:MOT_DE_PASSE
# afin que le mot de passe n'apparaisse jamais dans la liste des processus ni dans le cron.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/mon_armoire/backend}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/monarmoire}"
KEEP_DAYS="${KEEP_DAYS:-14}"
ENV_FILE="$APP_DIR/.env"

# Lecture des seuls réglages utiles du .env (jamais de « source » : le fichier contient des secrets arbitraires)
read_env() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" ; }
DB_NAME="$(read_env DB_NAME)"; DB_USER="$(read_env DB_USER)"
DB_HOST="$(read_env DB_HOST)"; DB_PORT="$(read_env DB_PORT)"
MEDIA_ROOT="$(read_env MEDIA_ROOT)"
DB_HOST="${DB_HOST:-localhost}"; DB_PORT="${DB_PORT:-5432}"

umask 077
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d)"

# 1) Base de données : écrite dans un fichier temporaire puis renommée, pour ne jamais garder une sauvegarde tronquée
TMP="$BACKUP_DIR/.db_$STAMP.tmp"
pg_dump --host "$DB_HOST" --port "$DB_PORT" --username "$DB_USER" --no-password --format=plain --no-owner "$DB_NAME" | gzip -9 > "$TMP"
if [ ! -s "$TMP" ] || ! gzip -t "$TMP"; then
  rm -f "$TMP"; echo "ECHEC : sauvegarde de la base invalide" >&2; exit 1
fi
mv "$TMP" "$BACKUP_DIR/db_$STAMP.sql.gz"
echo "Base sauvegardée : db_$STAMP.sql.gz ($(du -h "$BACKUP_DIR/db_$STAMP.sql.gz" | cut -f1))"

# 2) Photos : le dimanche uniquement (volumineux, peu changeantes)
if [ "$(date +%u)" = "7" ] && [ -n "$MEDIA_ROOT" ] && [ -d "$MEDIA_ROOT" ]; then
  tar -czf "$BACKUP_DIR/media_$STAMP.tar.gz" -C "$(dirname "$MEDIA_ROOT")" "$(basename "$MEDIA_ROOT")"
  echo "Photos sauvegardées : media_$STAMP.tar.gz"
fi

# 3) Rotation
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db_*.sql.gz' -o -name 'media_*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
