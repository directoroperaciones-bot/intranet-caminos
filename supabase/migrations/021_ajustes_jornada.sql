-- =====================================================================
-- 021 · Entrada temprana autorizada y medición de la salida
--
-- Cuando alguien marca la entrada bastante antes de su turno (30 min por
-- defecto) porque le dieron permiso de entrar y salir más temprano, deja
-- registrado el motivo, la nueva hora de salida (o que no cambia) y quién
-- lo autorizó. El informe de asistencia mide la salida contra esa hora, así
-- que salir antes con permiso no cuenta como «salida antes».
--
-- Tolerancias nuevas en configuracion.tolerancias:
--   salida_min   minutos después de la salida a partir de los cuales se
--                cuenta tiempo adicional (5 por defecto, igual que la entrada)
--   temprano_min minutos antes del turno a partir de los cuales se pregunta
--                por la entrada temprana (30 por defecto)
-- =====================================================================

update configuracion
set valor = '{"salida_min": 5, "temprano_min": 30}'::jsonb || valor
where clave = 'tolerancias';

create table ajustes_jornada (
  persona_id uuid not null references perfiles (id) on delete cascade,
  fecha date not null,                    -- fecha local de la sede
  motivo text not null check (char_length(btrim(motivo)) between 3 and 300),
  salida time,                            -- nueva hora de salida; null = la del turno
  autorizo uuid not null references perfiles (id),
  creado timestamptz not null default now(),
  primary key (persona_id, fecha)
);
create index ajustes_jornada_fecha_idx on ajustes_jornada (fecha);

alter table ajustes_jornada enable row level security;
-- La persona, quien autorizó y la líder de la sede lo ven; la líder lo puede quitar
create policy ajustes_leer on ajustes_jornada for select to authenticated
  using (persona_id = auth.uid() or autorizo = auth.uid() or lidera_sede(sede_de(persona_id)));
create policy ajustes_quitar on ajustes_jornada for delete to authenticated
  using (lidera_sede(sede_de(persona_id)));

revoke all on ajustes_jornada from anon;
revoke insert, update, truncate on ajustes_jornada from authenticated;
grant select, delete on ajustes_jornada to authenticated;
grant all on ajustes_jornada to service_role;

-- Registra (o corrige, mientras no haya marcado la salida) el ajuste de hoy.
create function ajustar_jornada(p_motivo text, p_salida time, p_autorizo uuid) returns ajustes_jornada
language plpgsql security definer set search_path = public as $$
declare
  v_p perfiles;
  v_tz text;
  v_hoy date;
  v_t turnos;
  v_ent timestamptz;
  v_ent_min int;
  v_temprano int := coalesce((config('tolerancias') ->> 'temprano_min')::int, 30);
  v_fila ajustes_jornada;
begin
  select * into v_p from perfiles where id = auth.uid() and activo;
  if not found then raise exception 'Tu cuenta no está activa.'; end if;
  select zona_horaria into v_tz from sedes where id = v_p.sede_id;
  v_hoy := (now() at time zone v_tz)::date;

  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Escribe el motivo.';
  end if;
  if p_autorizo is null or p_autorizo = v_p.id or not exists (
       select 1 from perfiles
       where id = p_autorizo and activo
         and (rol in ('gerente', 'directora', 'supervisor') or es_admin)) then
    raise exception 'Elige quién lo autorizó (gerencia, dirección o supervisión).';
  end if;

  select t.* into v_t
  from malla_efectiva(v_hoy, v_hoy) me join turnos t on t.id = me.turno_id
  where me.persona_id = v_p.id;
  if v_t.id is null or v_t.entrada is null then
    raise exception 'Hoy no tienes un turno con horario.';
  end if;

  select hora into v_ent from marcas where persona_id = v_p.id and fecha = v_hoy and tipo = 'entrada';
  if v_ent is null then raise exception 'Primero marca la entrada.'; end if;
  if exists (select 1 from marcas where persona_id = v_p.id and fecha = v_hoy and tipo = 'salida') then
    raise exception 'Ya marcaste la salida; el ajuste ya no se puede cambiar.';
  end if;

  v_ent_min := extract(hour from (v_ent at time zone v_tz))::int * 60 + extract(minute from (v_ent at time zone v_tz))::int;
  if v_ent_min > extract(hour from v_t.entrada)::int * 60 + extract(minute from v_t.entrada)::int - v_temprano then
    raise exception 'Solo aplica si entraste al menos % minutos antes de tu turno.', v_temprano;
  end if;
  if p_salida is not null and (extract(hour from p_salida)::int * 60 + extract(minute from p_salida)::int) <= v_ent_min then
    raise exception 'La nueva hora de salida debe ser después de tu entrada.';
  end if;

  insert into ajustes_jornada (persona_id, fecha, motivo, salida, autorizo)
  values (v_p.id, v_hoy, btrim(p_motivo), p_salida, p_autorizo)
  on conflict (persona_id, fecha) do update
    set motivo = excluded.motivo, salida = excluded.salida, autorizo = excluded.autorizo, creado = now()
  returning * into v_fila;
  return v_fila;
end $$;

revoke all on function ajustar_jornada(text, time, uuid) from public, anon;
grant execute on function ajustar_jornada(text, time, uuid) to authenticated;
