-- =====================================================================
-- Pruebas de las cuentas de cobro de aliados (020). Correr después de 07.
-- =====================================================================

\pset pager off
set client_min_messages = notice;

reset role;
select aplicar_extranet(
  $$[{"id":"cli-r","nombre":"Ricardo Aliado","correo":"ricardo@aliado.example","tipo":"Freelance","pct_terrestre":0.1,"part_ta":0.5,"modalidad":"Retorno","nit":"79.000.000-1","banco":"Banco Ejemplo","tipo_cuenta":"Ahorros","numero_cuenta":"123"},
     {"id":"cli-p","nombre":"Parroquia San José","correo":"parroquia@ejemplo.example","tipo":"PARROQUIA"}]$$,
  $$[{"id":"vr1","cliente_id":"cli-r","fecha":"2026-09-01","estado":"Facturado","destino":"Punta Cana","valor":5000000,"comision":120000,"codigo":"CA1001","factura":"FE-10","fecha_factura":"2026-10-05"},
     {"id":"vr2","cliente_id":"cli-r","fecha":"2026-09-10","estado":"Facturado","destino":"Cartagena","valor":2000000,"comision":80000,"codigo":"CA1002","factura":"FE-11","fecha_factura":"2026-10-20"},
     {"id":"vr3","cliente_id":"cli-r","fecha":"2026-10-01","estado":"Confirmada","destino":"Cancún","valor":9000000,"comision":200000,"codigo":"CA1003"},
     {"id":"vr4","cliente_id":"cli-r","fecha":"2026-10-02","estado":"Facturado","destino":"Lima","valor":3000000,"comision":90000,"codigo":"CA1004","factura":"FE-12","fecha_factura":"2026-10-21","modalidad":"Descuento"},
     {"id":"vr5","cliente_id":"cli-r","fecha":"2026-08-01","estado":"Facturado","destino":"Panamá","valor":1000000,"comision":30000,"codigo":"CA1005","factura":"FE-05","fecha_factura":"2026-08-10"},
     {"id":"vp1","cliente_id":"cli-p","fecha":"2026-10-03","estado":"Facturado","destino":"Pasto","valor":30000000,"comision":50000,"codigo":"CA2001","factura":"FE-20","fecha_factura":"2026-10-04"}]$$,
  '[]');

\echo '--- Quién puede generar'
select prueba.como('Colab Ventas');
select prueba.falla($$select generar_cuenta_cobro('cli-r', '2026-10-01', '2026-10-31', array['vr1'])$$, 'un colaborador no genera cuentas de cobro');
select prueba.como_cliente(2);
select prueba.falla($$select generar_cuenta_cobro('cli-r', '2026-10-01', '2026-10-31', array['vr1'])$$, 'un cliente no genera cuentas de otro cliente');

\echo '--- Reglas de la plantilla'
select prueba.como_cliente(1);
select prueba.falla($$select generar_cuenta_cobro('cli-r', '2026-10-01', '2026-10-31', array['vr3'])$$, 'una venta sin factura no entra');
select prueba.falla($$select generar_cuenta_cobro('cli-r', '2026-10-01', '2026-10-31', array['vr4'])$$, 'una venta en modalidad Descuento no entra');
select prueba.falla($$select generar_cuenta_cobro('cli-r', '2026-10-01', '2026-10-31', array['vr5'])$$, 'una venta facturada fuera del periodo no entra');
select prueba.falla($$select generar_cuenta_cobro('cli-r', '2026-10-01', '2026-10-31', array['vp1'])$$, 'una venta de otro cliente no entra');
select prueba.falla($$select generar_cuenta_cobro('cli-r', '2026-10-31', '2026-10-01', array['vr1'])$$, 'el corte no puede ser antes del inicio');
select prueba.falla($$select generar_cuenta_cobro('cli-r', '2026-10-01', '2099-10-31', array['vr1'])$$, 'el corte no puede ser futuro');
select prueba.falla($$select generar_cuenta_cobro('cli-r', '2026-10-01', '2026-10-31', array[]::text[])$$, 'hay que elegir al menos una venta');

\echo '--- El aliado genera una con varias ventas'
select prueba.ok((generar_cuenta_cobro('cli-r', '2026-10-01', '2026-10-31', array['vr1', 'vr2'])) ->> 'total' = '200000.00', 'el aliado genera una cuenta de cobro con dos ventas (total = suma de comisiones)');
select prueba.ok((select numero like 'CC-202610-%' and ventas = 2 and origen = 'aliado' and estado = 'generada' from cuentas_cobro), 'queda numerada con el periodo y marcada como del aliado');
select prueba.ok((select datos -> 'cliente' ->> 'nit' = '79.000.000-1' and jsonb_array_length(datos -> 'lineas') = 2 from cuentas_cobro), 'guarda la foto del aliado y de las ventas');
select prueba.falla($$select generar_cuenta_cobro('cli-r', '2026-10-01', '2026-10-31', array['vr1'])$$, 'una venta ya cobrada no se cobra otra vez');
select prueba.falla($$select estado_cuenta_cobro((select id from cuentas_cobro limit 1), 'pagada')$$, 'el aliado no marca su cuenta como pagada');
select prueba.como_cliente(2);
select prueba.ok(prueba.cuenta($$select 1 from cuentas_cobro$$) = 0, 'otro cliente no ve esa cuenta de cobro');

\echo '--- La gerencia'
select prueba.como('Gerencia Admin');
select prueba.ok(prueba.cuenta($$select 1 from cuentas_cobro$$) = 1, 'la gerencia ve las cuentas de cobro');
select estado_cuenta_cobro((select id from cuentas_cobro limit 1), 'enviada');
select prueba.como_cliente(1);
select prueba.falla($$select estado_cuenta_cobro((select id from cuentas_cobro limit 1), 'anulada')$$, 'el aliado ya no anula una cuenta enviada');
select prueba.como('Gerencia Admin');
select estado_cuenta_cobro((select id from cuentas_cobro limit 1), 'anulada');
select prueba.ok(not exists (select 1 from cuentas_cobro_ventas), 'anular libera las ventas');
select prueba.ok((generar_cuenta_cobro('cli-r', '2026-10-01', '2026-10-31', array['vr1'])) ->> 'ventas' = '1', 'la gerencia genera una nueva con una venta liberada');
select prueba.ok((select origen = 'caminos' from cuentas_cobro where estado = 'generada'), 'queda marcada como generada por Caminos');
select estado_cuenta_cobro((select id from cuentas_cobro where estado = 'generada'), 'pagada');
select prueba.falla($$select estado_cuenta_cobro((select id from cuentas_cobro where estado = 'pagada'), 'anulada')$$, 'una cuenta pagada ya no cambia');
select prueba.falla($$insert into cuentas_cobro (numero, cliente_id, desde, hasta, total, ventas, origen, datos) values ('x', 'cli-r', current_date, current_date, 1, 1, 'caminos', '{}')$$, 'nadie inserta cuentas a mano');
reset role;
set role anon;
select prueba.falla($$select generar_cuenta_cobro('cli-r', '2026-10-01', '2026-10-31', array['vr2'])$$, 'sin sesión no se genera nada');
reset role;

\echo '=== 08_cuentas_cobro: todo OK'
