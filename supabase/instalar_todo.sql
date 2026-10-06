-- =====================================================================
-- Intranet Caminos · instalar_todo.sql
-- Las 7 migraciones en orden, en un solo archivo, para pegar en el SQL Editor
-- de Supabase. Se regenera con: bash supabase/unir.sh
-- =====================================================================

-- >>> 001_esquema.sql
-- =====================================================================
-- Intranet Caminos · 001 · Esquema base
-- Tipos, tablas, funciones de permiso, marcar(), solicitudes,
-- consentimiento, reglas RLS iniciales y permisos.
--
-- Cliente nuevo: rol_t nace ya con 'supervisor' (el manual permite
-- fusionar las migraciones 006 a 008 del proyecto original).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type rol_t as enum ('colaborador', 'supervisor', 'directora', 'gerente');
create type marca_t as enum ('entrada', 'salida_almuerzo', 'regreso_almuerzo', 'salida');
create type solicitud_tipo_t as enum ('vacaciones', 'permiso', 'incapacidad');
create type solicitud_estado_t as enum ('pendiente', 'aprobada', 'rechazada');
create type nivel_revisor_t as enum ('ver', 'aprobar');
create type destino_t as enum ('todos', 'area', 'sede');

-- ---------- Tablas ----------
create table sedes (
  id smallserial primary key,
  nombre text not null unique,
  zona_horaria text not null default 'America/Bogota',
  ips_oficina inet[] not null default '{}'
);

create table areas (
  id smallserial primary key,
  nombre text not null unique
);

create table perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  correo text not null unique,
  area_id smallint references areas (id),
  sede_id smallint not null references sedes (id),
  rol rol_t not null default 'colaborador',
  es_admin boolean not null default false,
  activo boolean not null default true,
  acepto_datos timestamptz,
  creado timestamptz not null default now()
);

create table configuracion (
  clave text primary key,
  valor jsonb not null,
  actualizado timestamptz not null default now()
);

create table turnos (
  id serial primary key,
  sede_id smallint not null references sedes (id),
  codigo text not null,
  nombre text not null,
  entrada time,
  salida_almuerzo time,
  regreso_almuerzo time,
  salida time,
  activo boolean not null default true,
  unique (sede_id, codigo),
  check ((entrada is null) = (salida is null)),
  check ((salida_almuerzo is null) = (regreso_almuerzo is null))
);

-- Cambios puntuales: solo los días que difieren del horario fijo (007).
create table malla (
  persona_id uuid not null references perfiles (id) on delete cascade,
  fecha date not null,
  turno_id int not null references turnos (id),
  primary key (persona_id, fecha)
);

create table malla_historial (
  id bigserial primary key,
  persona_id uuid not null,
  fecha date not null,
  turno_antes int,
  turno_despues int,
  cambiado_por uuid,
  cambiado_en timestamptz not null default now()
);

create table marcas (
  id bigserial primary key,
  persona_id uuid not null references perfiles (id) on delete cascade,
  fecha date not null,                -- fecha local de la sede
  tipo marca_t not null,
  hora timestamptz not null default now(),  -- la pone el servidor
  ip inet,
  corregida_por uuid references perfiles (id),
  unique (persona_id, fecha, tipo)
);

create table herramientas (
  id serial primary key,
  nombre text not null,
  descripcion text,
  icono text,
  pie text,
  url text not null,
  orden int not null default 0,
  areas_visibles smallint[],          -- nulo = todo el equipo
  activo boolean not null default true
);

create table comunicados (
  id bigserial primary key,
  autor_id uuid not null references perfiles (id),
  titulo text not null check (char_length(titulo) between 1 and 140),
  cuerpo text not null default '',
  destino destino_t not null default 'todos',
  destino_id smallint,
  requiere_confirmacion boolean not null default true,
  fijado boolean not null default false,
  creado timestamptz not null default now(),
  check ((destino = 'todos') = (destino_id is null))
);

create table comunicado_imagenes (
  id bigserial primary key,
  comunicado_id bigint not null references comunicados (id) on delete cascade,
  ruta text not null,
  nombre text,
  orden int not null default 0
);

create table comunicado_lecturas (
  comunicado_id bigint not null references comunicados (id) on delete cascade,
  persona_id uuid not null references perfiles (id) on delete cascade,
  leido_en timestamptz not null default now(),
  primary key (comunicado_id, persona_id)
);

create table solicitudes (
  id bigserial primary key,
  persona_id uuid not null references perfiles (id) on delete cascade,
  tipo solicitud_tipo_t not null,
  desde date not null,
  hasta date not null,
  hora_desde time,
  hora_hasta time,
  motivo text,
  estado solicitud_estado_t not null default 'pendiente',
  revisado_por uuid references perfiles (id),
  revisado_en timestamptz,
  comentario text,
  creado timestamptz not null default now(),
  check (hasta >= desde),
  check ((hora_desde is null) = (hora_hasta is null))
);

create table solicitud_adjuntos (
  id bigserial primary key,
  solicitud_id bigint not null references solicitudes (id) on delete cascade,
  ruta text not null,
  nombre text,
  tipo_mime text
);

create table revisores (
  persona_id uuid primary key references perfiles (id) on delete cascade,
  sede_id smallint references sedes (id),        -- nulo = todas las sedes
  tipos solicitud_tipo_t[] not null check (cardinality(tipos) > 0),
  nivel nivel_revisor_t not null default 'aprobar'
);

create index marcas_fecha_idx on marcas (fecha);
create index malla_fecha_idx on malla (fecha);
create index solicitudes_persona_idx on solicitudes (persona_id);
create index comunicado_imagenes_com_idx on comunicado_imagenes (comunicado_id);
create index solicitud_adjuntos_sol_idx on solicitud_adjuntos (solicitud_id);

-- ---------- Funciones de permiso ----------
-- security definer + search_path fijo: leen perfiles sin quedar atrapadas
-- en su propio RLS y nadie las engaña con un esquema falso.

create function mi_perfil() returns perfiles
language sql stable security definer set search_path = public as $$
  select * from perfiles where id = auth.uid() and activo
$$;

create function es_gerencia() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles
                 where id = auth.uid() and activo and (rol = 'gerente' or es_admin))
$$;

create function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo and es_admin)
$$;

create function lidera_sede(s smallint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles
                 where id = auth.uid() and activo
                   and (rol = 'gerente' or es_admin or (rol = 'directora' and sede_id = s)))
$$;

create function sede_de(persona uuid) returns smallint
language sql stable security definer set search_path = public as $$
  select sede_id from perfiles where id = persona
$$;

create function config(c text) returns jsonb
language sql stable security definer set search_path = public as $$
  select valor from configuracion where clave = c
$$;

create function puede_publicar() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles
                 where id = auth.uid() and activo
                   and (rol in ('gerente', 'directora') or es_admin))
$$;

create function es_destinatario(c bigint, persona uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from comunicados co join perfiles p on p.id = persona
    where co.id = c and p.activo and co.autor_id <> persona
      and (co.destino = 'todos'
           or (co.destino = 'area' and p.area_id = co.destino_id)
           or (co.destino = 'sede' and p.sede_id = co.destino_id)))
$$;

create function puede_ver_solicitud(s bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from solicitudes so join perfiles p on p.id = so.persona_id
    where so.id = s
      and (so.persona_id = auth.uid()
           or es_gerencia()
           or exists (select 1 from revisores r join perfiles yo on yo.id = r.persona_id and yo.activo
                      where r.persona_id = auth.uid()
                        and so.tipo = any (r.tipos)
                        and (r.sede_id is null or r.sede_id = p.sede_id))))
$$;

-- ---------- Auditoría de la malla ----------
create function registrar_cambio_malla() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into malla_historial (persona_id, fecha, turno_antes, turno_despues, cambiado_por)
    values (new.persona_id, new.fecha, null, new.turno_id, auth.uid());
  elsif tg_op = 'UPDATE' then
    insert into malla_historial (persona_id, fecha, turno_antes, turno_despues, cambiado_por)
    values (new.persona_id, new.fecha, old.turno_id, new.turno_id, auth.uid());
  else
    insert into malla_historial (persona_id, fecha, turno_antes, turno_despues, cambiado_por)
    values (old.persona_id, old.fecha, old.turno_id, null, auth.uid());
  end if;
  return null;
end
$$;

create trigger malla_historial_trg
after insert or update or delete on malla
for each row execute function registrar_cambio_malla();

-- ---------- marcar(): única forma de crear marcas ----------
create function marcar(p_tipo marca_t) returns marcas
language plpgsql security definer set search_path = public as $$
declare
  v_p perfiles;
  v_s sedes;
  v_hoy date;
  v_hdr text;
  v_ip inet;
  v_fila marcas;
begin
  select * into v_p from perfiles where id = auth.uid() and activo;
  if not found then
    raise exception 'Tu cuenta no está activa.';
  end if;

  select * into v_s from sedes where id = v_p.sede_id;
  v_hoy := (now() at time zone v_s.zona_horaria)::date;

  begin
    v_hdr := nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for';
    if v_hdr is not null then
      v_ip := trim(split_part(v_hdr, ',', 1))::inet;
    end if;
  exception when others then
    v_ip := null;
  end;

  if coalesce((config('validar_ip') ->> 'activo')::boolean, false)
     and (v_ip is null or not (v_ip = any (v_s.ips_oficina))) then
    raise exception 'Solo puedes marcar desde la red de la oficina.';
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
    insert into marcas (persona_id, fecha, tipo, hora, ip)
    values (v_p.id, v_hoy, p_tipo, now(), v_ip)
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

-- ---------- Solicitudes ----------
create function revisar_solicitud(p_id bigint, p_aprobar boolean, p_comentario text default null)
returns solicitudes
language plpgsql security definer set search_path = public as $$
declare
  v solicitudes;
begin
  select * into v from solicitudes where id = p_id for update;
  if not found then
    raise exception 'La solicitud no existe.';
  end if;
  if v.persona_id = auth.uid() then
    raise exception 'No puedes revisar tu propia solicitud.';
  end if;
  if v.estado <> 'pendiente' then
    raise exception 'Esta solicitud ya fue revisada.';
  end if;
  if not (es_gerencia() or exists (
      select 1 from revisores r join perfiles yo on yo.id = r.persona_id and yo.activo
      where r.persona_id = auth.uid() and r.nivel = 'aprobar'
        and v.tipo = any (r.tipos)
        and (r.sede_id is null or r.sede_id = sede_de(v.persona_id)))) then
    raise exception 'No tienes permiso para revisar esta solicitud.';
  end if;

  update solicitudes
     set estado = (case when p_aprobar then 'aprobada' else 'rechazada' end)::solicitud_estado_t,
         revisado_por = auth.uid(),
         revisado_en = now(),
         comentario = nullif(trim(coalesce(p_comentario, '')), '')
   where id = p_id
  returning * into v;
  return v;
end
$$;

-- ---------- Consentimiento de datos ----------
create function aceptar_datos() returns void
language sql security definer set search_path = public as $$
  update perfiles set acepto_datos = now() where id = auth.uid() and acepto_datos is null
$$;

-- ---------- RLS ----------
alter table sedes enable row level security;
alter table areas enable row level security;
alter table perfiles enable row level security;
alter table configuracion enable row level security;
alter table turnos enable row level security;
alter table malla enable row level security;
alter table malla_historial enable row level security;
alter table marcas enable row level security;
alter table herramientas enable row level security;
alter table comunicados enable row level security;
alter table comunicado_imagenes enable row level security;
alter table comunicado_lecturas enable row level security;
alter table solicitudes enable row level security;
alter table solicitud_adjuntos enable row level security;
alter table revisores enable row level security;

-- sedes y áreas: las lee todo el equipo, las cambia la administración
create policy sedes_leer on sedes for select to authenticated using (true);
create policy sedes_admin on sedes for all to authenticated using (es_admin()) with check (es_admin());
create policy areas_leer on areas for select to authenticated using (true);
create policy areas_admin on areas for all to authenticated using (es_admin()) with check (es_admin());

-- configuración: la lee todo el equipo, la cambia la gerencia
create policy configuracion_leer on configuracion for select to authenticated using (true);
create policy configuracion_gerencia on configuracion for all to authenticated
  using (es_gerencia()) with check (es_gerencia());

-- perfiles: directorio para todo el equipo; la administración crea y cambia
create policy perfiles_leer on perfiles for select to authenticated using (true);
create policy perfiles_admin on perfiles for all to authenticated using (es_admin()) with check (es_admin());

-- turnos y malla: los lee todo el equipo, los cambia quien lidera la sede
create policy turnos_leer on turnos for select to authenticated using (true);
create policy turnos_editar on turnos for all to authenticated
  using (lidera_sede(sede_id)) with check (lidera_sede(sede_id));
create policy malla_leer on malla for select to authenticated using (true);
create policy malla_editar on malla for all to authenticated
  using (lidera_sede(sede_de(persona_id))) with check (lidera_sede(sede_de(persona_id)));
create policy malla_historial_leer on malla_historial for select to authenticated using (true);

-- marcas: propias o de la sede que lidera; nadie inserta directo (solo marcar())
create policy marcas_leer on marcas for select to authenticated
  using (persona_id = auth.uid() or lidera_sede(sede_de(persona_id)));
create policy marcas_corregir on marcas for update to authenticated
  using (lidera_sede(sede_de(persona_id))) with check (lidera_sede(sede_de(persona_id)));

-- herramientas: activas y del área de quien mira; la gerencia ve y edita todas
create policy herramientas_leer on herramientas for select to authenticated
  using (es_gerencia() or (activo and (areas_visibles is null
         or (select area_id from perfiles where id = auth.uid()) = any (areas_visibles))));
create policy herramientas_gerencia on herramientas for all to authenticated
  using (es_gerencia()) with check (es_gerencia());

-- comunicados
create policy comunicados_leer on comunicados for select to authenticated
  using (autor_id = auth.uid() or es_gerencia() or puede_publicar() or es_destinatario(id, auth.uid()));
create policy comunicados_publicar on comunicados for insert to authenticated
  with check (puede_publicar() and autor_id = auth.uid());
create policy comunicados_cambiar on comunicados for update to authenticated
  using (autor_id = auth.uid() or es_gerencia()) with check (autor_id = auth.uid() or es_gerencia());
create policy comunicados_borrar on comunicados for delete to authenticated
  using (autor_id = auth.uid() or es_gerencia());

create policy comunicado_imagenes_leer on comunicado_imagenes for select to authenticated
  using (exists (select 1 from comunicados c where c.id = comunicado_id));
create policy comunicado_imagenes_autor on comunicado_imagenes for all to authenticated
  using (exists (select 1 from comunicados c where c.id = comunicado_id and (c.autor_id = auth.uid() or es_gerencia())))
  with check (exists (select 1 from comunicados c where c.id = comunicado_id and (c.autor_id = auth.uid() or es_gerencia())));

create policy comunicado_lecturas_leer on comunicado_lecturas for select to authenticated
  using (persona_id = auth.uid() or es_gerencia() or puede_publicar());
create policy comunicado_lecturas_confirmar on comunicado_lecturas for insert to authenticated
  with check (persona_id = auth.uid() and es_destinatario(comunicado_id, auth.uid()));

-- solicitudes: crear solo con el módulo activo; revisar solo con revisar_solicitud()
create policy solicitudes_leer on solicitudes for select to authenticated
  using (puede_ver_solicitud(id));
create policy solicitudes_crear on solicitudes for insert to authenticated
  with check (persona_id = auth.uid() and estado = 'pendiente' and revisado_por is null
              and coalesce((config('modulo_solicitudes') ->> 'activo')::boolean, false));
create policy solicitudes_cancelar on solicitudes for delete to authenticated
  using (persona_id = auth.uid() and estado = 'pendiente');

create policy solicitud_adjuntos_leer on solicitud_adjuntos for select to authenticated
  using (puede_ver_solicitud(solicitud_id));
create policy solicitud_adjuntos_duena on solicitud_adjuntos for all to authenticated
  using (exists (select 1 from solicitudes s where s.id = solicitud_id and s.persona_id = auth.uid() and s.estado = 'pendiente'))
  with check (exists (select 1 from solicitudes s where s.id = solicitud_id and s.persona_id = auth.uid() and s.estado = 'pendiente'));

create policy revisores_leer on revisores for select to authenticated
  using (persona_id = auth.uid() or es_gerencia());
create policy revisores_gerencia on revisores for all to authenticated
  using (es_gerencia()) with check (es_gerencia());

-- ---------- Permisos explícitos ----------
-- La exposición automática de tablas está apagada: cada permiso se da a mano.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke all on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- >>> 002_archivos.sql
-- =====================================================================
-- Intranet Caminos · 002 · Archivos (Storage)
-- Buckets privados de comunicados y soportes. La primera carpeta de la
-- ruta es el id del registro dueño, así las reglas heredan sus permisos.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('comunicados', 'comunicados', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('soportes', 'soportes', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

-- '15/1730000000-1-foto.jpg' → 15
create function carpeta_id(ruta text) returns bigint
language sql immutable set search_path = public as $$
  select case when split_part(ruta, '/', 1) ~ '^[0-9]+$'
              then split_part(ruta, '/', 1)::bigint end
$$;

revoke all on function carpeta_id(text) from public, anon;
grant execute on function carpeta_id(text) to authenticated;

-- Comunicados: ver si se ve el comunicado; subir y borrar, autor o gerencia
create policy comunicados_ver on storage.objects for select to authenticated
  using (bucket_id = 'comunicados'
         and exists (select 1 from public.comunicados c where c.id = public.carpeta_id(name)));
create policy comunicados_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'comunicados'
              and exists (select 1 from public.comunicados c
                          where c.id = public.carpeta_id(name)
                            and (c.autor_id = auth.uid() or public.es_gerencia())));
create policy comunicados_quitar on storage.objects for delete to authenticated
  using (bucket_id = 'comunicados'
         and exists (select 1 from public.comunicados c
                     where c.id = public.carpeta_id(name)
                       and (c.autor_id = auth.uid() or public.es_gerencia())));

-- Soportes: ver si se ve la solicitud; subir, la dueña mientras está pendiente
create policy soportes_ver on storage.objects for select to authenticated
  using (bucket_id = 'soportes' and public.puede_ver_solicitud(public.carpeta_id(name)));
create policy soportes_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'soportes'
              and exists (select 1 from public.solicitudes s
                          where s.id = public.carpeta_id(name)
                            and s.persona_id = auth.uid() and s.estado = 'pendiente'));

-- >>> 003_datos_iniciales.sql
-- =====================================================================
-- Intranet Caminos · 003 · Datos iniciales
-- ÚNICA migración que se personaliza por cliente.
--
-- PENDIENTE DE CONFIRMAR CON CAMINOS (ver intranet/LEEME.md):
--   · ¿Hay otras sedes además de Bogotá?
--   · Lista definitiva de áreas.
--   · Horario real de cada persona (los turnos de abajo son de ejemplo).
-- =====================================================================

-- Sedes (zona horaria IANA)
insert into sedes (nombre, zona_horaria) values
  ('Bogotá', 'America/Bogota');

-- Áreas (confirmar)
insert into areas (nombre) values
  ('Gerencia'),
  ('Ventas'),
  ('Operaciones'),
  ('Contabilidad');

-- Turnos de ejemplo por sede. 'D' (Descanso) debe existir en cada sede:
-- la malla efectiva lo usa para los días sin horario fijo.
insert into turnos (sede_id, codigo, nombre, entrada, salida_almuerzo, regreso_almuerzo, salida)
select s.id, x.codigo, x.nombre, x.entrada, x.salida_almuerzo, x.regreso_almuerzo, x.salida
from sedes s
cross join (values
  ('M', 'Mañana',     '07:00'::time, '12:00'::time, '13:00'::time, '16:00'::time),
  ('T', 'Tarde',      '10:00'::time, '14:00'::time, '15:00'::time, '19:00'::time),
  ('S', 'Sábado',     '08:00'::time, null::time,    null::time,    '12:00'::time),
  ('D', 'Descanso',   null::time,    null::time,    null::time,    null::time),
  ('V', 'Vacaciones', null::time,    null::time,    null::time,    null::time)
) as x (codigo, nombre, entrada, salida_almuerzo, regreso_almuerzo, salida);

-- Herramientas de Inicio (se agregan o cambian con un insert/update, sin tocar código)
insert into herramientas (nombre, descripcion, icono, pie, url, orden) values
  ('Gestor de reservas',
   'La app de operación de Caminos: ventas, reservas, pasajeros y proveedores.',
   'reservas', 'AppSheet',
   'https://www.appsheet.com/start/eb769707-eafd-445c-aa00-eb637321ef76#appName=GESTORDERESERVAS-CAMINOS2-850658711&view=INICIO',
   1),
  ('Caminos Documentos',
   'Cotizaciones, confirmaciones, vouchers e itinerarios con el diseño de Caminos.',
   'documentos', 'Claude',
   'https://claude.ai/artifact/WPzKkP7MwdKBaGrrGVpZ1Y',
   2),
  ('Cotizador OMNIAXIS',
   'Plantilla maestra del cotizador.',
   'cotizador', 'Google Sheets',
   'https://docs.google.com/spreadsheets/d/1n_wPCi90RUk69Yiclf-Uc1viJZIWQs7Qc1Z5k1ZUWM0/edit?gid=131584006#gid=131584006',
   3);

-- Configuración
insert into configuracion (clave, valor) values
  ('modulo_solicitudes', '{"activo": false}'),
  ('tolerancias',        '{"entrada_min": 5, "almuerzo_min": 5}'),
  ('meta_puntualidad',   '{"porcentaje": 95}'),
  ('validar_ip',         '{"activo": false}');

-- >>> 004_ausencias_y_soportes.sql
-- =====================================================================
-- Intranet Caminos · 004 · Ausencias aprobadas y borrado de soportes
-- =====================================================================

-- Solo persona, tipo y fechas de solicitudes aprobadas de día completo,
-- propias o de las personas que quien consulta lidera. Nunca motivo ni soportes.
create function ausencias_aprobadas(p_desde date, p_hasta date)
returns table (persona_id uuid, tipo solicitud_tipo_t, desde date, hasta date)
language sql stable security definer set search_path = public as $$
  select s.persona_id, s.tipo, s.desde, s.hasta
  from solicitudes s
  where s.estado = 'aprobada'
    and s.hora_desde is null
    and s.desde <= p_hasta and s.hasta >= p_desde
    and (s.persona_id = auth.uid() or lidera_sede(sede_de(s.persona_id)))
$$;

revoke all on function ausencias_aprobadas(date, date) from public, anon;
grant execute on function ausencias_aprobadas(date, date) to authenticated;

-- La dueña puede quitar un soporte mientras la solicitud está pendiente
create policy soportes_quitar on storage.objects for delete to authenticated
  using (bucket_id = 'soportes'
         and exists (select 1 from public.solicitudes s
                     where s.id = public.carpeta_id(name)
                       and s.persona_id = auth.uid() and s.estado = 'pendiente'));

-- >>> 005_permisos_servicio.sql
-- =====================================================================
-- Intranet Caminos · 005 · Permisos del rol de servicio
-- Con la exposición automática apagada, service_role (que usa la Edge
-- Function crear-usuario) también necesita permisos explícitos. Sin esto,
-- crear cuentas falla con "permission denied for table perfiles".
-- =====================================================================

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- >>> 006_supervisor.sql
-- =====================================================================
-- Intranet Caminos · 006 · Rol Supervisor
-- Fusiona las migraciones 006 a 010 del proyecto original: delegar la
-- creación de cuentas de colaboradores y la edición de malla y turnos de
-- todas las sedes, sin dar poderes de gerencia.
-- =====================================================================

create function es_supervisor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo and rol = 'supervisor')
$$;

create function puede_gestionar_cuentas() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles
                 where id = auth.uid() and activo and (es_admin or rol = 'supervisor'))
$$;

revoke all on function es_supervisor() from public, anon;
revoke all on function puede_gestionar_cuentas() from public, anon;
grant execute on function es_supervisor() to authenticated, service_role;
grant execute on function puede_gestionar_cuentas() to authenticated, service_role;

-- Supervisor: cambia filas ajenas de colaboradores sin administración,
-- y el resultado debe seguir siendo colaborador sin administración.
create policy perfiles_gestor on perfiles for update to authenticated
  using (puede_gestionar_cuentas() and id <> auth.uid() and rol = 'colaborador' and not es_admin)
  with check (puede_gestionar_cuentas() and id <> auth.uid() and rol = 'colaborador' and not es_admin);

-- Supervisor: malla y turnos de todas las sedes
create policy malla_supervisor on malla for all to authenticated
  using (es_supervisor()) with check (es_supervisor());
create policy turnos_supervisor on turnos for all to authenticated
  using (es_supervisor()) with check (es_supervisor());

-- >>> 007_horario_fijo.sql
-- =====================================================================
-- Intranet Caminos · 007 · Horario fijo y malla efectiva
-- Turnos (catálogo) + horario fijo semanal por persona + cambios puntuales
-- (tabla malla). Lo que se ve y se evalúa es la malla efectiva.
-- =====================================================================

create table horario_base (
  persona_id uuid not null references perfiles (id) on delete cascade,
  dia smallint not null check (dia between 1 and 7),   -- 1 = lunes … 7 = domingo
  turno_id int not null references turnos (id),
  actualizado timestamptz not null default now(),
  actualizado_por uuid,
  primary key (persona_id, dia)
);

create function tocar_horario_base() returns trigger
language plpgsql set search_path = public as $$
begin
  new.actualizado := now();
  new.actualizado_por := auth.uid();
  return new;
end
$$;

create trigger horario_base_tocar
before insert or update on horario_base
for each row execute function tocar_horario_base();

alter table horario_base enable row level security;
create policy horario_base_leer on horario_base for select to authenticated using (true);
create policy horario_base_editar on horario_base for all to authenticated
  using (lidera_sede(sede_de(persona_id)) or es_supervisor())
  with check (lidera_sede(sede_de(persona_id)) or es_supervisor());

grant select, insert, update, delete on horario_base to authenticated;
grant all on horario_base to service_role;

-- Desde cuándo el horario fijo genera malla (se ajusta al día de arranque)
insert into configuracion (clave, valor)
values ('inicio_horarios', jsonb_build_object('fecha', to_char(current_date, 'YYYY-MM-DD')))
on conflict (clave) do nothing;

-- Malla efectiva: el cambio puntual si existe; si no, el horario fijo.
-- security invoker: corre con los permisos de quien consulta.
create function malla_efectiva(p_desde date, p_hasta date)
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
    left join horario_base hb on hb.persona_id = p.id and hb.dia = extract(isodow from d.fecha)
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

revoke all on function malla_efectiva(date, date) from public, anon;
revoke all on function tocar_horario_base() from public, anon;
grant execute on function malla_efectiva(date, date) to authenticated, service_role;
