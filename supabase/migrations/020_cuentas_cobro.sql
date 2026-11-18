-- =====================================================================
-- Intranet Caminos · 020 · Cuentas de cobro de los aliados
-- El aliado (acreedor) le cobra a Caminos (deudor) la comisión de varias
-- ventas en una sola cuenta de cobro (plantilla CUENTA_COBRO_ALIADO de
-- AppSheet). La genera la gerencia en la intranet o el aliado en su portal.
-- Reglas (las de la plantilla):
--   · solo ventas del aliado, facturadas, con número de factura, con
--     comisión en modalidad «Retorno» y facturadas dentro del periodo;
--   · cada venta se cobra una sola vez (anular la cuenta la libera).
-- El documento guarda una foto de los datos del aliado y de las ventas al
-- generarse, para que no cambie después.
-- =====================================================================

-- Datos que la plantilla necesita (los trae la tarea diaria desde AppSheet)
alter table clientes_ext
  add column nit text not null default '' check (length(nit) <= 40),
  add column direccion text not null default '' check (length(direccion) <= 200),
  add column ciudad text not null default '' check (length(ciudad) <= 80),
  add column telefono text not null default '' check (length(telefono) <= 60),
  add column banco text not null default '' check (length(banco) <= 80),
  add column tipo_cuenta text not null default '' check (length(tipo_cuenta) <= 40),
  add column numero_cuenta text not null default '' check (length(numero_cuenta) <= 40),
  add column titular_cuenta text not null default '' check (length(titular_cuenta) <= 160),
  add column documento_titular text not null default '' check (length(documento_titular) <= 40);
alter table ventas_cliente
  add column codigo text not null default '' check (length(codigo) <= 40),          -- Codigo_Visual_VYE
  add column factura text not null default '' check (length(factura) <= 60),        -- Numero_Factura
  add column fecha_factura date,
  add column modalidad text not null default '' check (length(modalidad) <= 60);    -- Retorno / Descuento

-- La carga de la tarea diaria, con las columnas nuevas
create or replace function aplicar_extranet(p_clientes jsonb, p_ventas jsonb, p_cobros jsonb) returns jsonb
language plpgsql volatile set search_path = public as $$
begin
  if jsonb_typeof(p_clientes) <> 'array' or jsonb_typeof(p_ventas) <> 'array' or jsonb_typeof(p_cobros) <> 'array' then
    raise exception 'Se esperaban listas.';
  end if;

  insert into clientes_ext as t
  select * from jsonb_populate_recordset(row(null, '', '', '', '', null, null, '', '', '', '', '', '', '', '', '', '')::clientes_ext, p_clientes)
  on conflict (id) do update set nombre = excluded.nombre, contacto = excluded.contacto, correo = excluded.correo,
    tipo = excluded.tipo, pct_terrestre = excluded.pct_terrestre, part_ta = excluded.part_ta, modalidad = excluded.modalidad,
    nit = excluded.nit, direccion = excluded.direccion, ciudad = excluded.ciudad, telefono = excluded.telefono,
    banco = excluded.banco, tipo_cuenta = excluded.tipo_cuenta, numero_cuenta = excluded.numero_cuenta,
    titular_cuenta = excluded.titular_cuenta, documento_titular = excluded.documento_titular
  where (t.*) is distinct from (excluded.*);
  delete from clientes_ext t where not exists (select 1 from jsonb_array_elements(p_clientes) e where e ->> 'id' = t.id);

  insert into ventas_cliente as t
  select * from jsonb_populate_recordset(row(null, null, null, null, '', '', '', '', null, null, 0, '[]', '[]', 0, 0, 0, '', '', null, '')::ventas_cliente, p_ventas)
  on conflict (id) do update set cliente_id = excluded.cliente_id, fecha = excluded.fecha, estado = excluded.estado,
    tipo_venta = excluded.tipo_venta, tipo_viaje = excluded.tipo_viaje, destino = excluded.destino, plan = excluded.plan,
    salida = excluded.salida, regreso = excluded.regreso, pasajeros = excluded.pasajeros, viajeros = excluded.viajeros,
    servicios = excluded.servicios, valor = excluded.valor, cobrado = excluded.cobrado, comision = excluded.comision,
    codigo = excluded.codigo, factura = excluded.factura, fecha_factura = excluded.fecha_factura, modalidad = excluded.modalidad
  where (t.*) is distinct from (excluded.*);
  delete from ventas_cliente t where not exists (select 1 from jsonb_array_elements(p_ventas) e where e ->> 'id' = t.id);

  insert into cobros_cliente as t select * from jsonb_populate_recordset(row(null, null, '', null, null, 0, 0, '', null)::cobros_cliente, p_cobros)
  on conflict (id) do update set cliente_id = excluded.cliente_id, periodo = excluded.periodo, desde = excluded.desde,
    hasta = excluded.hasta, ventas = excluded.ventas, total = excluded.total, estado = excluded.estado, enviada = excluded.enviada
  where (t.*) is distinct from (excluded.*);
  delete from cobros_cliente t where not exists (select 1 from jsonb_array_elements(p_cobros) e where e ->> 'id' = t.id);

  return jsonb_build_object('clientes', jsonb_array_length(p_clientes), 'ventas', jsonb_array_length(p_ventas), 'cobros', jsonb_array_length(p_cobros));
end $$;

-- ---------- Cuentas de cobro generadas en la intranet o el portal ----------
create type cuenta_cobro_estado_t as enum ('generada', 'enviada', 'pagada', 'anulada');

create table cuentas_cobro (
  id bigint generated always as identity primary key,
  numero text not null unique,
  cliente_id text not null,
  desde date not null,
  hasta date not null,                         -- fecha de corte = fecha de expedición
  total numeric(16, 2) not null check (total > 0),
  ventas int not null check (ventas > 0),
  estado cuenta_cobro_estado_t not null default 'generada',
  origen text not null check (origen in ('caminos', 'aliado')),
  datos jsonb not null,                        -- foto del aliado y de las ventas al generarla
  creada timestamptz not null default now(),
  creada_por uuid default auth.uid(),
  actualizada timestamptz not null default now(),
  check (hasta >= desde)
);
create index cuentas_cobro_cliente on cuentas_cobro (cliente_id, creada desc);

-- Cada venta se cobra una sola vez
create table cuentas_cobro_ventas (
  cuenta_id bigint not null references cuentas_cobro (id) on delete cascade,
  venta_id text primary key,
  comision numeric(16, 2) not null
);
create index cuentas_cobro_ventas_cuenta on cuentas_cobro_ventas (cuenta_id);

create sequence cuentas_cobro_consecutivo;

alter table cuentas_cobro enable row level security;
alter table cuentas_cobro_ventas enable row level security;
create policy cuentas_cobro_leer on cuentas_cobro for select to authenticated using (es_gerencia() or cliente_id = mi_cliente());
create policy cuentas_cobro_ventas_leer on cuentas_cobro_ventas for select to authenticated
  using (exists (select 1 from cuentas_cobro c where c.id = cuenta_id and (es_gerencia() or c.cliente_id = mi_cliente())));

-- Genera una cuenta de cobro con las ventas elegidas
create function generar_cuenta_cobro(p_cliente text, p_desde date, p_hasta date, p_ventas text[]) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  c clientes_ext; v record; n int; tot numeric := 0; lineas jsonb := '[]'; cid bigint; num text; origen text;
begin
  if es_gerencia() then origen := 'caminos';
  elsif mi_cliente() is not null and mi_cliente() = p_cliente then origen := 'aliado';
  else raise exception 'No puedes generar cuentas de cobro de este cliente.';
  end if;
  select * into c from clientes_ext where id = p_cliente;
  if not found then raise exception 'Ese cliente no está en AppSheet.'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'Revisa el periodo: la fecha de corte no puede ser antes del inicio.'; end if;
  if p_hasta > (now() at time zone 'America/Bogota')::date then raise exception 'La fecha de corte no puede ser futura.'; end if;
  n := coalesce(array_length(p_ventas, 1), 0);
  if n = 0 then raise exception 'Elige al menos una venta.'; end if;
  if n <> (select count(distinct x) from unnest(p_ventas) x) then raise exception 'Hay ventas repetidas.'; end if;

  for v in select * from ventas_cliente where id = any (p_ventas) order by fecha_factura, codigo loop
    if v.cliente_id <> p_cliente then raise exception 'La venta % no es de este cliente.', coalesce(nullif(v.codigo, ''), v.id); end if;
    if v.estado <> 'Facturado' or btrim(v.factura) = '' then raise exception 'La venta % no está facturada con número de factura.', coalesce(nullif(v.codigo, ''), v.id); end if;
    if lower(btrim(coalesce(nullif(v.modalidad, ''), c.modalidad))) <> 'retorno' then
      raise exception 'La venta % no es de modalidad Retorno: no va en cuenta de cobro.', coalesce(nullif(v.codigo, ''), v.id);
    end if;
    if v.fecha_factura is null or v.fecha_factura < p_desde or v.fecha_factura > p_hasta then
      raise exception 'La venta % no se facturó dentro del periodo.', coalesce(nullif(v.codigo, ''), v.id);
    end if;
    if v.comision <= 0 then raise exception 'La venta % no tiene comisión (revisa los %% del aliado en AppSheet).', coalesce(nullif(v.codigo, ''), v.id); end if;
    if exists (select 1 from cuentas_cobro_ventas x where x.venta_id = v.id) then
      raise exception 'La venta % ya está en otra cuenta de cobro.', coalesce(nullif(v.codigo, ''), v.id);
    end if;
    tot := tot + v.comision;
    lineas := lineas || jsonb_build_object('venta', v.id, 'codigo', v.codigo, 'factura', v.factura, 'fecha_factura', v.fecha_factura,
                                          'destino', v.destino, 'plan', v.plan, 'comision', v.comision);
  end loop;
  if jsonb_array_length(lineas) <> n then raise exception 'Alguna de las ventas elegidas no existe.'; end if;

  num := 'CC-' || to_char(p_hasta, 'YYYYMM') || '-' || lpad(nextval('cuentas_cobro_consecutivo')::text, 4, '0');
  insert into cuentas_cobro (numero, cliente_id, desde, hasta, total, ventas, origen, datos)
  values (num, p_cliente, p_desde, p_hasta, tot, n, origen, jsonb_build_object(
    'cliente', jsonb_build_object('nombre', c.nombre, 'contacto', c.contacto, 'nit', c.nit, 'direccion', c.direccion, 'ciudad', c.ciudad,
      'telefono', c.telefono, 'correo', c.correo, 'banco', c.banco, 'tipo_cuenta', c.tipo_cuenta, 'numero_cuenta', c.numero_cuenta,
      'titular_cuenta', c.titular_cuenta, 'documento_titular', c.documento_titular, 'modalidad', c.modalidad),
    'lineas', lineas))
  returning id into cid;
  insert into cuentas_cobro_ventas (cuenta_id, venta_id, comision)
  select cid, l ->> 'venta', (l ->> 'comision')::numeric from jsonb_array_elements(lineas) l;
  return jsonb_build_object('id', cid, 'numero', num, 'total', tot, 'ventas', n);
end $$;

-- Cambia el estado. La gerencia: enviada, pagada o anulada. El aliado: solo anular las suyas aún «generada».
-- Anular libera las ventas para otra cuenta de cobro.
create function estado_cuenta_cobro(p_id bigint, p_estado cuenta_cobro_estado_t) returns void
language plpgsql volatile security definer set search_path = public as $$
declare c cuentas_cobro;
begin
  select * into c from cuentas_cobro where id = p_id for update;
  if not found then raise exception 'No existe esa cuenta de cobro.'; end if;
  if not es_gerencia() then
    if mi_cliente() is distinct from c.cliente_id or p_estado <> 'anulada' or c.estado <> 'generada' then
      raise exception 'Solo puedes anular tus cuentas de cobro que aún no se han enviado.';
    end if;
  end if;
  if c.estado = 'anulada' then raise exception 'La cuenta de cobro ya está anulada.'; end if;
  if c.estado = 'pagada' and p_estado <> 'pagada' then raise exception 'Una cuenta de cobro pagada ya no cambia.'; end if;
  update cuentas_cobro set estado = p_estado, actualizada = now() where id = p_id;
  if p_estado = 'anulada' then delete from cuentas_cobro_ventas where cuenta_id = p_id; end if;
end $$;

revoke all on cuentas_cobro, cuentas_cobro_ventas from anon;
revoke insert, update, delete, truncate on cuentas_cobro, cuentas_cobro_ventas from authenticated;
grant select on cuentas_cobro, cuentas_cobro_ventas to authenticated;
grant all on cuentas_cobro, cuentas_cobro_ventas to service_role;
revoke all on sequence cuentas_cobro_consecutivo from anon, authenticated;
revoke all on function generar_cuenta_cobro(text, date, date, text[]), estado_cuenta_cobro(bigint, cuenta_cobro_estado_t) from public, anon;
grant execute on function generar_cuenta_cobro(text, date, date, text[]), estado_cuenta_cobro(bigint, cuenta_cobro_estado_t) to authenticated;

-- Tiempo real: la lista se actualiza sola en la intranet y en el portal
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table cuentas_cobro;
  end if;
end
$$;
