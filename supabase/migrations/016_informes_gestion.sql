-- =====================================================================
-- Intranet Caminos · 016 · Informes de gestión (ventas)
-- Las ventas viven en el gestor de reservas de AppSheet (una hoja de
-- Google). Un Apps Script (informes/Codigo.gs) la LEE cada 10 minutos y
-- manda aquí una fila resumida por venta, sin datos personales: ni
-- clientes, ni pasajeros, ni teléfonos. La hoja nunca se modifica.
--
-- Solo la gerencia ve los informes. El script entra con una clave que la
-- administración crea en la intranet; en la base solo queda su huella.
-- =====================================================================

create table ventas_informe (
  id text primary key check (length(id) between 1 and 60),
  asesora text not null default '' check (length(asesora) <= 80),
  fecha date not null,                          -- fecha de registro de la venta
  estado text not null check (length(estado) between 1 and 40),
  tipo_venta text not null default '' check (length(tipo_venta) <= 60),
  tipo_viaje text not null default '' check (length(tipo_viaje) <= 40),
  destino text not null default '' check (length(destino) <= 120),
  plan text not null default '' check (length(plan) <= 160),     -- paquete o peregrinación
  salida date,
  regreso date,
  pasajeros int not null default 0 check (pasajeros between 0 and 10000),
  valor numeric(16, 2) not null default 0,      -- suma del gran total de sus servicios
  costo numeric(16, 2) not null default 0,      -- lo que se paga a proveedores
  cobrado numeric(16, 2) not null default 0,    -- abonos confirmados del cliente
  pagado_prov numeric(16, 2) not null default 0,
  seguimiento text not null default '' check (length(seguimiento) <= 120),
  servicios jsonb not null default '[]' check (jsonb_typeof(servicios) = 'array'),
  proveedores jsonb not null default '[]' check (jsonb_typeof(proveedores) = 'array')
);
create index ventas_informe_fecha on ventas_informe (fecha);

-- Estado de la sincronización (una sola fila): la pantalla la escucha en
-- tiempo real y se recarga cuando llega una sincronización nueva.
create table ventas_estado (
  id boolean primary key default true check (id),
  sincronizado timestamptz,
  filas int not null default 0,
  clave_creada timestamptz
);
insert into ventas_estado (id) values (true);

-- La huella de la clave del script: nadie la lee, solo las funciones.
create table ventas_clave (
  id boolean primary key default true check (id),
  huella text not null,
  creada timestamptz not null default now(),
  creada_por uuid references perfiles (id) on delete set null
);

alter table ventas_informe enable row level security;
alter table ventas_estado enable row level security;
alter table ventas_clave enable row level security;
create policy ventas_informe_leer on ventas_informe for select to authenticated using (es_gerencia());
create policy ventas_estado_leer on ventas_estado for select to authenticated using (es_gerencia());

-- Crea (o cambia) la clave del script. Se muestra una sola vez; la anterior deja de servir.
create function nueva_clave_ventas() returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare clave text;
begin
  if not es_admin() then
    raise exception 'Solo la administración puede crear la clave de los informes.';
  end if;
  clave := encode(gen_random_bytes(24), 'hex');
  insert into ventas_clave (id, huella, creada, creada_por)
  values (true, encode(digest(clave, 'sha256'), 'hex'), now(), auth.uid())
  on conflict (id) do update set huella = excluded.huella, creada = excluded.creada, creada_por = excluded.creada_por;
  update ventas_estado set clave_creada = now() where id;
  return clave;
end $$;

-- Lo que llama el script: reemplaza el resumen de ventas por el que manda.
-- Todo o nada: si una fila viene mal, no cambia nada.
create function sincronizar_ventas(p_clave text, p_filas jsonb) returns int
language plpgsql volatile security definer set search_path = public, extensions as $$
declare n int;
begin
  if p_clave is null or not exists (
    select 1 from ventas_clave c where c.huella = encode(digest(p_clave, 'sha256'), 'hex')) then
    raise exception 'Clave de los informes no válida.' using errcode = '28000';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'Se esperaba una lista de ventas.';
  end if;
  n := jsonb_array_length(p_filas);
  if n > 20000 then
    raise exception 'Demasiadas filas (%).', n;
  end if;

  insert into ventas_informe as v (id, asesora, fecha, estado, tipo_venta, tipo_viaje, destino, plan, salida, regreso,
                                   pasajeros, valor, costo, cobrado, pagado_prov, seguimiento, servicios, proveedores)
  select f.id, coalesce(f.asesora, ''), f.fecha, f.estado, coalesce(f.tipo_venta, ''), coalesce(f.tipo_viaje, ''),
         coalesce(f.destino, ''), coalesce(f.plan, ''), f.salida, f.regreso, coalesce(f.pasajeros, 0),
         coalesce(f.valor, 0), coalesce(f.costo, 0), coalesce(f.cobrado, 0), coalesce(f.pagado_prov, 0),
         coalesce(f.seguimiento, ''), coalesce(f.servicios, '[]'), coalesce(f.proveedores, '[]')
  from jsonb_to_recordset(p_filas) as f (id text, asesora text, fecha date, estado text, tipo_venta text, tipo_viaje text,
                                          destino text, plan text, salida date, regreso date, pasajeros int, valor numeric,
                                          costo numeric, cobrado numeric, pagado_prov numeric, seguimiento text,
                                          servicios jsonb, proveedores jsonb)
  on conflict (id) do update set
    asesora = excluded.asesora, fecha = excluded.fecha, estado = excluded.estado, tipo_venta = excluded.tipo_venta,
    tipo_viaje = excluded.tipo_viaje, destino = excluded.destino, plan = excluded.plan, salida = excluded.salida,
    regreso = excluded.regreso, pasajeros = excluded.pasajeros, valor = excluded.valor, costo = excluded.costo,
    cobrado = excluded.cobrado, pagado_prov = excluded.pagado_prov, seguimiento = excluded.seguimiento,
    servicios = excluded.servicios, proveedores = excluded.proveedores
  where (v.*) is distinct from (excluded.*);

  -- Lo que ya no está en la hoja, sale del informe
  delete from ventas_informe v
  where not exists (select 1 from jsonb_array_elements(p_filas) e where e ->> 'id' = v.id);

  update ventas_estado set sincronizado = now(), filas = n where id;
  return n;
end $$;

-- ---------- Permisos ----------
revoke all on ventas_informe, ventas_estado, ventas_clave from anon;
revoke all on ventas_clave from authenticated;
revoke insert, update, delete, truncate on ventas_informe, ventas_estado from authenticated;
grant select on ventas_informe, ventas_estado to authenticated;
grant all on ventas_informe, ventas_estado, ventas_clave to service_role;
revoke all on function nueva_clave_ventas(), sincronizar_ventas(text, jsonb) from public, anon;
grant execute on function nueva_clave_ventas() to authenticated;
-- La puerta del script (sin sesión): pide la clave y solo escribe el resumen de ventas.
grant execute on function sincronizar_ventas(text, jsonb) to anon, authenticated;

-- ---------- Tiempo real: la pantalla se recarga sola al sincronizar ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table ventas_estado;
  end if;
end
$$;
