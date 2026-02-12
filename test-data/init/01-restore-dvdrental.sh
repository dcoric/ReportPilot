#!/bin/sh
set -e

echo "Restoring dvdrental dump into database '$POSTGRES_DB'..."

# The postgres image creates the default "public" schema for POSTGRES_DB.
# This dump also contains CREATE SCHEMA public, so reset it first to avoid
# a spurious restore warning.
psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
SQL

pg_restore \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --verbose \
  --no-owner \
  --no-privileges \
  /docker-entrypoint-initdb.d/dvdrental.tar
