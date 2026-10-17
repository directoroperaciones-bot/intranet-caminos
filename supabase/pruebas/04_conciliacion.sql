-- =====================================================================
-- Pruebas de la conciliación de la tarjeta (011). Correr después de 01 a 03
-- (usa sus ayudas y sus personas de prueba).
-- =====================================================================

\pset pager off
set client_min_messages = notice;

\echo '--- Conciliación: solo la gerencia'
select prueba.como('Gerencia Admin');
insert into tc_tarjetas (nombre, banco, franquicia, ultimos4, titular, cupo)
values ('Visa empresarial', 'Banco de prueba', 'Visa', '4821', 'Caminos', 30000000);
select prueba.falla($$insert into tc_tarjetas (nombre, ultimos4) values ('Mal', '4111111111111111')$$, 'de la tarjeta solo se guardan los últimos 4 dígitos');
insert into tc_extractos (tarjeta_id, desde, hasta, fecha_pago, saldo_anterior, saldo_nuevo)
select id, '2026-09-16', '2026-10-15', '2026-10-30', 1000000, 1350000 from tc_tarjetas;
select prueba.falla($$insert into tc_extractos (tarjeta_id, desde, hasta) select id, '2026-10-15', '2026-09-16' from tc_tarjetas$$, 'el corte no puede ser antes del inicio');
insert into tc_registros (tarjeta_id, fecha, descripcion, valor, categoria_id)
select t.id, '2026-09-20', 'Tiquetes grupo Fátima', 800000, (select id from tc_categorias where nombre = 'Tiquetes aéreos') from tc_tarjetas t;
insert into tc_movimientos (extracto_id, fecha, descripcion, valor, tipo)
select e.id, x.f::date, x.d, x.v, x.t::tc_tipo_t from tc_extractos e, (values
  ('2026-09-21', 'AEROLINEA BOGOTA', 800000, 'compra'),
  ('2026-09-25', 'TIENDA DESCONOCIDA', 250000, 'compra'),
  ('2026-10-01', 'PAGO SUCURSAL VIRTUAL', -1000000, 'pago'),
  ('2026-10-15', 'INTERESES CORRIENTES', 300000, 'interes')
) x(f, d, v, t);
select prueba.ok(prueba.cuenta($$select 1 from tc_movimientos$$) = 4, 'la gerencia carga los movimientos del extracto');
select prueba.falla($$insert into tc_movimientos (extracto_id, fecha, descripcion, valor) select id, current_date, 'Cero', 0 from tc_extractos$$, 'un movimiento no puede valer cero');
select prueba.ok((select sum(valor) + 1000000 = 1350000 from tc_movimientos), 'saldo anterior + movimientos = total del extracto (cuadra)');

\echo '--- Nadie más ve ni toca la tarjeta'
select prueba.como('Directora Bogotá');
select prueba.ok(prueba.cuenta($$select 1 from tc_movimientos$$) = 0 and prueba.cuenta($$select 1 from tc_tarjetas$$) = 0, 'una directora no ve la tarjeta ni sus movimientos');
select prueba.ok(prueba.filas($$update tc_movimientos set estado = 'conciliado'$$) = 0, 'una directora no concilia');
select prueba.como('Supervisor Contable');
select prueba.ok(prueba.cuenta($$select 1 from tc_registros$$) = 0, 'el supervisor no ve los registros');
select prueba.falla($$insert into tc_tarjetas (nombre, ultimos4) values ('Otra', '1234')$$, 'el supervisor no crea tarjetas');
select prueba.falla($$select cerrar_extracto((select max(id) from tc_extractos))$$, 'el supervisor no cierra conciliaciones');
select prueba.como('Colab Ventas');
select prueba.ok(prueba.cuenta($$select 1 from tc_extractos$$) = 0, 'un colaborador no ve los extractos');
select prueba.falla($$insert into storage.objects (bucket_id, name) values ('conciliacion', '1/factura.pdf')$$, 'un colaborador no sube soportes de la tarjeta');

\echo '--- Conciliar'
select prueba.como('Gerencia Admin');
select prueba.ok(prueba.filas($$update tc_movimientos set estado = 'conciliado', registro_id = (select id from tc_registros limit 1), categoria_id = (select id from tc_categorias where nombre = 'Tiquetes aéreos') where descripcion = 'AEROLINEA BOGOTA'$$) = 1, 'cruza el cargo con el registro de la agencia');
select prueba.ok((select conciliado_por = auth.uid() and conciliado_en is not null from tc_movimientos where descripcion = 'AEROLINEA BOGOTA'), 'queda quién y cuándo concilió');
select prueba.falla($$update tc_movimientos set registro_id = (select id from tc_registros limit 1) where descripcion = 'TIENDA DESCONOCIDA'$$, 'un registro no se cruza con dos cargos');
select prueba.ok(prueba.filas($$update tc_movimientos set estado = 'no_reconocido', nota = 'Reclamo al banco' where descripcion = 'TIENDA DESCONOCIDA'$$) = 1, 'marca un cargo como no reconocido');
select prueba.ok(prueba.filas($$insert into storage.objects (bucket_id, name) values ('conciliacion', '1/factura.pdf')$$) = 1, 'la gerencia sube el soporte');
select prueba.falla($$select cerrar_extracto((select max(id) from tc_extractos))$$, 'no se cierra con movimientos pendientes');
update tc_movimientos set estado = 'conciliado' where estado = 'pendiente';
select prueba.ok((cerrar_extracto((select max(id) from tc_extractos))).estado = 'cerrado', 'sin pendientes, se cierra');

\echo '--- Periodo cerrado'
select prueba.falla($$update tc_movimientos set nota = 'cambio' where descripcion = 'PAGO SUCURSAL VIRTUAL'$$, 'cerrado, no se editan movimientos');
select prueba.falla($$insert into tc_movimientos (extracto_id, fecha, descripcion, valor) select id, current_date, 'Tarde', 1000 from tc_extractos$$, 'cerrado, no se agregan movimientos');
select prueba.falla($$delete from tc_movimientos$$, 'cerrado, no se borran movimientos');
select prueba.falla($$update tc_extractos set saldo_nuevo = 1$$, 'cerrado, no cambia el extracto');
select prueba.falla($$update tc_extractos set estado = 'abierto'$$, 'el estado solo cambia con «Reabrir»');
select prueba.falla($$delete from tc_extractos$$, 'un extracto cerrado no se borra');
reset role;
delete from tc_categorias where nombre = 'Tiquetes aéreos';
select prueba.ok((select categoria_id is null from tc_movimientos where descripcion = 'AEROLINEA BOGOTA'), 'borrar una categoría usada en un periodo cerrado no falla (queda sin categoría)');
select prueba.como('Gerencia Admin');
select prueba.ok((reabrir_extracto((select max(id) from tc_extractos))).estado = 'abierto', 'la gerencia reabre la conciliación');
select prueba.ok(prueba.filas($$update tc_movimientos set nota = 'corregido' where descripcion = 'PAGO SUCURSAL VIRTUAL'$$) = 1, 'reabierta, se puede corregir');
select prueba.ok((select conciliado_por is not null from tc_movimientos where descripcion = 'PAGO SUCURSAL VIRTUAL'), 'cambiar la nota no borra quién concilió');
update tc_movimientos set estado = 'pendiente' where descripcion = 'PAGO SUCURSAL VIRTUAL';
select prueba.ok((select conciliado_por is null and conciliado_en is null from tc_movimientos where descripcion = 'PAGO SUCURSAL VIRTUAL'), 'volver a pendiente borra quién concilió');

\echo '--- Sin sesión (anon)'
reset role;
set role anon;
select prueba.falla($$select 1 from tc_movimientos$$, 'anon no lee movimientos');
select prueba.falla($$select cerrar_extracto(1)$$, 'anon no cierra conciliaciones');
reset role;

\echo '=== 04_conciliacion: todo OK'
