-- =====================================================================
-- Pruebas de los informes de gestión (016). Correr después de 01 a 05.
-- =====================================================================

\pset pager off
set client_min_messages = notice;

\echo '--- Clave del script de ventas'
select prueba.como('Directora Bogotá');
select prueba.falla($$select nueva_clave_ventas()$$, 'una directora no crea la clave de los informes');
select prueba.como('Gerencia Admin');
reset role;
create temp table clave_ventas (c text);
grant select, insert on clave_ventas to anon, authenticated;
select prueba.como('Gerencia Admin');
insert into clave_ventas select nueva_clave_ventas();
select prueba.ok((select length(c) = 48 from clave_ventas), 'la administración crea la clave (se ve una sola vez)');
select prueba.falla($$select * from ventas_clave$$, 'ni la administración lee la huella de la clave');

\echo '--- El script sincroniza con la clave'
reset role;
set role anon;
select prueba.falla($$select sincronizar_ventas('mala', '[]')$$, 'con una clave falsa no entra');
select prueba.falla($$select * from ventas_informe$$, 'sin sesión no se leen las ventas');
select prueba.falla($$insert into ventas_informe (id, fecha, estado) values ('x', current_date, 'Cotizado')$$, 'sin sesión no se escriben ventas a mano');
select prueba.ok(sincronizar_ventas((select c from clave_ventas), $$[
  {"id":"v1","asesora":"Andrea","fecha":"2026-09-02","estado":"Facturado","tipo_venta":"Religioso","tipo_viaje":"NACIONAL","destino":"Pasto","salida":"2026-09-21","pasajeros":2,"valor":1000000,"costo":800000,"cobrado":1000000,"servicios":[{"tipo":"Vuelo","valor":600000,"costo":500000}]},
  {"id":"v2","asesora":"Paola","fecha":"2026-10-05","estado":"Cancelada","valor":500000,"costo":400000,"seguimiento":"Lo encontró más económico"},
  {"id":"v3","asesora":"Paola","fecha":"2026-10-06","estado":"Cotizado"}
]$$::jsonb) = 3, 'el script manda tres ventas');
select prueba.falla($$select sincronizar_ventas((select c from clave_ventas), '[{"id":"v9","fecha":"no-es-fecha","estado":"Cotizado"}]')$$, 'una fila mala no cambia nada');
select prueba.falla($$select sincronizar_ventas((select c from clave_ventas), '{"id":"v9"}')$$, 'tiene que ser una lista');
reset role;
select prueba.ok((select count(*) = 3 from ventas_informe), 'tras el error siguen las tres ventas');

\echo '--- Quién ve los informes'
select prueba.como('Gerencia Admin');
select prueba.ok(prueba.cuenta($$select 1 from ventas_informe$$) = 3, 'la gerencia ve las ventas');
select prueba.ok((select filas = 3 and sincronizado is not null and clave_creada is not null from ventas_estado), 'la gerencia ve cuándo se sincronizó');
select prueba.falla($$update ventas_informe set valor = 1$$, 'ni la gerencia cambia ventas a mano (vienen de la hoja)');
select prueba.falla($$delete from ventas_informe where true$$, 'ni la gerencia quita ventas a mano');
select prueba.como('Directora Bogotá');
select prueba.ok(prueba.cuenta($$select 1 from ventas_informe$$) = 0, 'una directora sin administración no ve las ventas');
select prueba.como('Supervisor Contable');
select prueba.ok(prueba.cuenta($$select 1 from ventas_informe$$) = 0 and prueba.cuenta($$select 1 from ventas_estado$$) = 0, 'el supervisor no ve las ventas');
select prueba.como('Colab Ventas');
select prueba.ok(prueba.cuenta($$select 1 from ventas_informe$$) = 0, 'un colaborador no ve las ventas');

\echo '--- La hoja manda: cambios y ventas que desaparecen'
reset role;
set role anon;
select prueba.ok(sincronizar_ventas((select c from clave_ventas), $$[
  {"id":"v1","asesora":"Andrea","fecha":"2026-09-02","estado":"Facturado","valor":1200000,"costo":800000},
  {"id":"v3","asesora":"Paola","fecha":"2026-10-06","estado":"Confirmada","valor":300000}
]$$::jsonb) = 2, 'segunda vuelta con dos ventas');
reset role;
select prueba.ok((select valor = 1200000 from ventas_informe where id = 'v1'), 'un cambio en la hoja llega al informe');
select prueba.ok((select estado = 'Confirmada' from ventas_informe where id = 'v3'), 'un cambio de estado llega al informe');
select prueba.ok(not exists (select 1 from ventas_informe where id = 'v2'), 'la venta que ya no está en la hoja sale del informe');

\echo '--- Una clave nueva anula la anterior'
select prueba.como('Gerencia Admin');
select length(nueva_clave_ventas()) as clave_nueva;
reset role;
set role anon;
select prueba.falla($$select sincronizar_ventas((select c from clave_ventas), '[]')$$, 'la clave vieja deja de servir');
reset role;

\echo '--- Carga directa (tarea diaria): solo el servidor'
set role anon;
select prueba.falla($$select aplicar_ventas('[]')$$, 'sin sesión no se llama aplicar_ventas');
reset role;
select prueba.como('Gerencia Admin');
select prueba.falla($$select aplicar_ventas('[]')$$, 'ni la administración llama aplicar_ventas desde la intranet');
reset role;
select prueba.ok(aplicar_ventas($$[{"id":"v1","asesora":"Andrea","fecha":"2026-09-02","estado":"Facturado","valor":1500000,"costo":800000}]$$::jsonb) = 1, 'el servidor (postgres) carga las ventas directamente');
select prueba.ok((select count(*) = 1 and sum(valor) = 1500000 from ventas_informe), 'la carga directa también reemplaza el resumen');
select prueba.ok((select filas = 1 from ventas_estado), 'y deja la hora y el número de ventas');

\echo '=== 06_informes_gestion: todo OK'
