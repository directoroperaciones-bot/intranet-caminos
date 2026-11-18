-- =====================================================================
-- Intranet Caminos · 019 · Extranet de clientes
-- Los clientes de AppSheet (aliados freelance y parroquias) entran a
-- /clientes/ con su correo y ven SOLO sus ventas: estado, destino, fechas,
-- viajeros, servicios, valor, pagos, saldo y su comisión. Nunca costos,
-- utilidad de Caminos ni proveedores.
--   · clientes_ext, ventas_cliente, cobros_cliente: copia de AppSheet que
--     trae la tarea diaria de Claude con aplicar_extranet().
--   · cuentas_cliente: qué usuario es de qué cliente. La crea la
--     administración (Edge Function crear-cliente).
-- Además: las tablas del equipo que se leían con «cualquier sesión» pasan
-- a «solo personal activo», para que una cuenta de cliente no las vea.
-- =====================================================================

-- ---------- El personal deja de compartir lectura con cualquier sesión ----------
drop policy sedes_leer on sedes;
create policy sedes_leer on sedes for select to authenticated using (es_activo());
drop policy areas_leer on areas;
create policy areas_leer on areas for select to authenticated using (es_activo());
drop policy configuracion_leer on configuracion;
create policy configuracion_leer on configuracion for select to authenticated using (es_activo());
drop policy perfiles_leer on perfiles;
create policy perfiles_leer on perfiles for select to authenticated using (es_activo() or id = auth.uid());
drop policy turnos_leer on turnos;
create policy turnos_leer on turnos for select to authenticated using (es_activo());
drop policy malla_leer on malla;
create policy malla_leer on malla for select to authenticated using (es_activo());
drop policy malla_historial_leer on malla_historial;
create policy malla_historial_leer on malla_historial for select to authenticated using (es_activo());
drop policy horario_base_leer on horario_base;
create policy horario_base_leer on horario_base for select to authenticated using (es_activo());
drop policy horario_rotacion_leer on horario_rotacion;
create policy horario_rotacion_leer on horario_rotacion for select to authenticated using (es_activo());

-- ---------- Clientes (copia de la hoja CLIENTES) ----------
create table clientes_ext (
  id text primary key check (length(id) between 1 and 60),
  nombre text not null default '' check (length(nombre) <= 160),
  contacto text not null default '' check (length(contacto) <= 160),
  correo text not null default '' check (length(correo) <= 200),
  tipo text not null default '' check (length(tipo) <= 60),
  pct_terrestre numeric(7, 4),          -- 0.10 = 10 %
  part_ta numeric(7, 4),                -- 0.50 = 50 %
  modalidad text not null default '' check (length(modalidad) <= 60)
);

-- Ventas de cada cliente (lo que él puede ver)
create table ventas_cliente (
  id text primary key check (length(id) between 1 and 60),
  cliente_id text not null,
  fecha date not null,
  estado text not null check (length(estado) between 1 and 40),
  tipo_venta text not null default '',
  tipo_viaje text not null default '',
  destino text not null default '',
  plan text not null default '',
  salida date,
  regreso date,
  pasajeros int not null default 0,
  viajeros jsonb not null default '[]' check (jsonb_typeof(viajeros) = 'array'),     -- solo nombres
  servicios jsonb not null default '[]' check (jsonb_typeof(servicios) = 'array'),   -- tipo y detalle, sin costos
  valor numeric(16, 2) not null default 0,
  cobrado numeric(16, 2) not null default 0,
  comision numeric(16, 2) not null default 0
);
create index ventas_cliente_cliente on ventas_cliente (cliente_id, fecha);

-- Cuentas de cobro de los aliados (hoja CUENTAS_COBRO_ALIADOS)
create table cobros_cliente (
  id text primary key check (length(id) between 1 and 60),
  cliente_id text not null,
  periodo text not null default '',
  desde date,
  hasta date,
  ventas int not null default 0,
  total numeric(16, 2) not null default 0,
  estado text not null default '',
  enviada date
);
create index cobros_cliente_cliente on cobros_cliente (cliente_id);

-- Usuario → cliente
create table cuentas_cliente (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  cliente_id text not null unique,
  correo text not null,
  activo boolean not null default true,
  debe_cambiar boolean not null default true,
  creado timestamptz not null default now(),
  creado_por uuid references perfiles (id) on delete set null,
  ultimo_ingreso timestamptz
);

-- El cliente de la sesión (null si no es una cuenta de cliente activa)
create function mi_cliente() returns text
language sql stable security definer set search_path = public as $$
  select cliente_id from cuentas_cliente where usuario_id = auth.uid() and activo
$$;

alter table clientes_ext enable row level security;
alter table ventas_cliente enable row level security;
alter table cobros_cliente enable row level security;
alter table cuentas_cliente enable row level security;
create policy clientes_ext_leer on clientes_ext for select to authenticated using (es_gerencia() or id = mi_cliente());
create policy ventas_cliente_leer on ventas_cliente for select to authenticated using (es_gerencia() or cliente_id = mi_cliente());
create policy cobros_cliente_leer on cobros_cliente for select to authenticated using (es_gerencia() or cliente_id = mi_cliente());
create policy cuentas_cliente_leer on cuentas_cliente for select to authenticated using (es_admin() or usuario_id = auth.uid());

-- Lo que ve el cliente al entrar: quién es (o null si la cuenta no es de cliente)
create function mi_cuenta_cliente() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare c cuentas_cliente; x clientes_ext;
begin
  select * into c from cuentas_cliente where usuario_id = auth.uid();
  if not found then return null; end if;
  if not c.activo then return jsonb_build_object('activo', false); end if;
  update cuentas_cliente set ultimo_ingreso = now() where usuario_id = auth.uid();
  select * into x from clientes_ext where id = c.cliente_id;
  return jsonb_build_object('activo', true, 'cliente_id', c.cliente_id, 'debe_cambiar', c.debe_cambiar,
    'nombre', coalesce(x.nombre, ''), 'contacto', coalesce(x.contacto, ''), 'tipo', coalesce(x.tipo, ''),
    'comision', x.pct_terrestre is not null or x.part_ta is not null,
    'pct_terrestre', x.pct_terrestre, 'part_ta', x.part_ta, 'modalidad', coalesce(x.modalidad, ''),
    'sincronizado', (select sincronizado from ventas_estado where id));
end $$;

-- El cliente ya cambió la contraseña temporal
create function clave_cliente_cambiada() returns void
language sql volatile security definer set search_path = public as $$
  update cuentas_cliente set debe_cambiar = false where usuario_id = auth.uid()
$$;

-- La administración desactiva o reactiva el acceso de un cliente
create function activar_cuenta_cliente(p_cliente text, p_activo boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo la administración maneja las cuentas de clientes.'; end if;
  update cuentas_cliente set activo = p_activo where cliente_id = p_cliente;
  if not found then raise exception 'Ese cliente aún no tiene cuenta.'; end if;
end $$;

-- Carga desde la tarea diaria (solo el servidor). Todo o nada.
create function aplicar_extranet(p_clientes jsonb, p_ventas jsonb, p_cobros jsonb) returns jsonb
language plpgsql volatile set search_path = public as $$
begin
  if jsonb_typeof(p_clientes) <> 'array' or jsonb_typeof(p_ventas) <> 'array' or jsonb_typeof(p_cobros) <> 'array' then
    raise exception 'Se esperaban listas.';
  end if;

  insert into clientes_ext as t select * from jsonb_populate_recordset(row(null, '', '', '', '', null, null, '')::clientes_ext, p_clientes)
  on conflict (id) do update set nombre = excluded.nombre, contacto = excluded.contacto, correo = excluded.correo,
    tipo = excluded.tipo, pct_terrestre = excluded.pct_terrestre, part_ta = excluded.part_ta, modalidad = excluded.modalidad
  where (t.*) is distinct from (excluded.*);
  delete from clientes_ext t where not exists (select 1 from jsonb_array_elements(p_clientes) e where e ->> 'id' = t.id);

  insert into ventas_cliente as t select * from jsonb_populate_recordset(row(null, null, null, null, '', '', '', '', null, null, 0, '[]', '[]', 0, 0, 0)::ventas_cliente, p_ventas)
  on conflict (id) do update set cliente_id = excluded.cliente_id, fecha = excluded.fecha, estado = excluded.estado,
    tipo_venta = excluded.tipo_venta, tipo_viaje = excluded.tipo_viaje, destino = excluded.destino, plan = excluded.plan,
    salida = excluded.salida, regreso = excluded.regreso, pasajeros = excluded.pasajeros, viajeros = excluded.viajeros,
    servicios = excluded.servicios, valor = excluded.valor, cobrado = excluded.cobrado, comision = excluded.comision
  where (t.*) is distinct from (excluded.*);
  delete from ventas_cliente t where not exists (select 1 from jsonb_array_elements(p_ventas) e where e ->> 'id' = t.id);

  insert into cobros_cliente as t select * from jsonb_populate_recordset(row(null, null, '', null, null, 0, 0, '', null)::cobros_cliente, p_cobros)
  on conflict (id) do update set cliente_id = excluded.cliente_id, periodo = excluded.periodo, desde = excluded.desde,
    hasta = excluded.hasta, ventas = excluded.ventas, total = excluded.total, estado = excluded.estado, enviada = excluded.enviada
  where (t.*) is distinct from (excluded.*);
  delete from cobros_cliente t where not exists (select 1 from jsonb_array_elements(p_cobros) e where e ->> 'id' = t.id);

  return jsonb_build_object('clientes', jsonb_array_length(p_clientes), 'ventas', jsonb_array_length(p_ventas), 'cobros', jsonb_array_length(p_cobros));
end $$;

-- ---------- Permisos ----------
revoke all on clientes_ext, ventas_cliente, cobros_cliente, cuentas_cliente from anon;
revoke insert, update, delete, truncate on clientes_ext, ventas_cliente, cobros_cliente, cuentas_cliente from authenticated;
grant select on clientes_ext, ventas_cliente, cobros_cliente, cuentas_cliente to authenticated;
grant all on clientes_ext, ventas_cliente, cobros_cliente, cuentas_cliente to service_role;
revoke all on function mi_cliente(), mi_cuenta_cliente(), clave_cliente_cambiada(), activar_cuenta_cliente(text, boolean),
  aplicar_extranet(jsonb, jsonb, jsonb) from public, anon;
grant execute on function mi_cliente(), mi_cuenta_cliente(), clave_cliente_cambiada(), activar_cuenta_cliente(text, boolean) to authenticated;
grant execute on function aplicar_extranet(jsonb, jsonb, jsonb) to service_role;
