// Prueba Codigo.gs fuera de Google, con un calendario y una intranet simulados.
// Uso: node calendario/probar.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fallos = [];
const ok = (c, msg) => { if (c) console.log('OK    ' + msg); else { console.log('FALLO ' + msg); fallos.push(msg); } };

// ---------- Google simulado ----------
let siguiente = 1;
function nuevoCalendario(nombre) {
  const eventos = [];
  return {
    id: 'cal-' + nombre, eventos,
    getId() { return this.id; },
    getEvents(desde, hasta) { return eventos.filter((e) => !e.borrado && e.inicio < hasta && e.fin > desde); },
    createAllDayEvent(titulo, inicio, fin, opc) {
      const e = {
        id: siguiente++, titulo, inicio, fin, descripcion: opc.description, tags: {}, color: null, borrado: false,
        getTag(k) { return this.tags[k] || null; }, setTag(k, v) { this.tags[k] = v; },
        setTitle(t) { this.titulo = t; }, setDescription(d) { this.descripcion = d; },
        setAllDayDates(a, b) { this.inicio = a; this.fin = b; }, setColor(c) { this.color = c; },
        deleteEvent() { this.borrado = true; },
      };
      eventos.push(e);
      return e;
    },
  };
}
const calendarios = {};
const cal = nuevoCalendario('grupos');
calendarios[cal.id] = cal;
const compartidos = [];
const ajeno = cal.createAllDayEvent('Reunión de equipo', new Date(2026, 9, 20), new Date(2026, 9, 21), { description: '' });
let grupos = [];
let respuesta = null;
const pedidos = [];
const props = { SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co/', SUPABASE_KEY: 'sb_publishable_x', CLAVE_CALENDARIO: 'a'.repeat(48), CALENDARIO_ID: cal.id };
const disparadores = [];
const ctx = {
  Logger: { log() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({ ...props }), getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  CalendarApp: {
    EventColor: { PALE_BLUE: '1', GREEN: '10', YELLOW: '5', RED: '11', GRAY: '8' },
    getCalendarById: (id) => calendarios[id] || null,
    createCalendar: (n, opc) => { const c = nuevoCalendario(n); c.nombre = n; c.opc = opc; calendarios[c.id] = c; return c; },
  },
  Calendar: { Acl: { insert: (regla, calId, opc) => compartidos.push({ calId, correo: regla.scope.value, rol: regla.role, aviso: opc.sendNotifications }) } },
  UrlFetchApp: {
    fetch(url, opc) {
      pedidos.push({ url, opc });
      const r = respuesta || { codigo: 200, texto: JSON.stringify(grupos) };
      return { getResponseCode: () => r.codigo, getContentText: () => r.texto };
    },
  },
  ScriptApp: {
    getProjectTriggers: () => disparadores.slice(),
    deleteTrigger: (t) => disparadores.splice(disparadores.indexOf(t), 1),
    newTrigger: (f) => ({ timeBased: () => ({ everyMinutes: (m) => ({ create: () => disparadores.push({ f, m, getHandlerFunction: () => f }) }) }) }),
  },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'Codigo.gs'), 'utf8'), ctx);
const vivos = () => cal.eventos.filter((e) => !e.borrado && e.tags.grupo_id);
const de = (id) => vivos().find((e) => e.tags.grupo_id === String(id));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------- Pruebas ----------
grupos = [
  { id: 1, nombre: 'Peregrinación Fátima', destino: 'Portugal', salida: '2026-11-01', regreso: '2026-11-13', pasajeros: 28, responsable: 'Carolina', alcance: 'Aéreos y hoteles', estado: 'confirmado' },
  { id: 2, nombre: 'Pasadía Chiquinquirá', destino: '', salida: '2026-10-25', regreso: null, pasajeros: null, responsable: null, alcance: '', estado: 'cotizando' },
];
let r = ctx.instalar();
ok(pedidos[0].url === 'https://abcdefghijklmnopqrst.supabase.co/rest/v1/rpc/grupos_calendario', 'llama a grupos_calendario de la intranet');
ok(pedidos[0].opc.headers.apikey === 'sb_publishable_x' && JSON.parse(pedidos[0].opc.payload).p_clave === 'a'.repeat(48), 'manda la llave publicable y la clave del calendario');
ok(vivos().length === 2, 'crea un evento por grupo');
const e1 = de(1);
ok(e1.titulo === 'Peregrinación Fátima · Portugal', `título con nombre y destino («${e1.titulo}»)`);
ok(iso(e1.inicio) === '2026-11-01' && iso(e1.fin) === '2026-11-14', 'todo el día del 1 al 13 de noviembre (Google cuenta hasta el 14 sin incluirlo)');
ok(/Responsable: Carolina/.test(e1.descripcion) && /Pasajeros: 28/.test(e1.descripcion) && /Aéreos y hoteles/.test(e1.descripcion), 'la descripción trae responsable, pasajeros y alcance');
ok(e1.color === '10', 'color según la columna (Confirmado: verde)');
const e2 = de(2);
ok(e2.titulo === 'Pasadía Chiquinquirá (cotizando)' && iso(e2.fin) === '2026-10-26', 'grupo de un día y en Cotizando');
ok(disparadores.length === 1 && disparadores[0].m === 10, 'queda programado cada 10 minutos');
ctx.instalar();
ok(disparadores.length === 1, 'instalar dos veces no duplica la programación');

r = ctx.sincronizar();
ok(r.iguales === 2 && r.creados === 0 && r.cambiados === 0, 'sin cambios no toca nada');

grupos[0] = { ...grupos[0], estado: 'en_viaje', regreso: '2026-11-15' };
r = ctx.sincronizar();
ok(r.cambiados === 1 && de(1).id === e1.id && iso(de(1).fin) === '2026-11-16' && de(1).color === '11', 'al mover o cambiar fechas actualiza el mismo evento');

grupos = grupos.slice(0, 1);
r = ctx.sincronizar();
ok(r.borrados === 1 && !de(2), 'si el grupo se borra o pierde sus fechas, su evento se borra');
ok(!ajeno.borrado, 'no toca los eventos que no creó');

respuesta = { codigo: 400, texto: '{"message":"Clave del calendario no válida."}' };
let error = '';
try { ctx.sincronizar(); } catch (e) { error = e.message; }
ok(/Conectar Google Calendar/.test(error) && de(1), 'con una clave vencida avisa qué hacer y no borra nada');
respuesta = null;

// ---------- Filtro por parroquia: un calendario por parroquia ----------
const deEn = (c, id) => c.eventos.find((e) => !e.borrado && e.tags.grupo_id === String(id));
const calDe = (nombre) => Object.values(calendarios).find((c) => c.nombre === 'Grupos · ' + nombre);
props.COMPARTIR_CON = 'ana@agenciacaminos.com.co, luis@agenciacaminos.com.co';
grupos = [
  { ...grupos[0], parroquia: 'Parroquia San José' },
  { id: 3, nombre: 'Jubilados', destino: 'Eje Cafetero', parroquia: '  parroquia  san jose ', salida: '2026-12-06', regreso: '2026-12-11', pasajeros: 22, responsable: null, alcance: '', estado: 'cotizando' },
  { id: 4, nombre: 'Familia Gómez', destino: 'Cartagena', parroquia: '', salida: '2026-12-20', regreso: '2026-12-24', pasajeros: 4, responsable: null, alcance: '', estado: 'confirmado' },
];
r = ctx.sincronizar();
const sj = calDe('Parroquia San José');
ok(!!sj && r.calendarios === 1, 'crea el calendario «Grupos · Parroquia San José» la primera vez');
ok(deEn(sj, 1) && deEn(sj, 3) && !deEn(cal, 1) && !deEn(cal, 3), 'los grupos de esa parroquia van a su calendario (mayúsculas, tildes y espacios no crean otro)');
ok(r.movidos === 1, 'el grupo que ya existía pasa del calendario principal al de su parroquia');
ok(deEn(cal, 4) && !deEn(sj, 4), 'los grupos sin parroquia siguen en «Grupos Caminos»');
ok(/Parroquia: Parroquia San José/.test(deEn(sj, 1).descripcion), 'la descripción del evento trae la parroquia');
ok(compartidos.filter((c) => c.calId === sj.id).map((c) => c.correo).join(',') === 'ana@agenciacaminos.com.co,luis@agenciacaminos.com.co' && compartidos.every((c) => c.rol === 'reader' && c.aviso), 'comparte solo (para ver) el calendario nuevo con COMPARTIR_CON');
r = ctx.sincronizar();
ok(r.iguales === 3 && r.calendarios === 0 && r.movidos === 0, 'sin cambios no crea calendarios ni mueve eventos');

grupos[1] = { ...grupos[1], parroquia: 'Parroquia Santa Teresita' };
r = ctx.sincronizar();
const st = calDe('Parroquia Santa Teresita');
ok(st && deEn(st, 3) && !deEn(sj, 3) && r.movidos === 1, 'si cambia la parroquia, el evento pasa al calendario de la nueva');
grupos[0] = { ...grupos[0], parroquia: '' };
r = ctx.sincronizar();
ok(deEn(cal, 1) && !deEn(sj, 1), 'si se quita la parroquia, vuelve a «Grupos Caminos»');
grupos[2] = { ...grupos[2], parroquia: 'Parroquia Santa Teresita' };
grupos[0] = { ...grupos[0], parroquia: 'Parroquia San José' };
delete calendarios[sj.id];
r = ctx.sincronizar();
const sj2 = calDe('Parroquia San José');
ok(sj2 && sj2 !== sj && deEn(sj2, 1), 'si borraron el calendario de una parroquia en Google, lo vuelve a crear');
grupos = grupos.filter((g) => g.id !== 3);
r = ctx.sincronizar();
ok(!deEn(st, 3) && r.borrados === 1, 'un grupo borrado sale también del calendario de su parroquia');
ok(!ajeno.borrado, 'sigue sin tocar los eventos que no creó');
const antes = compartidos.length;
ctx.compartirCalendarios();
ok(compartidos.length - antes === 2 * 3, 'compartirCalendarios comparte el principal y los de cada parroquia');

props.SUPABASE_KEY = 'sb_secret_abc';
error = '';
try { ctx.sincronizar(); } catch (e) { error = e.message; }
ok(/PUBLICABLE/.test(error), 'se niega a usar la llave secreta de Supabase');

console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nTodo OK');
process.exit(fallos.length ? 1 : 0);
