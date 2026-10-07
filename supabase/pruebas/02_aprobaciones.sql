-- =====================================================================
-- Pruebas de solicitudes y aprobaciones. Correr después de 01_permisos.sql
-- (usa sus ayudas y sus personas de prueba).
-- =====================================================================

\pset pager off

create function prueba.sol(persona text, t solicitud_tipo_t) returns bigint
language sql stable security definer set search_path = public as $$
  select s.id from solicitudes s join perfiles p on p.id = s.persona_id
  where p.nombre = persona and s.tipo = t order by s.id desc limit 1
$$;
grant execute on function prueba.sol(text, solicitud_tipo_t) to authenticated;

-- Revisor: Colab Operaciones aprueba incapacidades de todas las sedes;
-- Directora Otra Sede solo ve vacaciones de su sede.
reset role;
insert into revisores (persona_id, sede_id, tipos, nivel) values
  (prueba.id('Colab Operaciones'), null, '{incapacidad}', 'aprobar'),
  (prueba.id('Directora Otra Sede'), 2, '{vacaciones}', 'ver');

\echo '--- Módulo apagado'
select prueba.como('Colab Ventas');
select prueba.falla($$insert into solicitudes (persona_id, tipo, desde, hasta) values (auth.uid(), 'vacaciones', current_date + 10, current_date + 14)$$, 'con el módulo apagado no se crean solicitudes');

\echo '--- Activar el módulo'
select prueba.como('Directora Bogotá');
select prueba.ok(prueba.filas($$update configuracion set valor = '{"activo": true}' where clave = 'modulo_solicitudes'$$) = 0, 'una directora no activa el módulo');
select prueba.como('Gerencia Admin');
select prueba.ok(prueba.filas($$update configuracion set valor = '{"activo": true}' where clave = 'modulo_solicitudes'$$) = 1, 'la gerencia activa el módulo');

\echo '--- Crear'
select prueba.como('Colab Ventas');
select prueba.ok(prueba.filas($$insert into solicitudes (persona_id, tipo, desde, hasta, motivo) values (auth.uid(), 'vacaciones', current_date + 10, current_date + 14, 'Viaje familiar')$$) = 1, 'crea una solicitud de vacaciones');
select prueba.ok(prueba.filas($$insert into solicitudes (persona_id, tipo, desde, hasta, motivo) values (auth.uid(), 'incapacidad', current_date - 2, current_date - 1, 'Gripa')$$) = 1, 'crea una incapacidad');
select prueba.ok(prueba.filas($$insert into solicitudes (persona_id, tipo, desde, hasta, hora_desde, hora_hasta) values (auth.uid(), 'permiso', current_date + 3, current_date + 3, '14:00', '16:00')$$) = 1, 'crea un permiso por horas');
select prueba.ok(prueba.filas($$insert into solicitudes (persona_id, tipo, desde, hasta) values (auth.uid(), 'permiso', current_date + 60, current_date + 60) returning id$$) = 1, 'crear y devolver la fila, como hace la página (.insert().select())');
select prueba.ok(prueba.filas($$delete from solicitudes where persona_id = auth.uid() and desde = current_date + 60$$) = 1, 'y cancelarla');
select prueba.falla($$insert into solicitudes (persona_id, tipo, desde, hasta, estado) values (auth.uid(), 'permiso', current_date, current_date, 'aprobada')$$, 'no se crea una solicitud ya aprobada');
select prueba.falla($$insert into solicitudes (persona_id, tipo, desde, hasta) values (prueba.id('Colab Operaciones'), 'permiso', current_date, current_date)$$, 'no se crea a nombre de otra persona');
select prueba.falla($$insert into solicitudes (persona_id, tipo, desde, hasta, hora_desde) values (auth.uid(), 'permiso', current_date, current_date, '10:00')$$, 'las horas van las dos o ninguna');
select prueba.ok(prueba.filas($$insert into storage.objects (bucket_id, name) values ('soportes', prueba.sol('Colab Ventas', 'incapacidad') || '/1-incapacidad.pdf')$$) = 1, 'sube el soporte de su incapacidad pendiente');
select prueba.ok(prueba.filas($$insert into solicitud_adjuntos (solicitud_id, ruta, nombre, tipo_mime) values (prueba.sol('Colab Ventas', 'incapacidad'), prueba.sol('Colab Ventas', 'incapacidad') || '/1-incapacidad.pdf', 'incapacidad.pdf', 'application/pdf')$$) = 1, 'registra el adjunto');
select prueba.ok(prueba.filas($$update solicitudes set estado = 'aprobada' where persona_id = auth.uid()$$) = 0, 'nadie se aprueba con un update directo');

select prueba.como('Colab Otra Sede');
select prueba.ok(prueba.filas($$insert into solicitudes (persona_id, tipo, desde, hasta) values (auth.uid(), 'vacaciones', current_date + 20, current_date + 25)$$) = 1, 'en la otra sede también se crean');
select prueba.ok(prueba.cuenta($$select 1 from solicitudes$$) = 1, 'cada quien ve solo las suyas');
select prueba.falla($$insert into storage.objects (bucket_id, name) values ('soportes', prueba.sol('Colab Ventas', 'incapacidad') || '/2-ajeno.pdf')$$, 'no sube soportes a una solicitud ajena');

\echo '--- Revisor de incapacidades'
select prueba.como('Colab Operaciones');
select prueba.ok(prueba.cuenta($$select 1 from solicitudes$$) = 1, 'el revisor de incapacidades solo ve incapacidades');
select prueba.ok(prueba.cuenta($$select 1 from solicitud_adjuntos$$) = 1, 'y sus soportes');
select prueba.ok(prueba.cuenta($$select 1 from storage.objects where bucket_id = 'soportes'$$) = 1, 'y el archivo del soporte');
select prueba.falla($$select revisar_solicitud(prueba.sol('Colab Ventas', 'vacaciones'), true, null)$$, 'el revisor de incapacidades no aprueba vacaciones');
select prueba.ok((revisar_solicitud(prueba.sol('Colab Ventas', 'incapacidad'), true, 'Recuérdate entregar el original')).estado = 'aprobada', 'el revisor aprueba la incapacidad');
select prueba.falla($$select revisar_solicitud(prueba.sol('Colab Ventas', 'incapacidad'), false, null)$$, 'nadie revisa dos veces');
select prueba.ok(prueba.filas($$insert into solicitudes (persona_id, tipo, desde, hasta) values (auth.uid(), 'incapacidad', current_date, current_date)$$) = 1, 'el revisor crea su propia incapacidad');
select prueba.falla($$select revisar_solicitud(prueba.sol('Colab Operaciones', 'incapacidad'), true, null)$$, 'el revisor no aprueba la suya');

\echo '--- Revisor que solo ve'
select prueba.como('Directora Otra Sede');
select prueba.ok(prueba.cuenta($$select 1 from solicitudes$$) = 1, 've las vacaciones de su sede y nada más');
select prueba.falla($$select revisar_solicitud(prueba.sol('Colab Otra Sede', 'vacaciones'), true, null)$$, 'con nivel "ver" no aprueba');

\echo '--- Líder sin ser revisora'
select prueba.como('Directora Bogotá');
select prueba.ok(prueba.cuenta($$select 1 from solicitudes$$) = 0, 'la directora no ve solicitudes si no es revisora');
select prueba.falla($$select revisar_solicitud(prueba.sol('Colab Ventas', 'vacaciones'), true, null)$$, 'la directora no aprueba si no es revisora');
select prueba.ok(prueba.cuenta($$select 1 from ausencias_aprobadas(current_date - 30, current_date + 30) where persona_id = prueba.id('Colab Ventas')$$) = 1, 'pero ve las ausencias aprobadas de su sede (sin motivo)');

\echo '--- Gerencia'
select prueba.como('Gerencia Admin');
select prueba.ok(prueba.cuenta($$select 1 from solicitudes$$) = 5, 'la gerencia ve todas');
select prueba.ok((revisar_solicitud(prueba.sol('Colab Ventas', 'vacaciones'), true, null)).revisado_por = auth.uid(), 'la gerencia aprueba vacaciones y queda quién revisó');
select prueba.ok((revisar_solicitud(prueba.sol('Colab Ventas', 'permiso'), false, 'Ese día hay cierre')).estado = 'rechazada', 'la gerencia rechaza con comentario');

\echo '--- Ausencias aprobadas'
select prueba.como('Colab Ventas');
select prueba.ok(prueba.cuenta($$select 1 from ausencias_aprobadas(current_date - 30, current_date + 30)$$) = 2, 'la persona ve sus ausencias aprobadas (vacaciones e incapacidad)');
select prueba.como('Colab Otra Sede');
select prueba.ok(prueba.cuenta($$select 1 from ausencias_aprobadas(current_date - 30, current_date + 30)$$) = 0, 'otra persona no ve ausencias ajenas');
select prueba.como('Supervisor Contable');
select prueba.ok(prueba.cuenta($$select 1 from ausencias_aprobadas(current_date - 30, current_date + 30)$$) = 0, 'el supervisor no ve ausencias ajenas');

\echo '--- Cancelar'
select prueba.como('Colab Ventas');
select prueba.ok(prueba.filas($$delete from solicitudes where tipo = 'vacaciones' and persona_id = auth.uid()$$) = 0, 'no se cancela una solicitud ya aprobada');
select prueba.como('Colab Otra Sede');
select prueba.ok(prueba.filas($$delete from solicitudes where persona_id = auth.uid()$$) = 1, 'la dueña cancela su solicitud pendiente');

\echo '--- Apagar el módulo no borra nada'
select prueba.como('Gerencia Admin');
select prueba.ok(prueba.filas($$update configuracion set valor = '{"activo": false}' where clave = 'modulo_solicitudes'$$) = 1, 'la gerencia apaga el módulo');
select prueba.como('Directora Bogotá');
select prueba.ok(prueba.cuenta($$select 1 from ausencias_aprobadas(current_date - 30, current_date + 30)$$) = 2, 'lo aprobado sigue justificando ausencias');
reset role;

\echo '=== 02_aprobaciones: todo OK'
