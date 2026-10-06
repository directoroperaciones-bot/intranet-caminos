#!/usr/bin/env bash
# Regenera supabase/instalar_todo.sql a partir de las migraciones.
set -euo pipefail
cd "$(dirname "$0")"
{
  echo "-- ====================================================================="
  echo "-- Intranet Caminos · instalar_todo.sql"
  echo "-- Las 7 migraciones en orden, en un solo archivo, para pegar en el SQL Editor"
  echo "-- de Supabase. Se regenera con: bash supabase/unir.sh"
  echo "-- ====================================================================="
  for f in migrations/*.sql; do echo; echo "-- >>> $(basename "$f")"; cat "$f"; done
} > instalar_todo.sql
echo "instalar_todo.sql: $(wc -l < instalar_todo.sql) líneas"
