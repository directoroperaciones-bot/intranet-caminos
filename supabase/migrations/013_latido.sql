-- =====================================================================
-- Intranet Caminos · 013 · Latido
-- El plan gratis de Supabase pausa el proyecto tras 7 días sin uso, y la
-- intranet deja de responder («No hay conexión con el servidor»). Una
-- tarea de GitHub (.github/workflows/mantener-activa.yml) llama a latido()
-- una vez al día para que eso no pase. No lee ni devuelve datos.
-- =====================================================================

create function latido() returns timestamptz
language sql stable set search_path = public as $$
  select now()
$$;

revoke all on function latido() from public;
grant execute on function latido() to anon, authenticated;
