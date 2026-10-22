-- =====================================================================
-- Pruebas de Grupos (009). Correr después de 01 y 02 (usa sus ayudas y
-- sus personas de prueba).
-- =====================================================================

\pset pager off
set client_min_messages = notice;

\echo '--- Grupos: todo el equipo activo crea, mueve y borra'
select prueba.como('Colab Ventas');
insert into grupos (nombre, destino, salida, regreso, pasajeros, responsable_id, alcance, notas)
values ('Peregrinación Fátima', 'Portugal', current_date + 30, current_date + 42, 25, prueba.id('Colab Ventas'), 'Aéreos y hoteles', 'Nota interna');
select prueba.ok(prueba.cuenta($$select 1 from grupos where nombre = 'Peregrinación Fátima' and estado = 'cotizando'$$) = 1, 'un colaborador crea un grupo (empieza en Cotizando)');
select prueba.ok((select creado_por = auth.uid() and actualizado_por = auth.uid() from grupos where nombre = 'Peregrinación Fátima'), 'el grupo queda a nombre de quien lo creó');
insert into grupos (nombre, creado_por, actualizado_por) values ('Falso', prueba.id('Gerencia Admin'), prueba.id('Gerencia Admin'));
select prueba.ok((select creado_por = auth.uid() and actualizado_por = auth.uid() from grupos where nombre = 'Falso'), 'no se puede crear a nombre de otra persona (la base pone a quien lo hizo)');
delete from grupos where nombre = 'Falso';

update grupos set parroquia = 'Parroquia San José de Chapinero' where nombre = 'Peregrinación Fátima';
select prueba.ok((select parroquia = 'Parroquia San José de Chapinero' from grupos where nombre = 'Peregrinación Fátima'), 'el grupo guarda su parroquia');
select prueba.falla($$update grupos set parroquia = repeat('x', 121) where nombre = 'Peregrinación Fátima'$$, 'la parroquia tiene máximo 120 caracteres');
insert into grupos (nombre) values ('Sin parroquia');
select prueba.ok((select parroquia = '' from grupos where nombre = 'Sin parroquia'), 'un grupo sin parroquia queda con el campo vacío');
delete from grupos where nombre = 'Sin parroquia';

select prueba.como('Supervisor Contable');
select prueba.ok(prueba.filas($$update grupos set estado = 'confirmado' where nombre = 'Peregrinación Fátima'$$) = 1, 'otra persona mueve el grupo de columna');
select prueba.ok((select actualizado_por = auth.uid() and creado_por = prueba.id('Colab Ventas') from grupos where nombre = 'Peregrinación Fátima'), 'el cambio queda a nombre de quien lo hizo y el creador no cambia');
select prueba.falla($$update grupos set regreso = salida - 1 where nombre = 'Peregrinación Fátima'$$, 'el regreso no puede ser antes de la salida');
select prueba.falla($$insert into grupos (nombre) values ('   ')$$, 'un grupo necesita nombre');
select prueba.falla($$update grupos set estado = 'perdido' where nombre = 'Peregrinación Fátima'$$, 'solo existen las cinco columnas');

select prueba.como('Colab Otra Sede');
select prueba.ok(prueba.cuenta($$select 1 from grupos$$) = 1, 'una persona de otra sede también ve los grupos');
insert into grupos (nombre) values ('Para borrar');
select prueba.ok(prueba.filas($$delete from grupos where nombre = 'Para borrar'$$) = 1, 'cualquier persona activa borra un grupo');

\echo '--- Grupos: cuentas desactivadas y visitantes'
reset role;
update perfiles set activo = false where nombre = 'Colab Operaciones';
select prueba.como('Colab Operaciones');
select prueba.ok(prueba.cuenta($$select 1 from grupos$$) = 0, 'una cuenta desactivada no ve grupos');
select prueba.falla($$insert into grupos (nombre) values ('Intruso')$$, 'una cuenta desactivada no crea grupos');
select prueba.ok(prueba.filas($$update grupos set nombre = 'x'$$) = 0, 'una cuenta desactivada no cambia grupos');
reset role;
update perfiles set activo = true where nombre = 'Colab Operaciones';

reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select prueba.falla($$select 1 from grupos$$, 'un visitante sin sesión no lee la tabla');
select prueba.falla($$select * from calendario_clave$$, 'un visitante no lee la clave del calendario');
select prueba.falla($$select nueva_clave_calendario()$$, 'un visitante no crea claves');
select prueba.falla($$select * from grupos_calendario('cualquier-cosa')$$, 'el calendario no responde sin la clave correcta');

\echo '--- Clave de Google Calendar'
select prueba.como('Colab Ventas');
select prueba.falla($$select nueva_clave_calendario()$$, 'un colaborador no crea la clave');
select prueba.falla($$select * from calendario_clave$$, 'un colaborador no lee la huella de la clave');
select prueba.como('Gerencia Admin');
select nueva_clave_calendario() as clave1 \gset
select prueba.ok(length(:'clave1') = 48, 'la administración crea una clave larga');
select prueba.ok(prueba.cuenta(format('select 1 from grupos_calendario(%L)', :'clave1')) = 1, 'con la clave se leen los grupos con fecha');
select nueva_clave_calendario() as clave2 \gset
select prueba.falla(format('select * from grupos_calendario(%L)', :'clave1'), 'la clave anterior deja de servir al crear otra');
reset role;
select prueba.ok((select count(*) = 1 and bool_and(huella <> :'clave2' and huella <> :'clave1') from calendario_clave), 'en la base queda una sola huella y nunca la clave');

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select prueba.ok((select responsable = 'Colab Ventas' and destino = 'Portugal' and parroquia = 'Parroquia San José de Chapinero' from grupos_calendario(:'clave2')), 'Google recibe nombre, destino, parroquia y responsable');
reset role;
select prueba.ok(not exists (
  select 1 from pg_proc p, unnest(p.proargnames) a where p.proname = 'grupos_calendario' and a = 'notas'), 'grupos_calendario no tiene columna «notas»');

\echo '=== 03_grupos: todo OK'
