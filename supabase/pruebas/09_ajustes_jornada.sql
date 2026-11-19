-- =====================================================================
-- Pruebas de la entrada temprana autorizada (021). Correr después de 08.
-- «Colab Otra Sede» tiene hoy el turno M (7:00 a 16:00) en la Sede de prueba.
-- =====================================================================

\pset pager off
set client_min_messages = notice;

reset role;
create function prueba.hoy_sede() returns date language sql stable as $$
  select (now() at time zone 'America/Bogota')::date
$$;
create function prueba.a_las(h time) returns timestamptz language sql stable as $$
  select (prueba.hoy_sede() + h) at time zone 'America/Bogota'
$$;
grant execute on all functions in schema prueba to authenticated, anon;

delete from marcas where persona_id in (prueba.id('Colab Otra Sede'), prueba.id('Colab Ventas')) and fecha = prueba.hoy_sede();
delete from malla where persona_id in (prueba.id('Colab Otra Sede'), prueba.id('Colab Ventas')) and fecha = prueba.hoy_sede();
insert into malla (persona_id, fecha, turno_id)
select p, prueba.hoy_sede(), (select id from turnos where sede_id = 2 and codigo = 'M')
from unnest(array[prueba.id('Colab Otra Sede')]) p;

\echo '--- Tolerancias nuevas'
select prueba.ok((select (valor ->> 'salida_min')::int = 5 and (valor ->> 'temprano_min')::int = 30 and (valor ->> 'entrada_min')::int = 5 from configuracion where clave = 'tolerancias'), 'tolerancias: salida 5 min y entrada temprana 30 min, sin tocar las existentes');

\echo '--- Reglas'
select prueba.como('Colab Otra Sede');
select prueba.falla($$select ajustar_jornada('Me dieron permiso', '15:00', prueba.id('Directora Otra Sede'))$$, 'sin marcar la entrada no hay ajuste');
reset role;
insert into marcas (persona_id, fecha, tipo, hora) values (prueba.id('Colab Otra Sede'), prueba.hoy_sede(), 'entrada', prueba.a_las('06:45'));
select prueba.como('Colab Otra Sede');
select prueba.falla($$select ajustar_jornada('Me dieron permiso', '15:00', prueba.id('Directora Otra Sede'))$$, 'entrar solo 15 min antes no alcanza para pedir ajuste');
reset role;
update marcas set hora = prueba.a_las('06:00') where persona_id = prueba.id('Colab Otra Sede') and fecha = prueba.hoy_sede() and tipo = 'entrada';
select prueba.como('Colab Otra Sede');
select prueba.falla($$select ajustar_jornada('', '15:00', prueba.id('Directora Otra Sede'))$$, 'el motivo es obligatorio');
select prueba.falla($$select ajustar_jornada('Me dieron permiso', '15:00', prueba.id('Colab Ventas'))$$, 'un colaborador no puede figurar como quien autorizó');
select prueba.falla($$select ajustar_jornada('Me dieron permiso', '15:00', auth.uid())$$, 'nadie se autoriza a sí mismo');
select prueba.falla($$select ajustar_jornada('Me dieron permiso', '05:30', prueba.id('Directora Otra Sede'))$$, 'la nueva salida no puede ser antes de la entrada');
select prueba.falla($$insert into ajustes_jornada (persona_id, fecha, motivo, autorizo) values (auth.uid(), prueba.hoy_sede(), 'directo', prueba.id('Directora Otra Sede'))$$, 'no se inserta directo, solo con ajustar_jornada()');

\echo '--- Registrar y corregir'
select prueba.ok((ajustar_jornada('Inventario temprano', '15:00', prueba.id('Directora Otra Sede'))).salida = '15:00', 'entró 1 h antes: registra el motivo, la nueva salida y quién autorizó');
select prueba.ok((ajustar_jornada('Inventario temprano', null, prueba.id('Gerencia Admin'))).salida is null, 'lo puede corregir (salida igual a la del turno, autorizó otra persona)');
select prueba.ok(prueba.cuenta($$select 1 from ajustes_jornada$$) = 1, 'queda un solo ajuste por día');
select prueba.ok(prueba.filas($$delete from ajustes_jornada$$) = 0, 'la persona no borra su ajuste');
select ajustar_jornada('Inventario temprano', '15:00', prueba.id('Directora Otra Sede'));

\echo '--- Quién lo ve'
select prueba.como('Directora Otra Sede');
select prueba.ok(prueba.cuenta($$select 1 from ajustes_jornada$$) = 1, 'la líder de la sede lo ve');
select prueba.como('Directora Bogotá');
select prueba.ok(prueba.cuenta($$select 1 from ajustes_jornada$$) = 0, 'la líder de otra sede no lo ve');
select prueba.como('Colab Ventas');
select prueba.ok(prueba.cuenta($$select 1 from ajustes_jornada$$) = 0, 'otro colaborador no lo ve');
select prueba.como('Gerencia Admin');
select prueba.ok(prueba.cuenta($$select 1 from ajustes_jornada$$) = 1, 'la gerencia lo ve');

\echo '--- Después de la salida'
reset role;
insert into marcas (persona_id, fecha, tipo, hora) values (prueba.id('Colab Otra Sede'), prueba.hoy_sede(), 'salida', prueba.a_las('15:02'));
select prueba.como('Colab Otra Sede');
select prueba.falla($$select ajustar_jornada('Otro motivo', '14:00', prueba.id('Directora Otra Sede'))$$, 'con la salida marcada ya no se cambia');
select prueba.como('Directora Otra Sede');
select prueba.ok(prueba.filas($$delete from ajustes_jornada$$) = 1, 'la líder de la sede puede quitar un ajuste que no autorizó nadie');

\echo '--- Solo el cargo de gerente ve todo (022)'
reset role;
update perfiles set es_admin = true where nombre = 'Directora Bogotá';
select prueba.como('Directora Bogotá');
select prueba.ok(es_admin() and not es_gerencia(), 'una directora con administración NO es gerencia');
select prueba.ok(not lidera_sede(sede_de(prueba.id('Colab Otra Sede'))), 'ni lidera otras sedes');
select prueba.ok(prueba.cuenta($$select 1 from tc_tarjetas$$) = 0 and prueba.cuenta($$select 1 from ventas_informe$$) = 0 and prueba.cuenta($$select 1 from equipos where sede_id <> (select sede_id from perfiles where id = auth.uid())$$) = 0, 'no ve tarjeta, gestión ni equipos de otras sedes');
select prueba.falla($$select pedir_actualizacion_ventas()$$, 'no puede pedir la actualización de gestión');
select prueba.como('Gerencia Admin');
select prueba.ok(es_gerencia(), 'el gerente sí es gerencia');
reset role;
update perfiles set es_admin = false where nombre = 'Directora Bogotá';
