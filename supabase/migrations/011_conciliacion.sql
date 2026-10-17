-- =====================================================================
-- Intranet Caminos · 011 · Conciliación de la tarjeta de crédito
-- Solo la gerencia. Dos lados que se cruzan:
--   · tc_movimientos: lo que dice el extracto del banco (un periodo de corte).
--   · tc_registros:   lo que la agencia registró que pagó con la tarjeta.
-- Cada movimiento se concilia (con categoría y, si se puede, soporte), se
-- marca como no reconocido (reclamo al banco) o como gasto personal. El
-- periodo se cierra cuando no quedan pendientes; cerrado, nada se edita.
-- De la tarjeta solo se guardan los últimos 4 dígitos.
-- =====================================================================

create type tc_estado_t as enum ('pendiente', 'conciliado', 'no_reconocido', 'personal');
create type tc_tipo_t as enum ('compra', 'pago', 'interes', 'cuota_manejo', 'comision', 'avance', 'ajuste');

create table tc_tarjetas (
  id smallint generated always as identity primary key,
  nombre text not null check (length(btrim(nombre)) between 1 and 60),
  banco text not null default '' check (length(banco) <= 60),
  franquicia text not null default '' check (length(franquicia) <= 30),
  ultimos4 text not null check (ultimos4 ~ '^[0-9]{4}$'),
  titular text not null default '' check (length(titular) <= 80),
  cupo numeric(14, 2) check (cupo >= 0),
  activa boolean not null default true,
  creado timestamptz not null default now()
);

create table tc_categorias (
  id smallint generated always as identity primary key,
  nombre text not null unique check (length(btrim(nombre)) between 1 and 60),
  orden smallint not null default 0,
  activa boolean not null default true
);

create table tc_extractos (
  id bigint generated always as identity primary key,
  tarjeta_id smallint not null references tc_tarjetas (id) on delete cascade,
  desde date not null,
  hasta date not null,                         -- fecha de corte
  fecha_pago date,                             -- fecha límite de pago
  saldo_anterior numeric(14, 2) not null default 0,
  saldo_nuevo numeric(14, 2),                  -- total a pagar según el extracto
  pago_minimo numeric(14, 2),
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  cerrado_por uuid references perfiles (id) on delete set null,
  cerrado_en timestamptz,
  notas text not null default '' check (length(notas) <= 2000),
  creado timestamptz not null default now(),
  creado_por uuid references perfiles (id) on delete set null default auth.uid(),
  check (hasta >= desde),
  check (fecha_pago is null or fecha_pago >= hasta),
  unique (tarjeta_id, hasta)
);

create table tc_registros (
  id bigint generated always as identity primary key,
  tarjeta_id smallint not null references tc_tarjetas (id) on delete cascade,
  fecha date not null,
  descripcion text not null check (length(btrim(descripcion)) between 1 and 200),
  valor numeric(14, 2) not null check (valor <> 0),
  categoria_id smallint references tc_categorias (id) on delete set null,
  grupo_id bigint references grupos (id) on delete set null,
  responsable_id uuid references perfiles (id) on delete set null,
  soporte_ruta text,
  soporte_nombre text check (length(soporte_nombre) <= 200),
  creado timestamptz not null default now(),
  creado_por uuid references perfiles (id) on delete set null default auth.uid()
);
create index tc_registros_fecha on tc_registros (tarjeta_id, fecha);

create table tc_movimientos (
  id bigint generated always as identity primary key,
  extracto_id bigint not null references tc_extractos (id) on delete cascade,
  fecha date not null,
  descripcion text not null check (length(btrim(descripcion)) between 1 and 200),
  valor numeric(14, 2) not null check (valor <> 0),   -- positivo: cargo; negativo: pago o abono
  tipo tc_tipo_t not null default 'compra',
  moneda text not null default 'COP' check (moneda ~ '^[A-Z]{3}$'),
  valor_origen numeric(14, 2),
  cuotas smallint check (cuotas between 1 and 72),
  autorizacion text check (length(autorizacion) <= 20),
  categoria_id smallint references tc_categorias (id) on delete set null,
  grupo_id bigint references grupos (id) on delete set null,
  responsable_id uuid references perfiles (id) on delete set null,
  estado tc_estado_t not null default 'pendiente',
  registro_id bigint unique references tc_registros (id) on delete set null,
  soporte_ruta text,
  soporte_nombre text check (length(soporte_nombre) <= 200),
  nota text not null default '' check (length(nota) <= 500),
  conciliado_por uuid references perfiles (id) on delete set null,
  conciliado_en timestamptz,
  creado timestamptz not null default now()
);
create index tc_movimientos_extracto on tc_movimientos (extracto_id);

-- ---------- Reglas que no dependen de la pantalla ----------
create function tc_extracto_abierto(p bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tc_extractos where id = p and estado = 'abierto')
$$;
create function tc_extracto_cerrado(p bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tc_extractos where id = p and estado = 'cerrado')
$$;

-- Movimientos: el periodo debe estar abierto; el registro cruzado, de la misma
-- tarjeta; quién y cuándo concilió queda solo. En un periodo cerrado solo se
-- acepta que se vacíen las referencias cuando se borra el grupo, la categoría,
-- la persona o el registro al que apuntaban.
create function tc_movimiento_reglas() returns trigger
language plpgsql set search_path = public as $$
declare
  v_tarjeta smallint;
  v tc_movimientos;
begin
  if tg_op in ('UPDATE', 'DELETE') and tc_extracto_cerrado(old.extracto_id) then
    if tg_op = 'UPDATE' then
      v := new;
      v.grupo_id := old.grupo_id;
      v.categoria_id := old.categoria_id;
      v.responsable_id := old.responsable_id;
      v.registro_id := old.registro_id;
      if v is not distinct from old
         and (new.grupo_id is null or new.grupo_id = old.grupo_id)
         and (new.categoria_id is null or new.categoria_id = old.categoria_id)
         and (new.responsable_id is null or new.responsable_id = old.responsable_id)
         and (new.registro_id is null or new.registro_id = old.registro_id) then
        return new;
      end if;
    end if;
    raise exception 'Esta conciliación está cerrada. Reábrela para hacer cambios.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if not tc_extracto_abierto(new.extracto_id) then
    raise exception 'Esta conciliación está cerrada. Reábrela para hacer cambios.';
  end if;
  if new.registro_id is not null then
    select tarjeta_id into v_tarjeta from tc_extractos where id = new.extracto_id;
    if not exists (select 1 from tc_registros where id = new.registro_id and tarjeta_id = v_tarjeta) then
      raise exception 'El registro es de otra tarjeta.';
    end if;
  end if;
  if new.estado = 'pendiente' then
    new.conciliado_por := null;
    new.conciliado_en := null;
  elsif tg_op = 'INSERT' or old.estado is distinct from new.estado then
    new.conciliado_por := auth.uid();
    new.conciliado_en := now();
  end if;
  return new;
end
$$;

create trigger tc_movimientos_reglas
before insert or update or delete on tc_movimientos
for each row execute function tc_movimiento_reglas();

-- Un extracto cerrado no cambia, salvo para reabrirlo (con reabrir_extracto)
create function tc_extracto_reglas() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.estado = 'cerrado' then
      raise exception 'Esta conciliación está cerrada. Reábrela para borrarla.';
    end if;
    return old;
  end if;
  if old.estado = 'cerrado' and new.estado = 'cerrado' then
    raise exception 'Esta conciliación está cerrada. Reábrela para hacer cambios.';
  end if;
  if old.estado is distinct from new.estado and coalesce(current_setting('caminos.tc_estado', true), '') <> 'si' then
    raise exception 'Usa «Cerrar conciliación» o «Reabrir» para cambiar el estado.';
  end if;
  return new;
end
$$;

create trigger tc_extractos_reglas
before update or delete on tc_extractos
for each row execute function tc_extracto_reglas();

create function cerrar_extracto(p_id bigint) returns tc_extractos
language plpgsql volatile security definer set search_path = public as $$
declare
  v tc_extractos;
  n int;
begin
  if not es_gerencia() then
    raise exception 'Solo la gerencia cierra conciliaciones.';
  end if;
  select count(*) into n from tc_movimientos where extracto_id = p_id and estado = 'pendiente';
  if n > 0 then
    raise exception 'Quedan % movimientos por conciliar.', n;
  end if;
  perform set_config('caminos.tc_estado', 'si', true);
  update tc_extractos set estado = 'cerrado', cerrado_por = auth.uid(), cerrado_en = now()
  where id = p_id and estado = 'abierto' returning * into v;
  perform set_config('caminos.tc_estado', '', true);
  if not found then
    raise exception 'La conciliación no existe o ya está cerrada.';
  end if;
  return v;
end
$$;

create function reabrir_extracto(p_id bigint) returns tc_extractos
language plpgsql volatile security definer set search_path = public as $$
declare
  v tc_extractos;
begin
  if not es_gerencia() then
    raise exception 'Solo la gerencia reabre conciliaciones.';
  end if;
  perform set_config('caminos.tc_estado', 'si', true);
  update tc_extractos set estado = 'abierto', cerrado_por = null, cerrado_en = null
  where id = p_id and estado = 'cerrado' returning * into v;
  perform set_config('caminos.tc_estado', '', true);
  if not found then
    raise exception 'La conciliación no existe o no está cerrada.';
  end if;
  return v;
end
$$;

-- ---------- Permisos: solo la gerencia ----------
alter table tc_tarjetas enable row level security;
alter table tc_categorias enable row level security;
alter table tc_extractos enable row level security;
alter table tc_registros enable row level security;
alter table tc_movimientos enable row level security;

create policy tc_tarjetas_gerencia on tc_tarjetas for all to authenticated using (es_gerencia()) with check (es_gerencia());
create policy tc_categorias_gerencia on tc_categorias for all to authenticated using (es_gerencia()) with check (es_gerencia());
create policy tc_extractos_gerencia on tc_extractos for all to authenticated using (es_gerencia()) with check (es_gerencia());
create policy tc_registros_gerencia on tc_registros for all to authenticated using (es_gerencia()) with check (es_gerencia());
create policy tc_movimientos_gerencia on tc_movimientos for all to authenticated using (es_gerencia()) with check (es_gerencia());

revoke all on tc_tarjetas, tc_categorias, tc_extractos, tc_registros, tc_movimientos from anon;
grant select, insert, update, delete on tc_tarjetas, tc_categorias, tc_extractos, tc_registros, tc_movimientos to authenticated;
grant all on tc_tarjetas, tc_categorias, tc_extractos, tc_registros, tc_movimientos to service_role;

revoke all on function tc_extracto_abierto(bigint) from public, anon;
revoke all on function tc_extracto_cerrado(bigint) from public, anon;
revoke all on function tc_movimiento_reglas() from public, anon;
revoke all on function tc_extracto_reglas() from public, anon;
revoke all on function cerrar_extracto(bigint) from public, anon;
revoke all on function reabrir_extracto(bigint) from public, anon;
grant execute on function tc_extracto_abierto(bigint), tc_extracto_cerrado(bigint) to authenticated, service_role;
grant execute on function cerrar_extracto(bigint), reabrir_extracto(bigint) to authenticated;

-- ---------- Soportes (facturas) en un depósito privado ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('conciliacion', 'conciliacion', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create policy conciliacion_ver on storage.objects for select to authenticated
  using (bucket_id = 'conciliacion' and public.es_gerencia());
create policy conciliacion_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'conciliacion' and public.es_gerencia());
create policy conciliacion_quitar on storage.objects for delete to authenticated
  using (bucket_id = 'conciliacion' and public.es_gerencia());

-- ---------- Tiempo real: la pantalla se actualiza sola ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table tc_extractos, tc_movimientos, tc_registros;
  end if;
end
$$;

-- ---------- Categorías iniciales (se cambian en la tabla) ----------
insert into tc_categorias (nombre, orden) values
  ('Tiquetes aéreos', 1),
  ('Hoteles y alojamiento', 2),
  ('Operadores y proveedores turísticos', 3),
  ('Transporte terrestre', 4),
  ('Publicidad y marketing', 5),
  ('Software y suscripciones', 6),
  ('Oficina y servicios', 7),
  ('Atención a clientes', 8),
  ('Gastos bancarios', 9),
  ('Impuestos', 10),
  ('Otros', 11)
on conflict (nombre) do nothing;
