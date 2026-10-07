-- =====================================================================
-- Intranet Caminos · 008 · Regla de lectura de solicitudes sin autoconsulta
-- La regla anterior llamaba a puede_ver_solicitud(id), que vuelve a leer la
-- tabla. Al crear una solicitud y pedir la fila de vuelta (lo que hace la
-- página con .insert().select()), esa consulta no ve la fila recién creada y
-- Postgres rechaza la operación. Ahora la regla usa las columnas de la fila.
-- =====================================================================

-- ¿Quien consulta revisa este tipo de solicitud en esta sede?
create function revisa_solicitudes(t solicitud_tipo_t, s smallint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from revisores r join perfiles yo on yo.id = r.persona_id and yo.activo
                 where r.persona_id = auth.uid()
                   and t = any (r.tipos)
                   and (r.sede_id is null or r.sede_id = s))
$$;

revoke all on function revisa_solicitudes(solicitud_tipo_t, smallint) from public, anon;
grant execute on function revisa_solicitudes(solicitud_tipo_t, smallint) to authenticated, service_role;

drop policy solicitudes_leer on solicitudes;
create policy solicitudes_leer on solicitudes for select to authenticated
  using (persona_id = auth.uid() or es_gerencia() or revisa_solicitudes(tipo, sede_de(persona_id)));

-- puede_ver_solicitud (adjuntos y archivos) usa la misma lógica
create or replace function puede_ver_solicitud(s bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from solicitudes so
    where so.id = s
      and (so.persona_id = auth.uid() or es_gerencia() or revisa_solicitudes(so.tipo, sede_de(so.persona_id))))
$$;
