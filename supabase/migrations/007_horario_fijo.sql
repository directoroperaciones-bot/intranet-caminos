-- =====================================================================
-- Intranet Caminos · 007 · Horario fijo y malla efectiva
-- Turnos (catálogo) + horario fijo semanal por persona + cambios puntuales
-- (tabla malla). Lo que se ve y se evalúa es la malla efectiva.
-- =====================================================================

create table horario_base (
  persona_id uuid not null references perfiles (id) on delete cascade,
  dia smallint not null check (dia between 1 and 7),   -- 1 = lunes … 7 = domingo
  turno_id int not null references turnos (id),
  actualizado timestamptz not null default now(),
  actualizado_por uuid,
  primary key (persona_id, dia)
);

create function tocar_horario_base() returns trigger
language plpgsql set search_path = public as $$
begin
  new.actualizado := now();
  new.actualizado_por := auth.uid();
  return new;
end
$$;

create trigger horario_base_tocar
before insert or update on horario_base
for each row execute function tocar_horario_base();

alter table horario_base enable row level security;
create policy horario_base_leer on horario_base for select to authenticated using (true);
create policy horario_base_editar on horario_base for all to authenticated
  using (lidera_sede(sede_de(persona_id)) or es_supervisor())
  with check (lidera_sede(sede_de(persona_id)) or es_supervisor());

revoke all on horario_base from anon;
grant select, insert, update, delete on horario_base to authenticated;
grant all on horario_base to service_role;

-- Desde cuándo el horario fijo genera malla (se ajusta al día de arranque)
insert into configuracion (clave, valor)
values ('inicio_horarios', jsonb_build_object('fecha', to_char(current_date, 'YYYY-MM-DD')))
on conflict (clave) do nothing;

-- Malla efectiva: el cambio puntual si existe; si no, el horario fijo.
-- security invoker: corre con los permisos de quien consulta.
create function malla_efectiva(p_desde date, p_hasta date)
returns table (persona_id uuid, fecha date, turno_id int, cambio boolean)
language sql stable security invoker set search_path = public as $$
  with dias as (
    select d::date as fecha
    from generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') d
    where d::date >= coalesce((config('inicio_horarios') ->> 'fecha')::date, 'infinity'::date)
  ),
  con_base as (select distinct hb.persona_id from horario_base hb),
  base as (
    select p.id as persona_id, d.fecha,
           coalesce(hb.turno_id,
                    (select t.id from turnos t
                     where t.sede_id = p.sede_id and t.codigo = 'D'
                     order by t.id limit 1)) as turno_id
    from perfiles p
    join con_base c on c.persona_id = p.id
    cross join dias d
    left join horario_base hb on hb.persona_id = p.id and hb.dia = extract(isodow from d.fecha)
    where p.activo
  )
  select m.persona_id, m.fecha, m.turno_id, true
  from malla m
  where m.fecha between p_desde and p_hasta
  union all
  select b.persona_id, b.fecha, b.turno_id, false
  from base b
  where b.turno_id is not null
    and not exists (select 1 from malla m where m.persona_id = b.persona_id and m.fecha = b.fecha)
$$;

revoke all on function malla_efectiva(date, date) from public, anon;
revoke all on function tocar_horario_base() from public, anon;
grant execute on function malla_efectiva(date, date) to authenticated, service_role;
