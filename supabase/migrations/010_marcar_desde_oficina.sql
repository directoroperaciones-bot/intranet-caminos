-- =====================================================================
-- Intranet Caminos · 010 · Marcar solo desde la oficina
-- 1. IP real: marcar() leía el primer valor de x-forwarded-for, que el
--    navegador puede inventar. Ahora se usa cf-connecting-ip (lo pone
--    Cloudflare y no se puede falsificar) o, si falta, el último valor de
--    x-forwarded-for (lo agrega el proxy de Supabase).
-- 2. Computadores autorizados: la gerencia autoriza cada computador de la
--    oficina una vez; ese navegador guarda una llave y marcar() la exige
--    cuando el control está activo. En la base solo queda su huella SHA-256.
-- Los dos controles se activan por separado en la tabla configuracion.
-- =====================================================================

-- ---------- IP real de quien hace la petición ----------
create function ip_cliente() returns inet
language plpgsql stable set search_path = public as $$
declare
  h json;
  v text;
begin
  h := nullif(current_setting('request.headers', true), '')::json;
  if h is null then
    return null;
  end if;
  v := nullif(trim(h ->> 'cf-connecting-ip'), '');
  if v is null and h ->> 'x-forwarded-for' is not null then
    v := trim(reverse(split_part(reverse(h ->> 'x-forwarded-for'), ',', 1)));
  end if;
  return nullif(v, '')::inet;
exception when others then
  return null;
end
$$;

-- La gerencia ve desde qué IP está conectada (para registrar la de la oficina)
create function mi_ip() returns text
language sql stable security definer set search_path = public as $$
  select case when es_gerencia() then host(ip_cliente()) end
$$;

-- ---------- Computadores autorizados ----------
create table equipos (
  id bigint generated always as identity primary key,
  sede_id smallint not null references sedes (id),
  nombre text not null check (length(trim(nombre)) between 1 and 60),
  token_hash text not null unique,
  activo boolean not null default true,
  creado timestamptz not null default now(),
  creado_por uuid references perfiles (id) on delete set null,
  ultimo_uso timestamptz,
  ultima_ip inet
);

alter table equipos enable row level security;
create policy equipos_leer on equipos for select to authenticated
  using (es_gerencia() or lidera_sede(sede_id));

revoke all on equipos from anon, authenticated;
-- La huella de la llave nunca sale de la base
grant select (id, sede_id, nombre, activo, creado, creado_por, ultimo_uso, ultima_ip) on equipos to authenticated;
grant all on equipos to service_role;

alter table marcas add column equipo_id bigint references equipos (id) on delete set null;

insert into configuracion (clave, valor) values ('validar_equipo', '{"activo": false}')
on conflict (clave) do nothing;

create function huella_llave(p text) returns text
language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(coalesce(p, ''), 'UTF8')), 'hex')
$$;

-- Autoriza el computador desde el que se llama y devuelve su llave (una sola vez)
create function autorizar_equipo(p_nombre text, p_sede smallint) returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  v_s sedes;
  v_ip inet := ip_cliente();
  v_llave text;
  v_id bigint;
begin
  if not es_gerencia() then
    raise exception 'Solo la gerencia autoriza computadores.';
  end if;
  select * into v_s from sedes where id = p_sede;
  if not found then
    raise exception 'La sede no existe.';
  end if;
  -- Si la oficina ya tiene IP registrada, solo se autoriza desde allí
  if coalesce(array_length(v_s.ips_oficina, 1), 0) > 0
     and (v_ip is null or not (v_ip = any (v_s.ips_oficina))) then
    raise exception 'Autoriza el computador desde la red de la oficina.';
  end if;
  v_llave := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into equipos (sede_id, nombre, token_hash, creado_por, ultima_ip)
  values (p_sede, trim(p_nombre), huella_llave(v_llave), auth.uid(), v_ip)
  returning id into v_id;
  return json_build_object('id', v_id, 'llave', v_llave);
end
$$;

create function quitar_equipo(p_id bigint) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not es_gerencia() then
    raise exception 'Solo la gerencia quita computadores.';
  end if;
  update equipos set activo = false where id = p_id;
end
$$;

-- IP pública de la oficina (lista; se reemplaza completa)
create function fijar_ips_oficina(p_sede smallint, p_ips inet[]) returns sedes
language plpgsql volatile security definer set search_path = public as $$
declare
  v sedes;
begin
  if not es_gerencia() then
    raise exception 'Solo la gerencia cambia la IP de la oficina.';
  end if;
  update sedes set ips_oficina = coalesce(p_ips, '{}') where id = p_sede returning * into v;
  if not found then
    raise exception 'La sede no existe.';
  end if;
  return v;
end
$$;

-- ---------- marcar() con los dos controles ----------
drop function marcar(marca_t);

create function marcar(p_tipo marca_t, p_equipo text default null) returns marcas
language plpgsql security definer set search_path = public as $$
declare
  v_p perfiles;
  v_s sedes;
  v_hoy date;
  v_ip inet := ip_cliente();
  v_eq equipos;
  v_fila marcas;
begin
  select * into v_p from perfiles where id = auth.uid() and activo;
  if not found then
    raise exception 'Tu cuenta no está activa.';
  end if;

  select * into v_s from sedes where id = v_p.sede_id;
  v_hoy := (now() at time zone v_s.zona_horaria)::date;

  if coalesce((config('validar_ip') ->> 'activo')::boolean, false)
     and (v_ip is null or not (v_ip = any (v_s.ips_oficina))) then
    raise exception 'Solo puedes marcar desde la red de la oficina.';
  end if;

  if coalesce((config('validar_equipo') ->> 'activo')::boolean, false) then
    select * into v_eq from equipos
    where token_hash = huella_llave(p_equipo) and activo and sede_id = v_p.sede_id;
    if not found then
      raise exception 'Este equipo no está autorizado para marcar. Marca desde un computador de la oficina.';
    end if;
    update equipos set ultimo_uso = now(), ultima_ip = v_ip where id = v_eq.id;
  end if;

  if p_tipo in ('salida_almuerzo', 'salida')
     and not exists (select 1 from marcas where persona_id = v_p.id and fecha = v_hoy and tipo = 'entrada') then
    raise exception 'Primero marca la entrada.';
  end if;
  if p_tipo = 'regreso_almuerzo'
     and not exists (select 1 from marcas where persona_id = v_p.id and fecha = v_hoy and tipo = 'salida_almuerzo') then
    raise exception 'Primero marca la salida a almorzar.';
  end if;

  begin
    insert into marcas (persona_id, fecha, tipo, hora, ip, equipo_id)
    values (v_p.id, v_hoy, p_tipo, now(), v_ip, v_eq.id)
    returning * into v_fila;
  exception when unique_violation then
    raise exception 'Ya marcaste % hoy.',
      case p_tipo when 'entrada' then 'la entrada'
                  when 'salida_almuerzo' then 'la salida a almorzar'
                  when 'regreso_almuerzo' then 'el regreso de almuerzo'
                  else 'la salida' end;
  end;
  return v_fila;
end
$$;

revoke all on function ip_cliente() from public, anon, authenticated;
revoke all on function huella_llave(text) from public, anon, authenticated;
revoke all on function mi_ip() from public, anon;
revoke all on function autorizar_equipo(text, smallint) from public, anon;
revoke all on function quitar_equipo(bigint) from public, anon;
revoke all on function fijar_ips_oficina(smallint, inet[]) from public, anon;
revoke all on function marcar(marca_t, text) from public, anon;
grant execute on function mi_ip() to authenticated;
grant execute on function autorizar_equipo(text, smallint) to authenticated;
grant execute on function quitar_equipo(bigint) to authenticated;
grant execute on function fijar_ips_oficina(smallint, inet[]) to authenticated;
grant execute on function marcar(marca_t, text) to authenticated;
grant execute on function ip_cliente(), huella_llave(text) to service_role;
