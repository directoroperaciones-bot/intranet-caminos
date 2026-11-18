-- =====================================================================
-- Intranet Caminos · 018 · Informes de gestión: botón «Actualizar»
-- El botón despierta la tarea programada de Claude que trae las ventas
-- (la misma de las 6 a. m.). La base llama a la tarea por internet con
-- pg_net; la dirección y el token de la tarea se guardan cifrados en
-- Vault y nadie los puede leer desde la intranet.
--   · guardar_tarea_ventas(url, token): la administración conecta el botón.
--   · pedir_actualizacion_ventas(): la gerencia lo usa; una vez cada 10 min.
--   · estado_pedido_ventas(): si la tarea aceptó el pedido.
-- =====================================================================

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net')
     and not exists (select 1 from pg_extension where extname = 'pg_net') then
    create extension pg_net with schema extensions;
  end if;
end
$$;

alter table ventas_estado
  add column boton_listo boolean not null default false,
  add column solicitado timestamptz,
  add column solicitado_por uuid references perfiles (id) on delete set null,
  add column pedido_id bigint;

-- La administración pega la «Fire URL» y el token de la tarea (claude.ai → tareas programadas → API).
-- Con url o token vacíos, el botón se desconecta.
create function guardar_tarea_ventas(p_url text, p_token text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  if not es_admin() then
    raise exception 'Solo la administración puede conectar el botón.';
  end if;
  p_url := btrim(coalesce(p_url, ''));
  p_token := btrim(coalesce(p_token, ''));
  if p_url = '' or p_token = '' then
    delete from vault.secrets where name in ('ventas_tarea_url', 'ventas_tarea_token');
    update ventas_estado set boton_listo = false where id;
    return;
  end if;
  if p_url !~ '^https://api\.anthropic\.com/v1/claude_code/routines/trig_[A-Za-z0-9]+/fire$' then
    raise exception 'La dirección no parece la «Fire URL» de la tarea (https://api.anthropic.com/v1/claude_code/routines/trig_…/fire).';
  end if;
  if p_token !~ '^sk-ant-oat01-[A-Za-z0-9_-]{20,}$' then
    raise exception 'El token no parece el de la tarea (empieza por sk-ant-oat01-).';
  end if;
  select id into v_id from vault.secrets where name = 'ventas_tarea_url';
  if v_id is null then perform vault.create_secret(p_url, 'ventas_tarea_url', 'Fire URL de la tarea de ventas');
  else perform vault.update_secret(v_id, p_url); end if;
  select id into v_id from vault.secrets where name = 'ventas_tarea_token';
  if v_id is null then perform vault.create_secret(p_token, 'ventas_tarea_token', 'Token de la tarea de ventas');
  else perform vault.update_secret(v_id, p_token); end if;
  update ventas_estado set boton_listo = true where id;
end $$;

-- El botón «Actualizar»
create function pedir_actualizacion_ventas() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare e ventas_estado; v_url text; v_token text; v_id bigint;
begin
  if not es_gerencia() then
    raise exception 'Solo la gerencia puede actualizar los informes.';
  end if;
  select * into e from ventas_estado where id for update;
  if not e.boton_listo then
    raise exception 'El botón aún no está conectado: la administración debe conectarlo en «Conexión con el gestor de reservas».';
  end if;
  -- Una actualización a la vez: si hay una pedida hace menos de 10 minutos que aún no llega, no se pide otra
  if e.solicitado is not null and e.solicitado > now() - interval '10 minutes'
     and (e.sincronizado is null or e.sincronizado < e.solicitado) then
    return jsonb_build_object('estado', 'en_curso', 'solicitado', e.solicitado);
  end if;
  if e.solicitado is not null and e.solicitado > now() - interval '2 minutes' then
    return jsonb_build_object('estado', 'reciente', 'solicitado', e.solicitado);
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'ventas_tarea_url';
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'ventas_tarea_token';
  if v_url is null or v_token is null then
    update ventas_estado set boton_listo = false where id;
    raise exception 'El botón perdió su conexión: la administración debe conectarlo de nuevo.';
  end if;
  v_id := net.http_post(
    url := v_url,
    body := jsonb_build_object('text', 'Pedido desde el botón «Actualizar» de la intranet.'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_token,
      'anthropic-version', '2023-06-01',
      'anthropic-beta', 'experimental-cc-routine-2026-04-01',
      'Content-Type', 'application/json'),
    timeout_milliseconds := 15000);
  update ventas_estado set solicitado = now(), solicitado_por = auth.uid(), pedido_id = v_id where id;
  return jsonb_build_object('estado', 'pedido', 'solicitado', now());
end $$;

-- ¿La tarea aceptó el último pedido? (código HTTP; nunca devuelve el token)
create function estado_pedido_ventas() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e ventas_estado; r record;
begin
  if not es_gerencia() then
    raise exception 'Solo la gerencia.';
  end if;
  select * into e from ventas_estado where id;
  if e.pedido_id is null then return jsonb_build_object('estado', 'sin_pedido'); end if;
  select status_code, error_msg into r from net._http_response where id = e.pedido_id;
  if not found then return jsonb_build_object('estado', 'esperando'); end if;
  return jsonb_build_object('estado', case when r.status_code between 200 and 299 then 'aceptado' else 'rechazado' end,
                            'codigo', r.status_code, 'error', left(coalesce(r.error_msg, ''), 200));
end $$;

revoke all on function guardar_tarea_ventas(text, text), pedir_actualizacion_ventas(), estado_pedido_ventas() from public, anon;
grant execute on function guardar_tarea_ventas(text, text), pedir_actualizacion_ventas(), estado_pedido_ventas() to authenticated;
