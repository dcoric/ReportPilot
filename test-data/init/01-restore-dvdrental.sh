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

echo "Shifting temporal test data so latest rental is yesterday..."

psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_anchor_ts timestamp without time zone;
  v_target_ts timestamp without time zone;
  v_target_tstz timestamp with time zone;
  v_target_date date;
  v_shift_interval interval;
  v_shift_days integer;
  v_rowcount bigint;
  v_updated_cells bigint := 0;
  v_col record;
BEGIN
  -- Anchor on the most recent rental and shift everything by the same offset
  -- to keep relative spacing between rows while making rentals feel fresh.
  SELECT MAX(rental_date) INTO v_anchor_ts FROM public.rental;

  IF v_anchor_ts IS NULL THEN
    RAISE NOTICE 'Skipping temporal shift: no rental rows found.';
    RETURN;
  END IF;

  v_target_tstz := CURRENT_TIMESTAMP - INTERVAL '1 day';
  v_target_ts := v_target_tstz::timestamp;
  v_target_date := (CURRENT_DATE - INTERVAL '1 day')::date;

  v_shift_interval := v_target_ts - v_anchor_ts;
  v_shift_days := v_target_date - v_anchor_ts::date;

  RAISE NOTICE 'Applying temporal shift from rental max=% to target=%. Interval=% (days=%).', v_anchor_ts, v_target_ts, v_shift_interval, v_shift_days;

  FOR v_col IN
    SELECT c.table_schema, c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('date', 'timestamp without time zone', 'timestamp with time zone')
    ORDER BY c.table_name, c.ordinal_position
  LOOP
    IF v_col.data_type = 'date' THEN
      EXECUTE format(
        'UPDATE %I.%I
         SET %I = %I + %s
         WHERE %I IS NOT NULL',
        v_col.table_schema, v_col.table_name, v_col.column_name, v_col.column_name, v_shift_days, v_col.column_name
      );
    ELSIF v_col.data_type = 'timestamp without time zone' THEN
      EXECUTE format(
        'UPDATE %I.%I
         SET %I = %I + %L::interval
         WHERE %I IS NOT NULL',
        v_col.table_schema, v_col.table_name, v_col.column_name, v_col.column_name, v_shift_interval, v_col.column_name
      );
    ELSE
      EXECUTE format(
        'UPDATE %I.%I
         SET %I = %I + %L::interval
         WHERE %I IS NOT NULL',
        v_col.table_schema, v_col.table_name, v_col.column_name, v_col.column_name, v_shift_interval, v_col.column_name
      );
    END IF;

    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    v_updated_cells := v_updated_cells + v_rowcount;
  END LOOP;

  RAISE NOTICE 'Temporal shift completed. Updated % values.', v_updated_cells;
END $$;
SQL
