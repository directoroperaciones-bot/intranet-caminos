-- =====================================================================
-- Pruebas de permisos (Postgres local). Correr después de
-- 00_simular_supabase.sql y de todas las migraciones:
--
--   psql -v ON_ERROR_STOP=1 -d prueba -f supabase/pruebas/01_permisos.sql
--
-- Cada línea "OK" es una regla que se cumplió. La primera regla que no se
-- cumpla detiene el archivo con "FALLO …".
-- =====================================================================

\pset pager off
set client_min_messages = notice;

-- ---------- Ayudas ----------
create schema prueba;
grant usage on schema prueba to authenticated, anon;

create function prueba.id(n text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from perfiles where nombre = n
$$;

create function prueba.com_id(t text) returns bigint
language sql stable security definer set search_path = public as $$
  select id from comunicados where titulo = t
$$;

-- Cambia de identidad: rol authenticated + usuario de la sesión
create function prueba.como(n text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', prueba.id(n)::text, false);
  perform set_config('role', 'authenticated', false);
end $$;

create function prueba.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if coalesce(cond, false) then raise notice 'OK     %', msg;
  else raise exception 'FALLO  %', msg; end if;
end $$;

create function prueba.falla(sql text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'OK     % → «%»', msg, sqlerrm;
    return;
  end;
  raise exception 'FALLO  % (debía fallar y no falló)', msg;
end $$;

create function prueba.filas(sql text) returns int language plpgsql as $$
declare n int;
begin
  execute sql;
  get diagnostics n = row_count;
  return n;
end $$;

create function prueba.cuenta(sql text) returns int language plpgsql as $$
declare n int;
begin
  execute 'select count(*) from (' || sql || ') x' into n;
  return n;
end $$;

grant execute on all functions in schema prueba to authenticated, anon;

-- ---------- Datos de prueba ----------
insert into sedes (nombre, zona_horaria) values ('Sede de prueba', 'America/Bogota');
insert into turnos (sede_id, codigo, nombre)
select id, 'D', 'Descanso' from sedes where nombre = 'Sede de prueba';
insert into turnos (sede_id, codigo, nombre, entrada, salida_almuerzo, regreso_almuerzo, salida)
select id, 'M', 'Mañana', '07:00', '12:00', '13:00', '16:00' from sedes where nombre = 'Sede de prueba';

with u as (
  insert into auth.users (email) values
    ('admin@prueba.co'), ('directora@prueba.co'), ('supervisor@prueba.co'),
    ('ventas@prueba.co'), ('operaciones@prueba.co'), ('otrasede@prueba.co'), ('directora2@prueba.co')
  returning id, email
)
insert into perfiles (id, nombre, correo, sede_id, area_id, rol, es_admin)
select u.id, x.nombre, u.email,
       (select id from sedes where nombre = x.sede),
       (select id from areas where nombre = x.area),
       x.rol::rol_t, x.admin
from u join (values
  ('admin@prueba.co',       'Gerencia Admin',      'Bogotá',         'Gerencia',     'gerente',     true),
  ('directora@prueba.co',   'Directora Bogotá',    'Bogotá',         'Operaciones',  'directora',   false),
  ('supervisor@prueba.co',  'Supervisor Contable', 'Bogotá',         'Contabilidad', 'supervisor',  false),
  ('ventas@prueba.co',      'Colab Ventas',        'Bogotá',         'Ventas',       'colaborador', false),
  ('operaciones@prueba.co', 'Colab Operaciones',   'Bogotá',         'Operaciones',  'colaborador', false),
  ('otrasede@prueba.co',    'Colab Otra Sede',     'Sede de prueba', 'Ventas',       'colaborador', false),
  ('directora2@prueba.co',  'Directora Otra Sede', 'Sede de prueba', 'Operaciones',  'directora',   false)
) as x (correo, nombre, sede, area, rol, admin) on x.correo = u.email;

-- =====================================================================
\echo '--- Funciones de rol'
select prueba.como('Gerencia Admin');
select prueba.ok(es_gerencia() and es_admin() and puede_publicar() and puede_gestionar_cuentas(), 'admin: gerencia, admin, publica y gestiona cuentas');
select prueba.como('Supervisor Contable');
select prueba.ok(not es_gerencia() and not es_admin() and es_supervisor() and puede_gestionar_cuentas(), 'supervisor: gestiona cuentas pero NO es gerencia');
select prueba.ok(not puede_publicar(), 'supervisor: no publica comunicados');
select prueba.como('Directora Bogotá');
select prueba.ok(lidera_sede(sede_de(prueba.id('Colab Ventas'))) and not lidera_sede(sede_de(prueba.id('Colab Otra Sede'))), 'directora: lidera su sede y no la otra');
select prueba.como('Colab Ventas');
select prueba.ok(not es_gerencia() and not puede_publicar() and not puede_gestionar_cuentas(), 'colaborador: sin permisos especiales');

-- =====================================================================
\echo '--- Marcas'
select prueba.como('Colab Ventas');
select prueba.ok((marcar('entrada')).tipo = 'entrada', 'colaborador marca la entrada');
select prueba.falla($$select marcar('entrada')$$, 'marcar la entrada dos veces');
select prueba.falla($$select marcar('regreso_almuerzo')$$, 'marcar regreso sin haber salido a almorzar');
select prueba.falla($$insert into marcas (persona_id, fecha, tipo) values (auth.uid(), current_date, 'salida')$$, 'insertar una marca directo, sin marcar()');
select prueba.ok((marcar('salida_almuerzo')).tipo = 'salida_almuerzo', 'sale a almorzar');
select prueba.ok((marcar('regreso_almuerzo')).tipo = 'regreso_almuerzo', 'regresa de almorzar');
select prueba.ok((marcar('salida')).tipo = 'salida', 'marca la salida');
select prueba.como('Colab Operaciones');
select prueba.falla($$select marcar('salida')$$, 'marcar salida sin entrada');
select prueba.falla($$select marcar('salida_almuerzo')$$, 'salir a almorzar sin entrada');
select prueba.como('Colab Otra Sede');
select prueba.ok((marcar('entrada')).tipo = 'entrada', 'colaborador de otra sede marca la entrada');

\echo '--- Bloqueo por red (validar_ip)'
reset role;
update configuracion set valor = '{"activo": true}' where clave = 'validar_ip';
update sedes set ips_oficina = '{203.0.113.10}' where nombre = 'Bogotá';
select prueba.como('Colab Operaciones');
set "request.headers" = '{"x-forwarded-for": "198.51.100.7, 10.0.0.1"}';
select prueba.falla($$select marcar('entrada')$$, 'marcar desde una red que no es la de la oficina');
set "request.headers" = '{"x-forwarded-for": "203.0.113.10, 10.0.0.1"}';
select prueba.ok((marcar('entrada')).ip = '203.0.113.10'::inet, 'marcar desde la red de la oficina guarda la IP');
reset role;
update configuracion set valor = '{"activo": false}' where clave = 'validar_ip';
reset "request.headers";

\echo '--- Ver marcas'
select prueba.como('Colab Operaciones');
select prueba.ok(prueba.cuenta($$select 1 from marcas where persona_id = prueba.id('Colab Ventas')$$) = 0, 'un colaborador no ve marcas ajenas');
select prueba.ok(prueba.cuenta($$select 1 from marcas where persona_id = auth.uid()$$) = 1, 'un colaborador ve las suyas');
select prueba.como('Supervisor Contable');
select prueba.ok(prueba.cuenta($$select 1 from marcas where persona_id <> auth.uid()$$) = 0, 'el supervisor no ve marcas ajenas');
select prueba.como('Directora Bogotá');
select prueba.ok(prueba.cuenta($$select 1 from marcas where persona_id = prueba.id('Colab Ventas')$$) = 4, 'la directora ve las marcas de su sede');
select prueba.ok(prueba.cuenta($$select 1 from marcas where persona_id = prueba.id('Colab Otra Sede')$$) = 0, 'la directora no ve marcas de otra sede');
select prueba.como('Gerencia Admin');
select prueba.ok(prueba.cuenta($$select 1 from marcas$$) = 6, 'la gerencia ve todas las marcas');

-- =====================================================================
\echo '--- Malla, turnos y horario fijo'
select prueba.como('Colab Ventas');
select prueba.falla($$insert into malla values (auth.uid(), current_date + 1, (select id from turnos where codigo = 'D' and sede_id = 1))$$, 'un colaborador no edita la malla');
select prueba.falla($$insert into horario_base (persona_id, dia, turno_id) values (auth.uid(), 1, (select id from turnos where codigo = 'M' and sede_id = 1))$$, 'un colaborador no edita el horario fijo');
select prueba.ok(prueba.filas($$update turnos set nombre = 'X' where codigo = 'M'$$) = 0, 'un colaborador no cambia turnos');

select prueba.como('Directora Bogotá');
select prueba.ok(prueba.filas($$insert into malla values (prueba.id('Colab Ventas'), current_date + 1, (select id from turnos where codigo = 'D' and sede_id = 1))$$) = 1, 'la directora pone un cambio puntual en su sede');
select prueba.falla($$insert into malla values (prueba.id('Colab Otra Sede'), current_date + 1, (select id from turnos where codigo = 'D' and sede_id = 2))$$, 'la directora no edita la malla de otra sede');
select prueba.ok(prueba.filas($$insert into horario_base (persona_id, dia, turno_id) select prueba.id('Colab Ventas'), d, (select id from turnos where codigo = 'M' and sede_id = 1) from generate_series(1, 5) d$$) = 5, 'la directora carga el horario fijo de su sede');
select prueba.falla($$insert into horario_base (persona_id, dia, turno_id) values (prueba.id('Colab Otra Sede'), 1, (select id from turnos where codigo = 'M' and sede_id = 2))$$, 'la directora no carga horario fijo de otra sede');
select prueba.ok(prueba.filas($$update turnos set nombre = 'Mañana 7 a 4' where codigo = 'M' and sede_id = 1$$) = 1, 'la directora cambia un turno de su sede');
select prueba.ok(prueba.filas($$update turnos set nombre = 'X' where sede_id = 2$$) = 0, 'la directora no cambia turnos de otra sede');

select prueba.como('Supervisor Contable');
select prueba.ok(prueba.filas($$insert into malla values (prueba.id('Colab Otra Sede'), current_date + 1, (select id from turnos where codigo = 'D' and sede_id = 2))$$) = 1, 'el supervisor edita la malla de cualquier sede');
select prueba.ok(prueba.filas($$insert into horario_base (persona_id, dia, turno_id) values (prueba.id('Colab Otra Sede'), 1, (select id from turnos where codigo = 'M' and sede_id = 2))$$) = 1, 'el supervisor carga horario fijo de cualquier sede');
select prueba.ok(prueba.filas($$insert into turnos (sede_id, codigo, nombre, entrada, salida) values (2, '1', 'Turno 1', '08:00', '17:00')$$) = 1, 'el supervisor crea turnos');
select prueba.ok(prueba.filas($$update malla set turno_id = (select id from turnos where codigo = '1' and sede_id = 2) where persona_id = prueba.id('Colab Otra Sede')$$) = 1, 'el supervisor cambia un cambio puntual');
select prueba.ok(prueba.filas($$delete from malla where persona_id = prueba.id('Colab Otra Sede')$$) = 1, 'el supervisor vuelve al horario fijo (borra el cambio)');

reset role;
select prueba.ok((select count(*) from malla_historial) = 4, 'malla_historial registra inserción, cambio y borrado');
select prueba.ok((select bool_and(cambiado_por is not null) from malla_historial), 'malla_historial guarda quién cambió');
select prueba.ok((select bool_and(actualizado_por is not null) from horario_base), 'horario_base guarda quién lo actualizó');

\echo '--- Malla efectiva'
update configuracion set valor = jsonb_build_object('fecha', (current_date - 14)::text) where clave = 'inicio_horarios';
select prueba.como('Colab Ventas');
select prueba.ok(prueba.cuenta($$select 1 from malla_efectiva(current_date - 20, current_date + 6) where persona_id = auth.uid()$$) = 21, 'malla efectiva: solo desde inicio_horarios (15 días + 6)');
select prueba.ok((select t.codigo from malla_efectiva(current_date + 1, current_date + 1) m join turnos t on t.id = m.turno_id where m.persona_id = auth.uid()) = 'D'
                 and (select cambio from malla_efectiva(current_date + 1, current_date + 1) where persona_id = auth.uid()), 'malla efectiva: el cambio puntual manda');
select prueba.ok((select count(*) = 2 and bool_and(t.codigo = 'D') from malla_efectiva('2030-01-05', '2030-01-06') m join turnos t on t.id = m.turno_id where m.persona_id = auth.uid()), 'malla efectiva: días sin horario fijo son Descanso');
select prueba.ok((select t.codigo from malla_efectiva('2030-01-07', '2030-01-07') m join turnos t on t.id = m.turno_id where m.persona_id = auth.uid()) = 'M', 'malla efectiva: un lunes toma el horario fijo');
select prueba.ok(prueba.cuenta($$select 1 from malla_efectiva('2030-01-07', '2030-01-07') where persona_id = prueba.id('Colab Operaciones')$$) = 0, 'malla efectiva: sin horario fijo no hay malla automática');

-- =====================================================================
\echo '--- Comunicados'
select prueba.como('Colab Ventas');
select prueba.falla($$insert into comunicados (autor_id, titulo) values (auth.uid(), 'Hola')$$, 'un colaborador no publica');
select prueba.como('Supervisor Contable');
select prueba.falla($$insert into comunicados (autor_id, titulo) values (auth.uid(), 'Hola')$$, 'un supervisor no publica');
select prueba.como('Directora Bogotá');
select prueba.falla($$insert into comunicados (autor_id, titulo) values (prueba.id('Gerencia Admin'), 'Suplantar')$$, 'nadie publica a nombre de otra persona');
select prueba.ok(prueba.filas($$insert into comunicados (autor_id, titulo, cuerpo, destino, destino_id) values (auth.uid(), 'Solo ventas', 'Reunión de ventas', 'area', (select id from areas where nombre = 'Ventas'))$$) = 1, 'la directora publica para un área');
select prueba.ok(prueba.filas($$insert into comunicados (autor_id, titulo, cuerpo) values (auth.uid(), 'Para todos', 'Bienvenida')$$) = 1, 'la directora publica para todo el equipo');
select prueba.como('Colab Ventas');
select prueba.ok(prueba.cuenta($$select 1 from comunicados$$) = 2, 'el área de ventas ve los dos comunicados');
select prueba.ok(prueba.filas($$insert into comunicado_lecturas (comunicado_id, persona_id) select id, auth.uid() from comunicados where titulo = 'Solo ventas'$$) = 1, 'una destinataria confirma la lectura');
select prueba.ok(prueba.cuenta($$select 1 from comunicado_lecturas$$) = 1, 've su propia confirmación');
select prueba.como('Colab Operaciones');
select prueba.ok(prueba.cuenta($$select 1 from comunicados$$) = 1, 'operaciones no ve el comunicado de ventas');
select prueba.falla($$insert into comunicado_lecturas (comunicado_id, persona_id) values (prueba.com_id('Solo ventas'), auth.uid())$$, 'quien no es destinataria no confirma');
select prueba.ok(prueba.cuenta($$select 1 from comunicado_lecturas$$) = 0, 'no ve confirmaciones ajenas');
select prueba.ok(prueba.filas($$delete from comunicados$$) = 0, 'un colaborador no borra comunicados');
select prueba.como('Directora Otra Sede');
select prueba.ok(prueba.cuenta($$select 1 from comunicado_lecturas$$) = 1, 'quien publica ve quién confirmó');
select prueba.ok(prueba.filas($$delete from comunicados where titulo = 'Para todos'$$) = 0, 'una directora no borra comunicados ajenos');
select prueba.como('Gerencia Admin');
select prueba.ok(prueba.filas($$update comunicados set fijado = true where titulo = 'Para todos'$$) = 1, 'la gerencia fija cualquier comunicado');

\echo '--- Archivos de comunicados'
select prueba.como('Directora Bogotá');
select prueba.ok(prueba.filas($$insert into storage.objects (bucket_id, name) select 'comunicados', id || '/1-foto.jpg' from comunicados where titulo = 'Para todos'$$) = 1, 'la autora sube una imagen');
select prueba.como('Colab Ventas');
select prueba.ok(prueba.cuenta($$select 1 from storage.objects where bucket_id = 'comunicados'$$) = 1, 'la destinataria ve la imagen');
select prueba.falla($$insert into storage.objects (bucket_id, name) select 'comunicados', id || '/2-otra.jpg' from comunicados where titulo = 'Para todos'$$, 'un colaborador no sube imágenes a un comunicado');

-- =====================================================================
\echo '--- Cuentas: supervisor'
select prueba.como('Supervisor Contable');
select prueba.ok(prueba.filas($$update perfiles set area_id = (select id from areas where nombre = 'Operaciones') where nombre = 'Colab Ventas'$$) = 1, 'el supervisor cambia el área de un colaborador');
select prueba.ok(prueba.filas($$update perfiles set area_id = (select id from areas where nombre = 'Ventas') where nombre = 'Colab Ventas'$$) = 1, 'y la devuelve');
select prueba.falla($$update perfiles set rol = 'directora' where nombre = 'Colab Ventas'$$, 'el supervisor no sube de rol a un colaborador');
select prueba.falla($$update perfiles set es_admin = true where nombre = 'Colab Ventas'$$, 'el supervisor no da administración');
select prueba.ok(prueba.filas($$update perfiles set area_id = 1 where nombre = 'Directora Bogotá'$$) = 0, 'el supervisor no toca directoras');
select prueba.ok(prueba.filas($$update perfiles set area_id = 1 where id = auth.uid()$$) = 0, 'el supervisor no toca su propia cuenta');
select prueba.ok(prueba.filas($$update perfiles set rol = 'gerente' where id = auth.uid()$$) = 0, 'el supervisor no se sube de rol a sí mismo');
select prueba.falla($$insert into perfiles (id, nombre, correo, sede_id) values (gen_random_uuid(), 'X', 'x@x.co', 1)$$, 'el supervisor no inserta perfiles directo (va por la Edge Function)');

select prueba.como('Colab Ventas');
select prueba.ok(prueba.filas($$update perfiles set nombre = 'Otro' where nombre = 'Colab Operaciones'$$) = 0, 'un colaborador no cambia perfiles');
select prueba.ok(prueba.cuenta($$select 1 from perfiles$$) = 7, 'el directorio es visible para el equipo');

select prueba.como('Gerencia Admin');
select prueba.ok(prueba.filas($$update perfiles set rol = 'supervisor' where nombre = 'Colab Operaciones'$$) = 1, 'la administración asigna roles');
select prueba.ok(prueba.filas($$update perfiles set rol = 'colaborador' where nombre = 'Colab Operaciones'$$) = 1, 'y los devuelve');

-- =====================================================================
\echo '--- Herramientas y configuración'
select prueba.como('Colab Ventas');
select prueba.ok(prueba.cuenta($$select 1 from herramientas$$) = 3, 'el equipo ve las 3 herramientas de Caminos');
select prueba.ok(prueba.filas($$update configuracion set valor = '{"activo": true}' where clave = 'modulo_solicitudes'$$) = 0, 'un colaborador no cambia la configuración');
select prueba.ok(prueba.filas($$update herramientas set nombre = 'X'$$) = 0, 'un colaborador no cambia herramientas');
reset role;
update herramientas set areas_visibles = array[(select id from areas where nombre = 'Contabilidad')] where nombre = 'Cotizador OMNIAXIS';
select prueba.como('Colab Ventas');
select prueba.ok(prueba.cuenta($$select 1 from herramientas$$) = 2, 'una herramienta limitada a un área no aparece en otras');
select prueba.como('Gerencia Admin');
select prueba.ok(prueba.cuenta($$select 1 from herramientas$$) = 3, 'la gerencia ve todas');
reset role;
update herramientas set areas_visibles = null;

\echo '--- Sin sesión (anon)'
reset role;
set role anon;
select prueba.falla($$select * from perfiles$$, 'anon no lee perfiles');
select prueba.falla($$select marcar('entrada')$$, 'anon no marca');
reset role;

\echo '=== 01_permisos: todo OK'
