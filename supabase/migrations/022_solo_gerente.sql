-- =====================================================================
-- 022 · Solo el cargo de gerente ve todo
--
-- Antes, es_gerencia() y lidera_sede() también se cumplían con es_admin.
-- Ahora la gerencia es solo el rol «gerente»: Gestión, Tarjeta, Oficina,
-- informes y asistencia de todas las sedes. La marca de administración
-- (es_admin) sigue sirviendo solo para administrar cuentas, sedes y áreas.
-- =====================================================================

create or replace function es_gerencia() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles
                 where id = auth.uid() and activo and rol = 'gerente')
$$;

create or replace function lidera_sede(s smallint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles
                 where id = auth.uid() and activo
                   and (rol = 'gerente' or (rol = 'directora' and sede_id = s)))
$$;
