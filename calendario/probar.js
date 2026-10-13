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
const cal = nuevoCalendario('grupos');
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
    getCalendarById: (id) => (id === cal.id ? cal : null),
    createCalendar: (n) => nuevoCalendario(n),
  },
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

props.SUPABASE_KEY = 'sb_secret_abc';
error = '';
try { ctx.sincronizar(); } catch (e) { error = e.message; }
ok(/PUBLICABLE/.test(error), 'se niega a usar la llave secreta de Supabase');

console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nTodo OK');
process.exit(fallos.length ? 1 : 0);
