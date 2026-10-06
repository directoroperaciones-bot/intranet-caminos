-- =====================================================================
-- Intranet Caminos · 003 · Datos iniciales
-- ÚNICA migración que se personaliza por cliente.
--
-- PENDIENTE DE CONFIRMAR CON CAMINOS (ver intranet/LEEME.md):
--   · ¿Hay otras sedes además de Bogotá?
--   · Lista definitiva de áreas.
--   · Horario real de cada persona (los turnos de abajo son de ejemplo).
-- =====================================================================

-- Sedes (zona horaria IANA)
insert into sedes (nombre, zona_horaria) values
  ('Bogotá', 'America/Bogota');

-- Áreas (confirmar)
insert into areas (nombre) values
  ('Gerencia'),
  ('Ventas'),
  ('Operaciones'),
  ('Contabilidad');

-- Turnos de ejemplo por sede. 'D' (Descanso) debe existir en cada sede:
-- la malla efectiva lo usa para los días sin horario fijo.
insert into turnos (sede_id, codigo, nombre, entrada, salida_almuerzo, regreso_almuerzo, salida)
select s.id, x.codigo, x.nombre, x.entrada, x.salida_almuerzo, x.regreso_almuerzo, x.salida
from sedes s
cross join (values
  ('M', 'Mañana',     '07:00'::time, '12:00'::time, '13:00'::time, '16:00'::time),
  ('T', 'Tarde',      '10:00'::time, '14:00'::time, '15:00'::time, '19:00'::time),
  ('S', 'Sábado',     '08:00'::time, null::time,    null::time,    '12:00'::time),
  ('D', 'Descanso',   null::time,    null::time,    null::time,    null::time),
  ('V', 'Vacaciones', null::time,    null::time,    null::time,    null::time)
) as x (codigo, nombre, entrada, salida_almuerzo, regreso_almuerzo, salida);

-- Herramientas de Inicio (se agregan o cambian con un insert/update, sin tocar código)
insert into herramientas (nombre, descripcion, icono, pie, url, orden) values
  ('Gestor de reservas',
   'La app de operación de Caminos: ventas, reservas, pasajeros y proveedores.',
   'reservas', 'AppSheet',
   'https://www.appsheet.com/start/eb769707-eafd-445c-aa00-eb637321ef76#appName=GESTORDERESERVAS-CAMINOS2-850658711&view=INICIO',
   1),
  ('Caminos Documentos',
   'Cotizaciones, confirmaciones, vouchers e itinerarios con el diseño de Caminos.',
   'documentos', 'Claude',
   'https://claude.ai/artifact/WPzKkP7MwdKBaGrrGVpZ1Y',
   2),
  ('Cotizador OMNIAXIS',
   'Plantilla maestra del cotizador.',
   'cotizador', 'Google Sheets',
   'https://docs.google.com/spreadsheets/d/1n_wPCi90RUk69Yiclf-Uc1viJZIWQs7Qc1Z5k1ZUWM0/edit?gid=131584006#gid=131584006',
   3);

-- Configuración
insert into configuracion (clave, valor) values
  ('modulo_solicitudes', '{"activo": false}'),
  ('tolerancias',        '{"entrada_min": 5, "almuerzo_min": 5}'),
  ('meta_puntualidad',   '{"porcentaje": 95}'),
  ('validar_ip',         '{"activo": false}');
