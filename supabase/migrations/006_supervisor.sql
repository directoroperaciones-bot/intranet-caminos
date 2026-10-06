-- =====================================================================
-- Intranet Caminos · 006 · Rol Supervisor
-- Fusiona las migraciones 006 a 010 del proyecto original: delegar la
-- creación de cuentas de colaboradores y la edición de malla y turnos de
-- todas las sedes, sin dar poderes de gerencia.
-- =====================================================================

create function es_supervisor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo and rol = 'supervisor')
$$;

create function puede_gestionar_cuentas() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles
                 where id = auth.uid() and activo and (es_admin or rol = 'supervisor'))
$$;

revoke all on function es_supervisor() from public, anon;
revoke all on function puede_gestionar_cuentas() from public, anon;
grant execute on function es_supervisor() to authenticated, service_role;
grant execute on function puede_gestionar_cuentas() to authenticated, service_role;

-- Supervisor: cambia filas ajenas de colaboradores sin administración,
-- y el resultado debe seguir siendo colaborador sin administración.
create policy perfiles_gestor on perfiles for update to authenticated
  using (puede_gestionar_cuentas() and id <> auth.uid() and rol = 'colaborador' and not es_admin)
  with check (puede_gestionar_cuentas() and id <> auth.uid() and rol = 'colaborador' and not es_admin);

-- Supervisor: malla y turnos de todas las sedes
create policy malla_supervisor on malla for all to authenticated
  using (es_supervisor()) with check (es_supervisor());
create policy turnos_supervisor on turnos for all to authenticated
  using (es_supervisor()) with check (es_supervisor());
