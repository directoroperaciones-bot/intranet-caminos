/* =====================================================================
   Intranet Caminos · Grupos → Google Calendar (Apps Script, gratis)
   Copia los grupos con fechas de la intranet al calendario compartido
   «Grupos Caminos». Corre solo cada 10 minutos. Pasos de instalación en
   calendario/LEEME.md.

   - Solo lee: usa grupos_calendario(clave), que entrega nombre, destino, parroquia,
     fechas, pasajeros, responsable, alcance y columna (nunca las notas).
   - Solo toca los eventos que él mismo creó (marcados con «grupo_id»):
     los demás eventos del calendario no se tocan.
   - Si un grupo se borra o se le quitan las fechas, su evento se borra.
   - Filtro por parroquia: cada grupo con parroquia va a un calendario
     propio, «Grupos · <parroquia>», que se crea solo. Los grupos sin
     parroquia siguen en «Grupos Caminos». En Google Calendar, marcar o
     desmarcar esos calendarios es filtrar por parroquia.
   ===================================================================== */

var CALENDARIO_NOMBRE = 'Grupos Caminos';
var PREFIJO_PARROQUIA = 'Grupos · ';
var COLUMNAS = {
  cotizando: { nombre: 'Cotizando', color: 'PALE_BLUE' },
  confirmado: { nombre: 'Confirmado', color: 'GREEN' },
  documentacion: { nombre: 'Documentación lista', color: 'YELLOW' },
  en_viaje: { nombre: 'En viaje', color: 'RED' },
  finalizado: { nombre: 'Finalizado', color: 'GRAY' },
};

// ---------- Se corren a mano una sola vez (menú «Ejecutar») ----------

// 1) Crea el calendario «Grupos Caminos» y guarda su identificador.
function crearCalendario() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CALENDARIO_ID');
  if (id && CalendarApp.getCalendarById(id)) {
    Logger.log('El calendario ya existe: ' + id);
    return id;
  }
  var cal = CalendarApp.createCalendar(CALENDARIO_NOMBRE, {
    summary: 'Grupos de viaje de Caminos. Se llena solo desde la intranet: los cambios hechos aquí se pierden.',
    timeZone: 'America/Bogota',
  });
  props.setProperty('CALENDARIO_ID', cal.getId());
  Logger.log('Calendario creado: ' + cal.getId());
  return cal.getId();
}

// 2) Prueba la conexión y deja la sincronización corriendo cada 10 minutos.
function instalar() {
  revisarPropiedades_();
  var r = sincronizar();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sincronizar').timeBased().everyMinutes(10).create();
  Logger.log('Listo: se sincroniza cada 10 minutos. Primera vuelta: ' + JSON.stringify(r));
}

// 3) Opcional: comparte todos los calendarios (el principal y los de cada
// parroquia) con los correos de la propiedad COMPARTIR_CON. Sirve para
// alguien nuevo en el equipo. Los calendarios de parroquias nuevas se
// comparten solos al crearse.
function compartirCalendarios() {
  var props = revisarPropiedades_();
  if (!props.COMPARTIR_CON) throw new Error('Escribe los correos en la propiedad COMPARTIR_CON, separados por comas (ver LEEME.md).');
  var mapa = calendariosParroquia_();
  var ids = [props.CALENDARIO_ID].concat(Object.keys(mapa).map(function (k) { return mapa[k].id; }));
  ids.forEach(function (id) { compartir_(id, props.COMPARTIR_CON); });
  Logger.log('Compartidos ' + ids.length + ' calendarios con ' + props.COMPARTIR_CON);
}

// Para dejar de sincronizar (los eventos que ya están se quedan).
function desinstalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizar') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Sincronización detenida.');
}

// ---------- Sincronización ----------

function sincronizar() {
  var props = revisarPropiedades_();
  var principal = CalendarApp.getCalendarById(props.CALENDARIO_ID);
  if (!principal) throw new Error('No encuentro el calendario ' + props.CALENDARIO_ID + '. Corre crearCalendario().');
  var grupos = leerGrupos_(props);
  var mapa = calendariosParroquia_();
  var calendarios = [principal];
  Object.keys(mapa).forEach(function (k) {
    var c = CalendarApp.getCalendarById(mapa[k].id);
    if (c) calendarios.push(c); else delete mapa[k]; // lo borraron en Google: se crea de nuevo si hace falta
  });

  // Eventos que este programa creó antes, por grupo
  var hoy = new Date();
  var desde = new Date(hoy.getFullYear() - 2, 0, 1), hasta = new Date(hoy.getFullYear() + 4, 0, 1);
  grupos.forEach(function (g) {
    var s = aFecha_(g.salida);
    if (s < desde) desde = s;
    var r = aFecha_(g.regreso || g.salida);
    if (r >= hasta) hasta = sumarDias_(r, 1);
  });
  var existentes = {};
  calendarios.forEach(function (c) {
    c.getEvents(desde, hasta).forEach(function (ev) {
      var id = ev.getTag('grupo_id');
      if (!id) return;
      if (existentes[id]) { ev.deleteEvent(); return; } // repetido: se deja uno
      existentes[id] = { ev: ev, cal: c.getId() };
    });
  });

  var cuenta = { creados: 0, cambiados: 0, movidos: 0, borrados: 0, iguales: 0, calendarios: 0 };
  grupos.forEach(function (g) {
    var id = String(g.id);
    var datos = evento_(g);
    var cal = calendarioDe_(g.parroquia, principal, mapa, props, cuenta);
    var previo = existentes[id];
    delete existentes[id];
    var ev = previo ? previo.ev : null;
    // Cambió de parroquia: el evento pasa al calendario de la nueva
    if (ev && previo.cal !== cal.getId()) { ev.deleteEvent(); ev = null; cuenta.movidos++; }
    if (!ev) {
      ev = cal.createAllDayEvent(datos.titulo, datos.inicio, datos.fin, { description: datos.descripcion });
      ev.setTag('grupo_id', id);
      ev.setTag('huella', datos.huella);
      ponerColor_(ev, g.estado);
      if (!previo || previo.cal === cal.getId()) cuenta.creados++;
      return;
    }
    if (ev.getTag('huella') === datos.huella) { cuenta.iguales++; return; }
    ev.setTitle(datos.titulo);
    ev.setDescription(datos.descripcion);
    ev.setAllDayDates(datos.inicio, datos.fin);
    ponerColor_(ev, g.estado);
    ev.setTag('huella', datos.huella);
    cuenta.cambiados++;
  });
  // Lo que queda ya no existe en la intranet (o perdió sus fechas)
  Object.keys(existentes).forEach(function (id) { existentes[id].ev.deleteEvent(); cuenta.borrados++; });
  guardarCalendariosParroquia_(mapa);
  Logger.log(JSON.stringify(cuenta));
  return cuenta;
}

// ---------- Un calendario por parroquia ----------

// { 'parroquia san josé': { nombre: 'Parroquia San José', id: '…@group.calendar.google.com' } }
function calendariosParroquia_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('CALENDARIOS_PARROQUIA') || '{}'); } catch (e) { return {}; }
}
function guardarCalendariosParroquia_(mapa) {
  PropertiesService.getScriptProperties().setProperty('CALENDARIOS_PARROQUIA', JSON.stringify(mapa));
}
// Mayúsculas, tildes y espacios de más no crean calendarios distintos
function claveParroquia_(p) {
  return String(p || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function calendarioDe_(parroquia, principal, mapa, props, cuenta) {
  var k = claveParroquia_(parroquia);
  if (!k) return principal;
  var c = mapa[k] && CalendarApp.getCalendarById(mapa[k].id);
  if (c) return c;
  var nombre = String(parroquia).replace(/\s+/g, ' ').trim();
  c = CalendarApp.createCalendar(PREFIJO_PARROQUIA + nombre, {
    summary: 'Grupos de viaje de ' + nombre + ' (Caminos). Se llena solo desde la intranet: los cambios hechos aquí se pierden.',
    timeZone: 'America/Bogota',
  });
  mapa[k] = { nombre: nombre, id: c.getId() };
  guardarCalendariosParroquia_(mapa);
  compartir_(c.getId(), props.COMPARTIR_CON);
  cuenta.calendarios++;
  return c;
}
// Comparte un calendario (solo ver) con los correos dados. Necesita el
// servicio avanzado «Google Calendar API» (viene activado en appsscript.json).
function compartir_(calId, correos) {
  if (!correos) return;
  if (typeof Calendar === 'undefined' || !Calendar.Acl) {
    Logger.log('Para compartir solo los calendarios, activa el servicio avanzado «Google Calendar API» (ver LEEME.md).');
    return;
  }
  String(correos).split(/[,;\s]+/).filter(function (c) { return c; }).forEach(function (correo) {
    try {
      Calendar.Acl.insert({ role: 'reader', scope: { type: 'user', value: correo } }, calId, { sendNotifications: true });
    } catch (e) {
      Logger.log('No pude compartir ' + calId + ' con ' + correo + ': ' + e.message);
    }
  });
}

function leerGrupos_(props) {
  var url = props.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/grupos_calendario';
  var r = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: props.SUPABASE_KEY },
    payload: JSON.stringify({ p_clave: props.CLAVE_CALENDARIO }),
    muteHttpExceptions: true,
  });
  var codigo = r.getResponseCode(), texto = r.getContentText();
  if (codigo !== 200) {
    if (/Clave del calendario/.test(texto)) throw new Error('La clave del calendario no sirve: crea una nueva en la intranet (Grupos → Conectar Google Calendar) y pégala en CLAVE_CALENDARIO.');
    throw new Error('La intranet respondió ' + codigo + ': ' + texto.slice(0, 300));
  }
  return JSON.parse(texto);
}

function evento_(g) {
  var col = COLUMNAS[g.estado] || COLUMNAS.cotizando;
  var titulo = g.nombre + (g.destino ? ' · ' + g.destino : '') + (g.estado === 'cotizando' ? ' (cotizando)' : '');
  var lineas = [
    'Columna: ' + col.nombre,
    g.destino ? 'Destino: ' + g.destino : '',
    g.parroquia ? 'Parroquia: ' + g.parroquia : '',
    'Salida: ' + g.salida + (g.regreso ? ' · Regreso: ' + g.regreso : ''),
    g.pasajeros != null ? 'Pasajeros: ' + g.pasajeros : '',
    g.responsable ? 'Responsable: ' + g.responsable : '',
    g.alcance ? '\nAlcance:\n' + g.alcance : '',
    '\nSe actualiza solo desde la intranet de Caminos: los cambios hechos aquí se pierden.',
  ];
  var inicio = aFecha_(g.salida);
  var fin = sumarDias_(aFecha_(g.regreso || g.salida), 1); // en Google el último día no se cuenta
  return {
    titulo: titulo,
    descripcion: lineas.filter(function (x) { return x; }).join('\n'),
    inicio: inicio,
    fin: fin,
    huella: [titulo, g.parroquia, g.salida, g.regreso, g.pasajeros, g.responsable, g.alcance, g.estado].join('|'),
  };
}

function ponerColor_(ev, estado) {
  var col = COLUMNAS[estado] || COLUMNAS.cotizando;
  try { ev.setColor(CalendarApp.EventColor[col.color]); } catch (e) { /* el color es opcional */ }
}

function revisarPropiedades_() {
  var p = PropertiesService.getScriptProperties().getProperties();
  var faltan = ['SUPABASE_URL', 'SUPABASE_KEY', 'CLAVE_CALENDARIO', 'CALENDARIO_ID'].filter(function (k) { return !p[k]; });
  if (faltan.length) throw new Error('Faltan propiedades del proyecto: ' + faltan.join(', ') + ' (ver LEEME.md, paso 4).');
  if (/^sb_secret_|service_role/.test(p.SUPABASE_KEY)) throw new Error('SUPABASE_KEY debe ser la llave PUBLICABLE, nunca la secreta.');
  return p;
}

// «2026-12-10» → fecha local a medianoche (zona del proyecto: America/Bogota)
function aFecha_(iso) {
  var x = String(iso).split('-');
  return new Date(+x[0], +x[1] - 1, +x[2]);
}
function sumarDias_(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
