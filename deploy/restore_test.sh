#!/bin/bash
# Teste qu'une sauvegarde est RÉELLEMENT restaurable, sans toucher à la vraie base :
# restaure dans une base temporaire, compte les tables et les commandes, puis supprime la base temporaire.
# Usage : ./restore_test.sh ~/backups/monarmoire/db_2026-10-08.sql.gz
# Prérequis : l'utilisateur PostgreSQL peut créer une base (sinon créer « <login>_restoretest » dans cPanel > PostgreSQL).
set -euo pipefail

BACKUP="${1:?Indiquer le fichier de sauvegarde (.sql.gz)}"
APP_DIR="${APP_DIR:-$HOME/mon_armoire/backend}"
read_env() { grep -E "^$1=" "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" ; }
DB_USER="$(read_env DB_USER)"; DB_HOST="$(read_env DB_HOST)"; DB_PORT="$(read_env DB_PORT)"
DB_HOST="${DB_HOST:-localhost}"; DB_PORT="${DB_PORT:-5432}"
TEST_DB="${TEST_DB:-$(read_env DB_NAME)_restoretest}"

psql_run() { psql --host "$DB_HOST" --port "$DB_PORT" --username "$DB_USER" --no-password "$@"; }

gzip -t "$BACKUP"
psql_run --dbname postgres -c "DROP DATABASE IF EXISTS \"$TEST_DB\";" -c "CREATE DATABASE \"$TEST_DB\";"
gunzip -c "$BACKUP" | psql_run --dbname "$TEST_DB" --quiet -v ON_ERROR_STOP=1 > /dev/null
echo "Tables restaurées : $(psql_run --dbname "$TEST_DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
echo "Commandes restaurées : $(psql_run --dbname "$TEST_DB" -tAc 'SELECT count(*) FROM orders_order;')"
echo "Clients restaurés    : $(psql_run --dbname "$TEST_DB" -tAc 'SELECT count(*) FROM userauths_user;')"
psql_run --dbname postgres -c "DROP DATABASE \"$TEST_DB\";"
echo "Sauvegarde restaurable."
