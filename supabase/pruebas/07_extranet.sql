-- =====================================================================
-- Pruebas de la extranet de clientes (019). Correr después de 01 a 06.
-- =====================================================================

\pset pager off
set client_min_messages = notice;

-- Dos clientes de AppSheet con cuenta, y una persona sin nada
reset role;
insert into auth.users (id, email) values
  ('c0000000-0000-4000-8000-000000000001', 'ricardo@aliado.example'),
  ('c0000000-0000-4000-8000-000000000002', 'parroquia@ejemplo.example'),
  ('c0000000-0000-4000-8000-000000000003', 'nadie@ejemplo.example');
create function prueba.como_cliente(n int) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-00000000000' || n, false);
  perform set_config('role', 'authenticated', false);
end $$;

\echo '--- Carga desde la tarea (solo el servidor)'
select prueba.ok((aplicar_extranet(
  $$[{"id":"cli-r","nombre":"Ricardo Aliado","correo":"ricardo@aliado.example","tipo":"Freelance","pct_terrestre":0.1,"part_ta":0.5,"modalidad":"Retorno"},
     {"id":"cli-p","nombre":"Parroquia San José","correo":"parroquia@ejemplo.example","tipo":"PARROQUIA"}]$$,
  $$[{"id":"vr1","cliente_id":"cli-r","fecha":"2026-09-01","estado":"Facturado","destino":"Punta Cana","pasajeros":2,"viajeros":["Ana Pérez","Luis Pérez"],"servicios":[{"tipo":"Vuelo","detalle":"BOG-PUJ-BOG"}],"valor":5000000,"cobrado":5000000,"comision":120000},
     {"id":"vr2","cliente_id":"cli-r","fecha":"2026-10-01","estado":"Confirmada","destino":"Cartagena","valor":2000000,"cobrado":500000},
     {"id":"vp1","cliente_id":"cli-p","fecha":"2026-10-03","estado":"Facturado","destino":"Pasto","pasajeros":30,"valor":30000000,"cobrado":10000000}]$$,
  $$[{"id":"cc1","cliente_id":"cli-r","periodo":"Septiembre 2026","ventas":1,"total":120000,"estado":"Enviada"}]$$
)) ->> 'ventas' = '3', 'el servidor carga clientes, ventas y cuentas de cobro');
set role anon;
select prueba.falla($$select aplicar_extranet('[]','[]','[]')$$, 'sin sesión no se carga nada');
reset role;
select prueba.como('Gerencia Admin');
select prueba.falla($$select aplicar_extranet('[]','[]','[]')$$, 'ni la administración carga desde la intranet');
select prueba.ok(prueba.cuenta($$select 1 from ventas_cliente$$) = 3, 'la gerencia ve las ventas de todos los clientes');
reset role;

-- Cuentas: Ricardo y la parroquia (las crea la Edge Function con la llave de servicio)
insert into cuentas_cliente (usuario_id, cliente_id, correo) values
  ('c0000000-0000-4000-8000-000000000001', 'cli-r', 'ricardo@aliado.example'),
  ('c0000000-0000-4000-8000-000000000002', 'cli-p', 'parroquia@ejemplo.example');

\echo '--- Cada cliente ve solo lo suyo'
select prueba.como_cliente(1);
select prueba.ok(prueba.cuenta($$select 1 from ventas_cliente$$) = 2, 'Ricardo ve sus 2 ventas');
select prueba.ok(prueba.cuenta($$select 1 from ventas_cliente where cliente_id <> 'cli-r'$$) = 0, 'Ricardo no ve ventas de otro cliente');
select prueba.ok(prueba.cuenta($$select 1 from clientes_ext$$) = 1, 'Ricardo solo ve su ficha de cliente');
select prueba.ok(prueba.cuenta($$select 1 from cobros_cliente$$) = 1, 'Ricardo ve su cuenta de cobro');
select prueba.ok((mi_cuenta_cliente()) ->> 'nombre' = 'Ricardo Aliado' and (mi_cuenta_cliente()) ->> 'debe_cambiar' = 'true', 'al entrar sabe quién es y que debe cambiar la contraseña');
select prueba.falla($$update ventas_cliente set valor = 1$$, 'un cliente no cambia sus ventas');
select prueba.falla($$insert into cuentas_cliente (usuario_id, cliente_id, correo) values (auth.uid(), 'cli-p', 'x')$$, 'un cliente no se asigna otro cliente');
select clave_cliente_cambiada();
select prueba.ok((mi_cuenta_cliente()) ->> 'debe_cambiar' = 'false', 'tras cambiar la contraseña ya no se le pide');
select prueba.como_cliente(2);
select prueba.ok(prueba.cuenta($$select 1 from ventas_cliente$$) = 1 and prueba.cuenta($$select 1 from cobros_cliente$$) = 0, 'la parroquia ve solo su venta y no las cuentas de cobro de Ricardo');

\echo '--- Un cliente no ve nada del equipo'
select prueba.como_cliente(1);
select prueba.ok(prueba.cuenta($$select 1 from perfiles$$) = 0, 'no ve las personas del equipo');
select prueba.ok(prueba.cuenta($$select 1 from sedes$$) = 0 and prueba.cuenta($$select 1 from areas$$) = 0, 'no ve sedes ni áreas');
select prueba.ok(prueba.cuenta($$select 1 from configuracion$$) = 0, 'no ve la configuración');
select prueba.ok(prueba.cuenta($$select 1 from turnos$$) = 0 and prueba.cuenta($$select 1 from malla$$) = 0, 'no ve turnos ni malla');
select prueba.ok(prueba.cuenta($$select 1 from horario_base$$) = 0 and prueba.cuenta($$select 1 from horario_rotacion$$) = 0, 'no ve horarios');
select prueba.ok(prueba.cuenta($$select 1 from malla_efectiva('2026-01-01', '2026-12-31')$$) = 0, 'malla_efectiva no le devuelve nada');
select prueba.ok(prueba.cuenta($$select 1 from grupos$$) = 0 and prueba.cuenta($$select 1 from comunicados$$) = 0, 'no ve grupos ni comunicados');
select prueba.ok(prueba.cuenta($$select 1 from ventas_informe$$) = 0, 'no ve los informes de gestión');
select prueba.ok(prueba.cuenta($$select 1 from solicitudes$$) = 0 and prueba.cuenta($$select 1 from marcas$$) = 0, 'no ve solicitudes ni marcas');
select prueba.falla($$select marcar('entrada', null)$$, 'no puede marcar asistencia');
select prueba.ok(not es_activo() and not es_gerencia(), 'no cuenta como personal');

\echo '--- El personal sigue viendo lo suyo'
select prueba.como('Colab Ventas');
select prueba.ok(prueba.cuenta($$select 1 from perfiles$$) > 1, 'un colaborador sigue viendo al equipo');
select prueba.ok(prueba.cuenta($$select 1 from turnos$$) > 0, 'y los turnos');
select prueba.ok(prueba.cuenta($$select 1 from ventas_cliente$$) = 0, 'un colaborador no ve ventas de clientes');
select prueba.ok(mi_cuenta_cliente() is null, 'para el personal no hay cuenta de cliente');

\echo '--- Desactivar el acceso'
select prueba.como('Directora Bogotá');
select prueba.falla($$select activar_cuenta_cliente('cli-r', false)$$, 'una directora no desactiva clientes');
select prueba.como('Gerencia Admin');
select activar_cuenta_cliente('cli-r', false);
select prueba.como_cliente(1);
select prueba.ok(prueba.cuenta($$select 1 from ventas_cliente$$) = 0, 'desactivado, Ricardo ya no ve nada');
select prueba.ok((mi_cuenta_cliente()) ->> 'activo' = 'false', 'y al entrar se le dice que su acceso está desactivado');
select prueba.como('Gerencia Admin');
select activar_cuenta_cliente('cli-r', true);
select prueba.como_cliente(1);
select prueba.ok(prueba.cuenta($$select 1 from ventas_cliente$$) = 2, 'reactivado, vuelve a ver sus ventas');
select prueba.como_cliente(3);
select prueba.ok(prueba.cuenta($$select 1 from ventas_cliente$$) = 0 and mi_cuenta_cliente() is null, 'una sesión sin cuenta de cliente no ve nada');
reset role;

\echo '=== 07_extranet: todo OK'
