-- =====================================================================
-- Pruebas del horario que rota por semanas (015). Correr después de 01 a 04.
-- =====================================================================

\pset pager off
set client_min_messages = notice;

\echo '--- Horario rotativo'
reset role;
update configuracion set valor = '{"fecha": "2030-01-01"}' where clave = 'inicio_horarios';
select prueba.como('Colab Operaciones');
select prueba.falla($$insert into horario_rotacion (persona_id, semanas, desde) values (auth.uid(), 2, '2030-01-07')$$, 'un colaborador no pone su propia rotación');

select prueba.como('Directora Bogotá');
select prueba.falla($$insert into horario_rotacion (persona_id, semanas, desde) values (prueba.id('Colab Operaciones'), 2, '2030-01-08')$$, 'la semana A empieza un lunes');
select prueba.falla($$insert into horario_rotacion (persona_id, semanas, desde) values (prueba.id('Colab Operaciones'), 5, '2030-01-07')$$, 'el ciclo tiene de 2 a 4 semanas');
select prueba.ok(prueba.filas($$insert into horario_rotacion (persona_id, semanas, desde) values (prueba.id('Colab Operaciones'), 2, '2030-01-07')$$) = 1, 'la líder de la sede pone una rotación de dos semanas');
select prueba.ok(prueba.filas($$insert into horario_base (persona_id, semana, dia, turno_id) values
  (prueba.id('Colab Operaciones'), 1, 1, (select id from turnos where sede_id = 1 and codigo = 'M')),
  (prueba.id('Colab Operaciones'), 2, 1, (select id from turnos where sede_id = 1 and codigo = 'T'))$$) = 2, 'carga el lunes de la semana A y el de la semana B');
select prueba.falla($$insert into horario_base (persona_id, semana, dia, turno_id) values (prueba.id('Colab Operaciones'), 5, 1, (select id from turnos where sede_id = 1 and codigo = 'M'))$$, 'no hay semana 5');

select prueba.ok((select string_agg(t.codigo, ',' order by m.fecha) from malla_efectiva('2030-01-07', '2030-02-04') m join turnos t on t.id = m.turno_id
                  where m.persona_id = prueba.id('Colab Operaciones') and extract(isodow from m.fecha) = 1) = 'M,T,M,T,M', 'los lunes alternan: semana A, B, A, B, A');
select prueba.ok((select t.codigo from malla_efectiva('2029-12-31', '2029-12-31') m join turnos t on t.id = m.turno_id where m.persona_id = prueba.id('Colab Operaciones')) is null, 'antes del inicio de horarios no hay malla');
reset role;
update configuracion set valor = '{"fecha": "2029-12-01"}' where clave = 'inicio_horarios';
select prueba.como('Directora Bogotá');
select prueba.ok((select t.codigo from malla_efectiva('2029-12-31', '2029-12-31') m join turnos t on t.id = m.turno_id where m.persona_id = prueba.id('Colab Operaciones')) = 'T', 'hacia atrás también alterna (la semana anterior a la A es B)');
select prueba.ok((select t.codigo from malla_efectiva('2030-01-08', '2030-01-08') m join turnos t on t.id = m.turno_id where m.persona_id = prueba.id('Colab Operaciones')) = 'D', 'un día sin turno en esa semana es Descanso');

insert into malla (persona_id, fecha, turno_id) values (prueba.id('Colab Operaciones'), '2030-01-14', (select id from turnos where sede_id = 1 and codigo = 'V'));
select prueba.ok((select t.codigo from malla_efectiva('2030-01-14', '2030-01-14') m join turnos t on t.id = m.turno_id where m.persona_id = prueba.id('Colab Operaciones')) = 'V', 'un cambio puntual sigue mandando sobre la rotación');

select prueba.como('Colab Ventas');
select prueba.ok(prueba.cuenta($$select 1 from horario_rotacion$$) = 1, 'el equipo ve las rotaciones (como el horario fijo)');
select prueba.ok(prueba.filas($$delete from horario_rotacion$$) = 0, 'un colaborador no quita rotaciones');

select prueba.como('Directora Bogotá');
select prueba.ok(prueba.filas($$delete from horario_rotacion where persona_id = prueba.id('Colab Operaciones')$$) = 1, 'la líder quita la rotación');
select prueba.ok((select string_agg(t.codigo, ',' order by m.fecha) from malla_efectiva('2030-01-21', '2030-01-28') m join turnos t on t.id = m.turno_id
                  where m.persona_id = prueba.id('Colab Operaciones') and extract(isodow from m.fecha) = 1) = 'M,M', 'sin rotación vuelve a usar solo la semana A');
reset role;
delete from malla where persona_id = prueba.id('Colab Operaciones') and fecha = '2030-01-14';
delete from horario_base where persona_id = prueba.id('Colab Operaciones');

\echo '=== 05_rotacion: todo OK'
