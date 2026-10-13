-- =====================================================================
-- Intranet Caminos · 009 · Grupos (tablero, línea de tiempo y calendario)
-- Cada grupo de viaje es una tarjeta que pasa por cinco columnas. Todo el
-- equipo activo puede crear, mover, cambiar y borrar grupos.
-- Google Calendar: un programa de Google (Apps Script, ver
-- calendario/LEEME.md) lee los grupos con grupos_calendario(clave). La
-- clave la crea la administración con nueva_clave_calendario(); en la base
-- solo queda su huella (sha256), nunca la clave.
-- =====================================================================

create type grupo_estado_t as enum ('cotizando', 'confirmado', 'documentacion', 'en_viaje', 'finalizado');

create table grupos (
  id bigserial primary key,
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  destino text not null default '' check (length(destino) <= 120),
  salida date,
  regreso date,
  pasajeros int check (pasajeros between 0 and 9999),
  responsable_id uuid references perfiles (id) on delete set null,
  alcance text not null default '' check (length(alcance) <= 4000),
  notas text not null default '' check (length(notas) <= 4000),
  estado grupo_estado_t not null default 'cotizando',
  creado_por uuid references perfiles (id) on delete set null default auth.uid(),
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  actualizado_por uuid references perfiles (id) on delete set null default auth.uid(),
  check (regreso is null or salida is null or regreso >= salida)
);
create index grupos_fechas on grupos (salida, regreso);

-- Quién y cuándo cambió por última vez (no se puede falsear desde la página)
create function grupos_sello() returns trigger
language plpgsql set search_path = public as $$
begin
  new.actualizado := now();
  new.actualizado_por := auth.uid();
  if tg_op = 'INSERT' then
    new.creado := now();
    new.creado_por := auth.uid();
  else
    new.creado := old.creado;
    new.creado_por := old.creado_por;
  end if;
  return new;
end $$;
create trigger grupos_sello before insert or update on grupos
  for each row execute function grupos_sello();

-- ¿Quien consulta tiene una cuenta activa?
create function es_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo)
$$;

alter table grupos enable row level security;
create policy grupos_leer on grupos for select to authenticated using (es_activo());
create policy grupos_crear on grupos for insert to authenticated with check (es_activo());
create policy grupos_cambiar on grupos for update to authenticated using (es_activo()) with check (es_activo());
create policy grupos_borrar on grupos for delete to authenticated using (es_activo());

-- ---------- Clave del calendario ----------
-- Sin reglas RLS: nadie la lee por la API; solo las dos funciones de abajo.
create table calendario_clave (
  id boolean primary key default true check (id),
  huella text not null,
  creada timestamptz not null default now(),
  creada_por uuid references perfiles (id) on delete set null
);
alter table calendario_clave enable row level security;

-- Crea (o cambia) la clave. Devuelve la clave una sola vez; la anterior deja de servir.
create function nueva_clave_calendario() returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare clave text;
begin
  if not es_admin() then
    raise exception 'Solo la administración puede crear la clave del calendario.';
  end if;
  clave := encode(gen_random_bytes(24), 'hex');
  insert into calendario_clave (id, huella, creada, creada_por)
  values (true, encode(digest(clave, 'sha256'), 'hex'), now(), auth.uid())
  on conflict (id) do update set huella = excluded.huella, creada = excluded.creada, creada_por = excluded.creada_por;
  return clave;
end $$;

-- Lo que ve Google Calendar: solo grupos con fechas, sin notas internas.
create function grupos_calendario(p_clave text) returns table (
  id bigint, nombre text, destino text, salida date, regreso date, pasajeros int,
  responsable text, alcance text, estado grupo_estado_t, actualizado timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if p_clave is null or not exists (
    select 1 from calendario_clave c where c.huella = encode(digest(p_clave, 'sha256'), 'hex')) then
    raise exception 'Clave del calendario no válida.' using errcode = '28000';
  end if;
  return query
    select g.id, g.nombre, g.destino, g.salida, g.regreso, g.pasajeros, p.nombre, g.alcance, g.estado, g.actualizado
    from grupos g left join perfiles p on p.id = g.responsable_id
    where g.salida is not null
    order by g.salida, g.id;
end $$;

-- ---------- Permisos ----------
revoke all on grupos, calendario_clave from anon;
revoke all on calendario_clave from authenticated;
revoke all on sequence grupos_id_seq from anon;
grant select, insert, update, delete on grupos to authenticated;
grant usage, select on sequence grupos_id_seq to authenticated;
revoke all on function grupos_sello(), es_activo(), nueva_clave_calendario(), grupos_calendario(text) from public, anon;
grant execute on function es_activo(), nueva_clave_calendario() to authenticated;
-- La única puerta para visitantes sin sesión: pide la clave y solo entrega los grupos.
grant execute on function grupos_calendario(text) to anon, authenticated;
