-- =====================================================================
-- Pruebas del registro de envíos del informe de la tarjeta (024).
-- Correr después de 04 (usa su tarjeta y su extracto).
-- =====================================================================

\pset pager off
set client_min_messages = notice;

\echo '--- Envíos del informe: solo el servidor escribe'
select prueba.como('Gerencia Admin');
select prueba.falla($$insert into tc_envios (extracto_id, destinatarios, asunto, estado_extracto) select max(id), array['x@ejemplo.com'], 'Informe', 'abierto' from tc_extractos$$, 'la gerencia no registra envíos a mano (los registra la Edge Function)');
reset role;
select prueba.ok(has_table_privilege('service_role', 'tc_envios', 'insert'), 'el servidor (service_role) puede registrar envíos');
select prueba.ok(not has_table_privilege('authenticated', 'tc_envios', 'insert') and not has_table_privilege('authenticated', 'tc_envios', 'update') and not has_table_privilege('authenticated', 'tc_envios', 'delete'), 'una sesión normal no escribe en tc_envios');
-- Como lo haría la Edge Function con la llave de servicio
insert into tc_envios (extracto_id, enviado_por, destinatarios, asunto, estado_extracto, avance)
select max(e.id), prueba.id('Gerencia Admin'), array['financiero@agenciacaminos.com.co', 'director@agenciacaminos.com.co'], 'Conciliación Visa ···4821', 'abierto', 80 from tc_extractos e;
select prueba.ok((select count(*) from tc_envios) = 1, 'queda registrado el envío');
select prueba.falla($$insert into tc_envios (extracto_id, destinatarios, asunto, estado_extracto) select max(id), '{}', 'Informe', 'abierto' from tc_extractos$$, 'un envío necesita al menos un destinatario');

\echo '--- Quién ve los envíos'
select prueba.como('Gerencia Admin');
select prueba.ok(prueba.cuenta($$select 1 from tc_envios$$) = 1, 'la gerencia ve el último envío');
select prueba.falla($$update tc_envios set asunto = 'Otro'$$, 'la gerencia no cambia un envío registrado');
select prueba.falla($$delete from tc_envios$$, 'la gerencia no borra el registro de envíos');
select prueba.como('Directora Bogotá');
select prueba.ok(prueba.cuenta($$select 1 from tc_envios$$) = 0, 'la directora no ve los envíos de la tarjeta');
select prueba.como('Colab Ventas');
select prueba.ok(prueba.cuenta($$select 1 from tc_envios$$) = 0, 'un colaborador no ve los envíos de la tarjeta');
reset role;
set role anon;
select prueba.falla($$select 1 from tc_envios$$, 'anon no lee los envíos');
reset role;

\echo '=== 11_informe_tarjeta: todo OK'
