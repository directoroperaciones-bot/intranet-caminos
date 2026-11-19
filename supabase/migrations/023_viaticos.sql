-- =====================================================================
-- 023 · Viáticos y legalización de gastos de viaje
--
-- Flujo:
--   1. El funcionario solicita viáticos para un viaje (o la gerencia los
--      asigna directamente).                                  → solicitado
--   2. La gerencia fija el presupuesto y aprueba, o rechaza.  → aprobado / rechazado
--   3. El funcionario registra sus gastos con soporte y envía
--      la legalización.                                       → en_revision
--   4. La gerencia revisa: puede no aceptar gastos puntuales;
--      aprueba (queda el saldo) o devuelve para corregir.     → cerrado / devuelto
--   Se puede anular antes de cerrar.                          → anulado
--
-- Cada funcionario ve solo sus viáticos; la gerencia ve todos. Todo cambio
-- de estado pasa por una función; los gastos los escribe el funcionario
-- solo mientras el viático está aprobado o devuelto. Nadie se aprueba a sí
-- mismo (con dos gerentes, uno aprueba los del otro).
-- =====================================================================

create type viatico_estado_t as enum ('solicitado', 'rechazado', 'aprobado', 'en_revision', 'devuelto', 'cerrado', 'anulado');

create table viaticos (
  id bigserial primary key,
  persona_id uuid not null references perfiles (id),
  grupo_id bigint references grupos (id) on delete set null,
  destino text not null check (char_length(btrim(destino)) between 1 and 120),
  motivo text not null default '' check (char_length(motivo) <= 1000),
  salida date not null,
  regreso date not null,
  solicitado numeric(14, 2) check (solicitado is null or solicitado > 0),
  presupuesto numeric(14, 2) check (presupuesto is null or presupuesto > 0),
  estado viatico_estado_t not null default 'solicitado',
  comentario text not null default '' check (char_length(comentario) <= 1000),
  creado_por uuid references perfiles (id) default auth.uid(),
  creado timestamptz not null default now(),
  aprobado_por uuid references perfiles (id),
  aprobado timestamptz,
  enviado timestamptz,
  revisado_por uuid references perfiles (id),
  revisado timestamptz,
  legalizado numeric(14, 2),             -- total de gastos aceptados al cerrar
  saldo numeric(14, 2),                  -- presupuesto − legalizado (+ devuelve el funcionario, − se le reembolsa)
  actualizado timestamptz not null default now(),
  check (regreso >= salida),
  check (regreso - salida <= 120)
);
create index viaticos_persona_idx on viaticos (persona_id);
create index viaticos_estado_idx on viaticos (estado);

create table viatico_gastos (
  id bigserial primary key,
  viatico_id bigint not null references viaticos (id) on delete cascade,
  fecha date not null,
  categoria text not null check (categoria in ('alimentacion', 'hospedaje', 'transporte', 'propinas', 'entradas', 'otros')),
  descripcion text not null check (char_length(btrim(descripcion)) between 1 and 300),
  valor numeric(14, 2) not null check (valor > 0 and valor < 1000000000),
  soporte_ruta text,
  soporte_nombre text,
  no_aceptado text check (no_aceptado is null or char_length(btrim(no_aceptado)) between 3 and 300),
  creado timestamptz not null default now()
);
create index viatico_gastos_viatico_idx on viatico_gastos (viatico_id);

-- ¿El viático es mío y todavía puedo registrar gastos?
create function viatico_editable(v bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from viaticos
                 where id = v and persona_id = auth.uid() and estado in ('aprobado', 'devuelto'))
$$;
create function viatico_visible(v bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from viaticos where id = v and (persona_id = auth.uid() or es_gerencia()))
$$;

alter table viaticos enable row level security;
alter table viatico_gastos enable row level security;
create policy viaticos_leer on viaticos for select to authenticated
  using (persona_id = auth.uid() or es_gerencia());
create policy viatico_gastos_leer on viatico_gastos for select to authenticated
  using (viatico_visible(viatico_id));
create policy viatico_gastos_crear on viatico_gastos for insert to authenticated
  with check (viatico_editable(viatico_id) and no_aceptado is null
              and exists (select 1 from viaticos v where v.id = viatico_id
                          and fecha between v.salida - 7 and v.regreso + 7));
create policy viatico_gastos_editar on viatico_gastos for update to authenticated
  using (viatico_editable(viatico_id))
  with check (viatico_editable(viatico_id)
              and exists (select 1 from viaticos v where v.id = viatico_id
                          and fecha between v.salida - 7 and v.regreso + 7));
create policy viatico_gastos_quitar on viatico_gastos for delete to authenticated
  using (viatico_editable(viatico_id));

revoke all on viaticos, viatico_gastos from anon;
revoke insert, update, delete, truncate on viaticos from authenticated;
revoke update, truncate on viatico_gastos from authenticated;
grant select on viaticos to authenticated;
grant select, insert, delete on viatico_gastos to authenticated;
-- El funcionario corrige sus gastos, pero «no aceptado» solo lo pone la gerencia
grant update (fecha, categoria, descripcion, valor, soporte_ruta, soporte_nombre) on viatico_gastos to authenticated;
grant all on viaticos, viatico_gastos to service_role;
revoke all on sequence viaticos_id_seq from anon, authenticated;
grant usage on sequence viatico_gastos_id_seq to authenticated;

-- ---------- Funciones del flujo ----------
create function viatico_validar(p_destino text, p_salida date, p_regreso date) returns void
language plpgsql set search_path = public as $$
begin
  if char_length(btrim(coalesce(p_destino, ''))) = 0 then raise exception 'Escribe el destino.'; end if;
  if p_salida is null or p_regreso is null then raise exception 'Pon las fechas de salida y regreso.'; end if;
  if p_regreso < p_salida then raise exception 'El regreso no puede ser antes de la salida.'; end if;
  if p_regreso - p_salida > 120 then raise exception 'Un viático cubre hasta 120 días.'; end if;
end $$;

create function solicitar_viatico(p_destino text, p_salida date, p_regreso date, p_monto numeric, p_motivo text, p_grupo bigint default null)
returns viaticos language plpgsql security definer set search_path = public as $$
declare v viaticos;
begin
  if not es_activo() then raise exception 'Tu cuenta no está activa.'; end if;
  perform viatico_validar(p_destino, p_salida, p_regreso);
  if p_monto is not null and p_monto <= 0 then raise exception 'El monto debe ser mayor que cero.'; end if;
  insert into viaticos (persona_id, grupo_id, destino, motivo, salida, regreso, solicitado, creado_por)
  values (auth.uid(), p_grupo, btrim(p_destino), coalesce(btrim(p_motivo), ''), p_salida, p_regreso, p_monto, auth.uid())
  returning * into v;
  return v;
end $$;

create function asignar_viatico(p_persona uuid, p_destino text, p_salida date, p_regreso date, p_presupuesto numeric, p_motivo text, p_grupo bigint default null)
returns viaticos language plpgsql security definer set search_path = public as $$
declare v viaticos;
begin
  if not es_gerencia() then raise exception 'Solo la gerencia asigna viáticos.'; end if;
  if p_persona = auth.uid() then raise exception 'No puedes asignarte viáticos a ti mismo: solicítalos y que otra persona de gerencia los apruebe.'; end if;
  if not exists (select 1 from perfiles where id = p_persona and activo) then raise exception 'Elige un funcionario activo.'; end if;
  perform viatico_validar(p_destino, p_salida, p_regreso);
  if p_presupuesto is null or p_presupuesto <= 0 then raise exception 'Asigna el presupuesto.'; end if;
  insert into viaticos (persona_id, grupo_id, destino, motivo, salida, regreso, presupuesto, estado, creado_por, aprobado_por, aprobado)
  values (p_persona, p_grupo, btrim(p_destino), coalesce(btrim(p_motivo), ''), p_salida, p_regreso, p_presupuesto, 'aprobado', auth.uid(), auth.uid(), now())
  returning * into v;
  return v;
end $$;

create function aprobar_viatico(p_id bigint, p_presupuesto numeric, p_comentario text default '')
returns viaticos language plpgsql security definer set search_path = public as $$
declare v viaticos;
begin
  if not es_gerencia() then raise exception 'Solo la gerencia aprueba viáticos.'; end if;
  select * into v from viaticos where id = p_id for update;
  if not found then raise exception 'El viático no existe.'; end if;
  if v.persona_id = auth.uid() then raise exception 'No puedes aprobar tus propios viáticos.'; end if;
  if v.estado <> 'solicitado' then raise exception 'Este viático ya no está por aprobar.'; end if;
  if p_presupuesto is null or p_presupuesto <= 0 then raise exception 'Asigna el presupuesto.'; end if;
  update viaticos set estado = 'aprobado', presupuesto = p_presupuesto, comentario = coalesce(btrim(p_comentario), ''),
         aprobado_por = auth.uid(), aprobado = now(), actualizado = now()
  where id = p_id returning * into v;
  return v;
end $$;

create function rechazar_viatico(p_id bigint, p_comentario text)
returns viaticos language plpgsql security definer set search_path = public as $$
declare v viaticos;
begin
  if not es_gerencia() then raise exception 'Solo la gerencia rechaza viáticos.'; end if;
  select * into v from viaticos where id = p_id for update;
  if not found then raise exception 'El viático no existe.'; end if;
  if v.persona_id = auth.uid() then raise exception 'No puedes revisar tus propios viáticos.'; end if;
  if v.estado <> 'solicitado' then raise exception 'Este viático ya no está por aprobar.'; end if;
  if char_length(btrim(coalesce(p_comentario, ''))) < 3 then raise exception 'Escribe el motivo del rechazo.'; end if;
  update viaticos set estado = 'rechazado', comentario = btrim(p_comentario), revisado_por = auth.uid(), revisado = now(), actualizado = now()
  where id = p_id returning * into v;
  return v;
end $$;

create function enviar_legalizacion(p_id bigint)
returns viaticos language plpgsql security definer set search_path = public as $$
declare v viaticos;
begin
  select * into v from viaticos where id = p_id for update;
  if not found or v.persona_id <> auth.uid() then raise exception 'El viático no existe.'; end if;
  if v.estado not in ('aprobado', 'devuelto') then raise exception 'Este viático no está para legalizar.'; end if;
  if not exists (select 1 from viatico_gastos where viatico_id = p_id) then raise exception 'Registra al menos un gasto antes de enviar.'; end if;
  update viaticos set estado = 'en_revision', enviado = now(), actualizado = now() where id = p_id returning * into v;
  return v;
end $$;

-- La gerencia marca un gasto como no aceptado (con motivo) o lo vuelve a aceptar (motivo vacío)
create function no_aceptar_gasto(p_gasto bigint, p_motivo text)
returns viatico_gastos language plpgsql security definer set search_path = public as $$
declare g viatico_gastos; v viaticos;
begin
  if not es_gerencia() then raise exception 'Solo la gerencia revisa legalizaciones.'; end if;
  select * into g from viatico_gastos where id = p_gasto;
  if not found then raise exception 'El gasto no existe.'; end if;
  select * into v from viaticos where id = g.viatico_id;
  if v.persona_id = auth.uid() then raise exception 'No puedes revisar tus propios viáticos.'; end if;
  if v.estado <> 'en_revision' then raise exception 'La legalización no está en revisión.'; end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is not null and char_length(btrim(p_motivo)) < 3 then raise exception 'Escribe el motivo.'; end if;
  update viatico_gastos set no_aceptado = nullif(btrim(coalesce(p_motivo, '')), '') where id = p_gasto returning * into g;
  return g;
end $$;

create function revisar_legalizacion(p_id bigint, p_aprobar boolean, p_comentario text default '')
returns viaticos language plpgsql security definer set search_path = public as $$
declare v viaticos; v_total numeric;
begin
  if not es_gerencia() then raise exception 'Solo la gerencia revisa legalizaciones.'; end if;
  select * into v from viaticos where id = p_id for update;
  if not found then raise exception 'El viático no existe.'; end if;
  if v.persona_id = auth.uid() then raise exception 'No puedes revisar tus propios viáticos.'; end if;
  if v.estado <> 'en_revision' then raise exception 'La legalización no está en revisión.'; end if;
  if p_aprobar then
    select coalesce(sum(valor), 0) into v_total from viatico_gastos where viatico_id = p_id and no_aceptado is null;
    update viaticos set estado = 'cerrado', legalizado = v_total, saldo = presupuesto - v_total,
           comentario = coalesce(btrim(p_comentario), ''), revisado_por = auth.uid(), revisado = now(), actualizado = now()
    where id = p_id returning * into v;
  else
    if char_length(btrim(coalesce(p_comentario, ''))) < 3 then raise exception 'Escribe qué debe corregir.'; end if;
    update viaticos set estado = 'devuelto', comentario = btrim(p_comentario), revisado_por = auth.uid(), revisado = now(), actualizado = now()
    where id = p_id returning * into v;
  end if;
  return v;
end $$;

create function anular_viatico(p_id bigint, p_motivo text default '')
returns viaticos language plpgsql security definer set search_path = public as $$
declare v viaticos;
begin
  select * into v from viaticos where id = p_id for update;
  if not found or not (v.persona_id = auth.uid() or es_gerencia()) then raise exception 'El viático no existe.'; end if;
  if es_gerencia() and v.persona_id <> auth.uid() then
    if v.estado in ('cerrado', 'anulado', 'rechazado') then raise exception 'Este viático ya no se puede anular.'; end if;
  elsif v.estado <> 'solicitado' then
    raise exception 'Solo puedes anular tu solicitud mientras no la aprueben.';
  end if;
  update viaticos set estado = 'anulado', comentario = coalesce(nullif(btrim(p_motivo), ''), comentario), actualizado = now()
  where id = p_id returning * into v;
  return v;
end $$;

revoke all on function viatico_editable(bigint), viatico_visible(bigint), viatico_validar(text, date, date),
  solicitar_viatico(text, date, date, numeric, text, bigint), asignar_viatico(uuid, text, date, date, numeric, text, bigint),
  aprobar_viatico(bigint, numeric, text), rechazar_viatico(bigint, text), enviar_legalizacion(bigint),
  no_aceptar_gasto(bigint, text), revisar_legalizacion(bigint, boolean, text), anular_viatico(bigint, text) from public, anon;
grant execute on function viatico_editable(bigint), viatico_visible(bigint),
  solicitar_viatico(text, date, date, numeric, text, bigint), asignar_viatico(uuid, text, date, date, numeric, text, bigint),
  aprobar_viatico(bigint, numeric, text), rechazar_viatico(bigint, text), enviar_legalizacion(bigint),
  no_aceptar_gasto(bigint, text), revisar_legalizacion(bigint, boolean, text), anular_viatico(bigint, text) to authenticated;

-- ---------- Soportes (Storage) ----------
-- Ruta: '<id del viático>/<archivo>'. Los ve quien ve el viático; los sube y
-- quita el funcionario mientras puede registrar gastos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('viaticos', 'viaticos', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create policy viaticos_ver on storage.objects for select to authenticated
  using (bucket_id = 'viaticos' and public.viatico_visible(public.carpeta_id(name)));
create policy viaticos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'viaticos' and public.viatico_editable(public.carpeta_id(name)));
create policy viaticos_quitar on storage.objects for delete to authenticated
  using (bucket_id = 'viaticos' and public.viatico_editable(public.carpeta_id(name)));
