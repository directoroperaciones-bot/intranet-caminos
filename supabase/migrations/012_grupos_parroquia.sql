-- =====================================================================
-- Intranet Caminos · 012 · Parroquia de cada grupo
-- La parroquia (o comunidad) a la que pertenece el grupo. Se ve en el
-- tablero, en la línea de tiempo y en el evento de Google Calendar.
-- =====================================================================

alter table grupos add column parroquia text not null default '' check (length(parroquia) <= 120);

-- Google Calendar recibe también la parroquia (se cambia el tipo que devuelve)
drop function grupos_calendario(text);
create function grupos_calendario(p_clave text) returns table (
  id bigint, nombre text, destino text, parroquia text, salida date, regreso date, pasajeros int,
  responsable text, alcance text, estado grupo_estado_t, actualizado timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if p_clave is null or not exists (
    select 1 from calendario_clave c where c.huella = encode(digest(p_clave, 'sha256'), 'hex')) then
    raise exception 'Clave del calendario no válida.' using errcode = '28000';
  end if;
  return query
    select g.id, g.nombre, g.destino, g.parroquia, g.salida, g.regreso, g.pasajeros, p.nombre, g.alcance, g.estado, g.actualizado
    from grupos g left join perfiles p on p.id = g.responsable_id
    where g.salida is not null
    order by g.salida, g.id;
end $$;

revoke all on function grupos_calendario(text) from public, anon;
grant execute on function grupos_calendario(text) to anon, authenticated;
