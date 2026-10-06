#!/usr/bin/env bash
# Corre las pruebas de permisos en un Postgres local (base nueva cada vez).
#   PGHOST=… PGPORT=… PGUSER=postgres bash supabase/pruebas/correr.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
BASE="${BASE:-prueba_intranet}"
dropdb --if-exists "$BASE" >/dev/null
createdb "$BASE"
correr() { psql -q -X -v ON_ERROR_STOP=1 -d "$BASE" -f "$1" 2>&1 \
  | sed -n 's/^.*NOTICE:  //p; /^--- /p; /^===/p; /ERROR/p'; }
correr supabase/pruebas/00_simular_supabase.sql
for f in supabase/migrations/*.sql; do correr "$f"; done
correr supabase/pruebas/01_permisos.sql
correr supabase/pruebas/02_aprobaciones.sql
