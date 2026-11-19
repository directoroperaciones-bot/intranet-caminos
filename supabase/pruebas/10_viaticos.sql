-- =====================================================================
-- Pruebas de viáticos y legalización (023). Correr después de 09.
-- =====================================================================

\pset pager off
set client_min_messages = notice;

create or replace function prueba.via(m text) returns bigint
language sql stable security definer set search_path = public as $$
  select id from viaticos where motivo = m order by id desc limit 1
$$;
grant execute on function prueba.via(text) to authenticated;

\echo '--- Solicitar'
select prueba.como('Colab Ventas');
select prueba.falla($$select solicitar_viatico('', current_date, current_date + 3, 500000, 'Grupo Cartagena', null)$$, 'el destino es obligatorio');
select prueba.falla($$select solicitar_viatico('Cartagena', current_date + 3, current_date, 500000, 'Grupo Cartagena', null)$$, 'el regreso no puede ser antes de la salida');
select prueba.falla($$insert into viaticos (persona_id, destino, salida, regreso, estado, presupuesto) values (auth.uid(), 'X', current_date, current_date, 'aprobado', 1)$$, 'no se crea un viático aprobado directo en la tabla');
select prueba.ok((solicitar_viatico('Cartagena', current_date, current_date + 3, 800000, 'Grupo Cartagena', null)).estado = 'solicitado', 'el colaborador solicita viáticos');
select prueba.falla($$select aprobar_viatico(prueba.via('Grupo Cartagena'), 800000, '')$$, 'el colaborador no se aprueba sus viáticos');
select prueba.falla($$insert into viatico_gastos (viatico_id, fecha, categoria, descripcion, valor) values (prueba.via('Grupo Cartagena'), current_date, 'alimentacion', 'Almuerzo', 30000)$$, 'sin aprobar no registra gastos');

\echo '--- Quién ve'
select prueba.como('Colab Operaciones');
select prueba.ok(prueba.cuenta($$select 1 from viaticos$$) = 0, 'otro colaborador no ve viáticos ajenos');
select prueba.como('Directora Bogotá');
select prueba.ok(prueba.cuenta($$select 1 from viaticos$$) = 0, 'la directora (no gerencia) tampoco');
select prueba.falla($$select aprobar_viatico(prueba.via('Grupo Cartagena'), 800000, '')$$, 'la directora no aprueba viáticos');
select prueba.como('Gerencia Admin');
select prueba.ok(prueba.cuenta($$select 1 from viaticos$$) = 1, 'la gerencia ve todos');

\echo '--- Aprobar'
select prueba.falla($$select aprobar_viatico(prueba.via('Grupo Cartagena'), 0, '')$$, 'hay que asignar el presupuesto');
select prueba.ok((aprobar_viatico(prueba.via('Grupo Cartagena'), 700000, 'Te asigno 700 mil')).presupuesto = 700000, 'la gerencia asigna presupuesto y aprueba');
select prueba.falla($$select aprobar_viatico(prueba.via('Grupo Cartagena'), 700000, '')$$, 'no se aprueba dos veces');
select prueba.falla($$select asignar_viatico(auth.uid(), 'Lima', current_date, current_date + 2, 100000, 'Propio', null)$$, 'la gerencia no se asigna viáticos a sí misma');
select prueba.ok((asignar_viatico(prueba.id('Colab Operaciones'), 'Medellín', current_date, current_date + 1, 300000, 'Grupo Medellín', null)).estado = 'aprobado', 'la gerencia asigna viáticos aprobados de una vez');
select prueba.ok((solicitar_viatico('Bogotá', current_date, current_date, 50000, 'Gerencia propio', null)).estado = 'solicitado', 'la gerencia también solicita los suyos');
select prueba.falla($$select aprobar_viatico(prueba.via('Gerencia propio'), 50000, '')$$, 'pero no se los aprueba');
select prueba.falla($$select rechazar_viatico(prueba.via('Grupo Medellín'), 'no')$$, 'no se rechaza uno ya aprobado');

\echo '--- Legalizar'
select prueba.como('Colab Ventas');
select prueba.falla($$select enviar_legalizacion(prueba.via('Grupo Cartagena'))$$, 'sin gastos no se envía la legalización');
select prueba.ok(prueba.filas($$insert into viatico_gastos (viatico_id, fecha, categoria, descripcion, valor, soporte_ruta) values
  (prueba.via('Grupo Cartagena'), current_date, 'alimentacion', 'Almuerzos del grupo', 250000, prueba.via('Grupo Cartagena') || '/f1.jpg'),
  (prueba.via('Grupo Cartagena'), current_date + 1, 'transporte', 'Taxi aeropuerto', 80000, null),
  (prueba.via('Grupo Cartagena'), current_date + 2, 'otros', 'Recuerdos', 120000, null)$$) = 3, 'el funcionario registra sus gastos');
select prueba.falla($$insert into viatico_gastos (viatico_id, fecha, categoria, descripcion, valor) values (prueba.via('Grupo Cartagena'), current_date + 30, 'otros', 'Fuera de fechas', 1000)$$, 'un gasto fuera de las fechas del viaje no entra');
select prueba.falla($$insert into viatico_gastos (viatico_id, fecha, categoria, descripcion, valor, no_aceptado) values (prueba.via('Grupo Cartagena'), current_date, 'otros', 'Truco', 1000, 'aceptado')$$, 'no se puede marcar «no aceptado» uno mismo');
select prueba.falla($$update viatico_gastos set no_aceptado = 'x' where descripcion = 'Recuerdos'$$, 'ni cambiarlo después');
select prueba.ok(prueba.filas($$update viatico_gastos set valor = 90000 where descripcion = 'Taxi aeropuerto'$$) = 1, 'corrige el valor de un gasto');
select prueba.falla($$insert into viatico_gastos (viatico_id, fecha, categoria, descripcion, valor) values (prueba.via('Grupo Medellín'), current_date, 'otros', 'Ajeno', 1000)$$, 'no registra gastos en viáticos de otro');
select prueba.ok((enviar_legalizacion(prueba.via('Grupo Cartagena'))).estado = 'en_revision', 'envía la legalización');
select prueba.ok(prueba.filas($$delete from viatico_gastos where descripcion = 'Recuerdos'$$) = 0, 'enviada, ya no borra gastos');
select prueba.ok(prueba.filas($$update viatico_gastos set valor = 1 where descripcion = 'Recuerdos'$$) = 0, 'ni los cambia');

\echo '--- Revisar'
select prueba.como('Colab Operaciones');
select prueba.ok(prueba.cuenta($$select 1 from viatico_gastos$$) = 0, 'otro colaborador no ve gastos ajenos');
select prueba.como('Gerencia Admin');
select prueba.falla($$select revisar_legalizacion(prueba.via('Grupo Cartagena'), false, '')$$, 'para devolver hay que decir qué corregir');
select prueba.ok((revisar_legalizacion(prueba.via('Grupo Cartagena'), false, 'Falta el soporte del taxi')).estado = 'devuelto', 'la gerencia devuelve la legalización');
select prueba.como('Colab Ventas');
select prueba.ok(prueba.filas($$update viatico_gastos set soporte_ruta = prueba.via('Grupo Cartagena') || '/taxi.pdf' where descripcion = 'Taxi aeropuerto'$$) = 1, 'devuelta, el funcionario corrige');
select enviar_legalizacion(prueba.via('Grupo Cartagena'));
select prueba.como('Gerencia Admin');
select prueba.falla($$select no_aceptar_gasto((select id from viatico_gastos where descripcion = 'Recuerdos'), 'no')$$, 'el motivo de no aceptar debe tener texto');
select prueba.ok((no_aceptar_gasto((select id from viatico_gastos where descripcion = 'Recuerdos'), 'No es gasto de viaje')).no_aceptado is not null, 'la gerencia no acepta un gasto puntual');
select prueba.ok((revisar_legalizacion(prueba.via('Grupo Cartagena'), true, '')).saldo = 700000 - 250000 - 90000, 'aprueba: legaliza solo lo aceptado y calcula el saldo a favor de la empresa');
select prueba.falla($$select anular_viatico(prueba.via('Grupo Cartagena'), '')$$, 'un viático cerrado no se anula');

\echo '--- Anular'
select prueba.como('Colab Ventas');
select solicitar_viatico('Tunja', current_date, current_date, 40000, 'Para anular', null);
select prueba.ok((anular_viatico(prueba.via('Para anular'), '')).estado = 'anulado', 'el funcionario anula su solicitud pendiente');
select prueba.como('Colab Operaciones');
select prueba.falla($$select anular_viatico(prueba.via('Grupo Medellín'), '')$$, 'el funcionario no anula un viático ya aprobado');
select prueba.como('Gerencia Admin');
select prueba.ok((anular_viatico(prueba.via('Grupo Medellín'), 'Se canceló el viaje')).estado = 'anulado', 'la gerencia anula un viático aprobado');

\echo '--- Soportes'
select prueba.como('Colab Ventas');
select prueba.falla($$insert into storage.objects (bucket_id, name) values ('viaticos', prueba.via('Grupo Cartagena') || '/tarde.jpg')$$, 'cerrado, no sube más soportes');
select solicitar_viatico('Villa de Leyva', current_date, current_date + 1, 200000, 'Con soporte', null);
select prueba.como('Gerencia Admin');
select aprobar_viatico(prueba.via('Con soporte'), 200000, '');
select prueba.como('Colab Ventas');
select prueba.ok(prueba.filas($$insert into storage.objects (bucket_id, name) values ('viaticos', prueba.via('Con soporte') || '/factura.jpg')$$) = 1, 'aprobado, sube soportes a su viático');
select prueba.como('Colab Operaciones');
select prueba.falla($$insert into storage.objects (bucket_id, name) values ('viaticos', prueba.via('Con soporte') || '/ajeno.jpg')$$, 'no sube soportes a un viático ajeno');
select prueba.ok(prueba.cuenta($$select 1 from storage.objects where bucket_id = 'viaticos'$$) = 0, 'ni los ve');
select prueba.como('Gerencia Admin');
select prueba.ok(prueba.cuenta($$select 1 from storage.objects where bucket_id = 'viaticos'$$) = 1, 'la gerencia ve los soportes');
