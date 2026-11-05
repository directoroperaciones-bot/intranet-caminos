-- =====================================================================
-- Intranet Caminos · 015 · Horario fijo que rota por semanas
-- Una persona puede tener un horario fijo de varias semanas (A, B, …) que
-- se repite en ciclo: semana A, semana B, semana A… El ciclo cuenta desde
-- el lunes «desde», que es una semana A. Sin rotación, todo es semana A.
-- =====================================================================

-- El horario fijo guarda la semana del ciclo (1 = A, 2 = B, …)
alter table horario_base add column semana smallint not null default 1 check (semana between 1 and 4);
alter table horario_base drop constraint horario_base_pkey;
alter table horario_base add primary key (persona_id, semana, dia);

create table horario_rotacion (
  persona_id uuid primary key references perfiles (id) on delete cascade,
  semanas smallint not null check (semanas between 2 and 4),
  desde date not null check (extract(isodow from desde) = 1),   -- lunes de una semana A
  actualizado timestamptz not null default now(),
  actualizado_por uuid default auth.uid()
);

alter table horario_rotacion enable row level security;
create policy horario_rotacion_leer on horario_rotacion for select to authenticated using (true);
create policy horario_rotacion_editar on horario_rotacion for all to authenticated
  using (lidera_sede(sede_de(persona_id)) or es_supervisor())
  with check (lidera_sede(sede_de(persona_id)) or es_supervisor());
revoke all on horario_rotacion from anon;
grant select, insert, update, delete on horario_rotacion to authenticated;
grant all on horario_rotacion to service_role;

-- Semana del ciclo que le toca a una persona en una fecha
create function semana_ciclo(p_persona uuid, p_fecha date) returns smallint
language sql stable set search_path = public as $$
  select coalesce(
    (select (((floor((p_fecha - r.desde) / 7.0)::int % r.semanas) + r.semanas) % r.semanas + 1)::smallint
     from horario_rotacion r where r.persona_id = p_persona),
    1::smallint)
$$;
revoke all on function semana_ciclo(uuid, date) from public, anon;
grant execute on function semana_ciclo(uuid, date) to authenticated, service_role;

-- Malla efectiva: igual que antes, pero el horario fijo se toma de la semana del ciclo
create or replace function malla_efectiva(p_desde date, p_hasta date)
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
    left join horario_base hb on hb.persona_id = p.id
                             and hb.dia = extract(isodow from d.fecha)
                             and hb.semana = semana_ciclo(p.id, d.fecha)
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
