// Prueba informes/Codigo.gs fuera de Google, con una hoja y una intranet simuladas.
// Uso: node informes/probar.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fallos = [];
const ok = (c, msg) => { if (c) console.log('OK    ' + msg); else { console.log('FALLO ' + msg); fallos.push(msg); } };

// ---------- Hoja simulada: solo existe getValues (nada para escribir) ----------
const hojas = {
  PIPELINE: [
    ['ID_Venta', 'ID_Cliente', 'Agente', 'Fecha_Registro', 'Solicitante', 'Pasajeros_Viajando', 'Tipo_Venta', 'Tipo_De_Viaje', 'Destino', 'Fecha_Ida', 'Fecha_Regreso', 'Estado', 'Estado_Pimer_Seguimiento', 'Estado_Segundo_Seguimiento', 'Numero_Pasajeros_Estimados', 'Paquete_Religioso'],
    ['v1', 'c1', 'Ana@Agencia.co', new Date(2026, 8, 3), 'María Pérez 3001234567', 'p1,p2', 'Religioso', 'NACIONAL', 'Pasto', '21/09/2026', '24/09/2026', 'Facturado', '', '', 2, 'k1'],
    ['v2', 'c2', 'beto@agencia.co', '15/10/2026 10:22', 'Juan Gómez', 'p3', 'Vacacional', 'INTERNACIONAL', 'Punta Cana', '', '', 'Cancelada', 'No contesta', 'Lo encontró más económico', '3', ''],
    ['v3', 'c3', 'sin-asesor@agencia.co', '2026-11-02', 'X', '', 'Mayorista', 'NACIONAL', 'Cartagena', '', '', 'Cotizado', 'Recotización', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['v4', '', 'ana@agencia.co', 'no es fecha', '', '', '', '', '', '', '', 'Cotizado', '', '', '', ''],
    ['v1', '', 'ana@agencia.co', '01/09/2026', '', '', '', '', '', '', '', 'Cotizado', '', '', '', ''],
  ],
  SERVICIOS: [
    ['ID_Servicio', 'ID_Venta', 'ID_Pasajero', 'Tipo_Servicio', 'Proveedor', 'Total Proveedor', 'Gran_Total_Servicio'],
    ['s1', 'v1', 'p1', 'Vuelo', 'pr1', 800000, 1000000],
    ['s2', 'v1', 'p2', 'Plan Terrestre', 'pr2', '$ 1.200.000', '1.500.000,50'],
    ['s3', 'v2', 'p3', 'Hotel', '', 400000, 500000],
  ],
  CONTROL_PAGOS: [
    ['ID_Pago', 'ID_Venta', 'Monto', 'Estado_Pago', 'Abono_Equivalente_COP'],
    ['a1', 'v1', 1000000, 'CONFIRMADO', 1000000],
    ['a2', 'v1', 900000, 'ANULADO', 900000],
    ['a3', 'v1', 500000, 'PENDIENTE', 500000],
  ],
  PAGOS_PROVEEDORES: [
    ['ID_Gasto', 'ID_Venta', 'Monto', 'Estado_Pago_Prov'],
    ['g1', 'v1', 800000, 'Pagado'],
    ['g2', 'v1', 1200000, 'Pendiente'],
  ],
  ASESORES: [['Email', 'Nombre', 'Celular'], ['ana@agencia.co', 'Ana', '300'], ['beto@agencia.co', 'Beto', '301']],
  PANEL_DE_COSTEOS: [['ID_Costeo', 'Nombre_Plan', 'Parroquia_Cliente'], ['k1', 'PEREGRINACIÓN NARIÑO', 'x']],
  PROVEEDORES: [['ID Proveedor', 'Razón Social', 'Nombre Comercial'], ['pr1', 'Aerolínea SAS', 'Aerolínea'], ['pr2', 'Operador SAS', '']],
};
const abiertas = [];
const SpreadsheetApp = {
  openById(id) {
    abiertas.push(id);
    return { getSheetByName: (n) => (hojas[n] ? { getDataRange: () => ({ getValues: () => hojas[n].map((f) => f.slice()) }) } : null) };
  },
};
let props = { SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co/', SUPABASE_KEY: 'sb_publishable_x', CLAVE_VENTAS: 'c'.repeat(48) };
const pedidos = [];
let respuesta = { codigo: 200, texto: '3' };
const UrlFetchApp = {
  fetch(url, o) { pedidos.push({ url, o, cuerpo: JSON.parse(o.payload) }); return { getResponseCode: () => respuesta.codigo, getContentText: () => respuesta.texto }; },
};
const disparadores = [];
const ScriptApp = {
  getProjectTriggers: () => disparadores.slice(),
  deleteTrigger: (t) => disparadores.splice(disparadores.indexOf(t), 1),
  newTrigger: (fn) => ({ timeBased: () => ({ everyMinutes: (m) => ({ create: () => disparadores.push({ fn, m, getHandlerFunction: () => fn }) }) }) }),
};
const ctx = {
  SpreadsheetApp, UrlFetchApp, ScriptApp, Logger: { log() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperties: () => Object.assign({}, props) }) },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'Codigo.gs'), 'utf8'), ctx);

// ---------- Pruebas ----------
const r = ctx.sincronizar();
const env = pedidos[0];
ok(env && env.url === 'https://abcdefghijklmnopqrst.supabase.co/rest/v1/rpc/sincronizar_ventas', 'llama a sincronizar_ventas');
ok(env.o.headers.apikey === 'sb_publishable_x' && env.cuerpo.p_clave === 'c'.repeat(48), 'manda la llave publicable y la clave del script');
ok(abiertas[0] === '1k32N3e4r5jS0iWvyPWsUGr6XLY7homB5sEhJIj9Bjbg', 'abre el gestor de reservas');
const filas = env.cuerpo.p_filas, f = (id) => filas.find((x) => x.id === id);
ok(filas.length === 3 && r.enviadas === 3, 'manda las tres ventas válidas');
ok(r.omitidas === 2, 'omite la venta sin fecha y la repetida (cuenta 2)');
const texto = JSON.stringify(filas);
ok(!/María|Juan|3001234567|p1|c1|celular|300/i.test(texto.replace(/"pasajeros":\d+/g, '')), 'no manda datos personales (clientes, pasajeros, teléfonos)');
ok(f('v1').asesora === 'Ana' && f('v2').asesora === 'Beto', 'traduce el correo de la asesora a su nombre (sin importar mayúsculas)');
ok(f('v3').asesora === 'sin-asesor', 'sin nombre, usa la parte del correo antes de @');
ok(f('v1').fecha === '2026-09-03' && f('v2').fecha === '2026-10-15' && f('v3').fecha === '2026-11-02', 'lee fechas como Date, dd/mm/aaaa hh:mm y aaaa-mm-dd');
ok(f('v1').salida === '2026-09-21' && f('v2').salida === null, 'fecha de salida o null');
ok(f('v1').valor === 2500000.5 && f('v1').costo === 2000000, 'valor = suma del gran total; costo = total proveedor (también con texto «$ 1.200.000»)');
ok(f('v1').cobrado === 1000000, 'cobrado: solo abonos confirmados (no anulados ni pendientes)');
ok(f('v1').pagado_prov === 800000, 'pagado a proveedores: solo los pagados');
ok(f('v1').plan === 'PEREGRINACIÓN NARIÑO' && f('v2').plan === '', 'nombre del plan desde el panel de costeos');
ok(f('v1').tipo_viaje === 'Nacional' && f('v2').tipo_viaje === 'Internacional', 'tipo de viaje en formato de título');
ok(f('v2').seguimiento === 'Lo encontró más económico' && f('v3').seguimiento === 'Recotización', 'seguimiento: el segundo si existe, si no el primero');
ok(f('v1').pasajeros === 2 && f('v2').pasajeros === 3 && f('v3').pasajeros === 0, 'número de pasajeros');
ok(f('v1').servicios.length === 2 && f('v1').servicios[0].tipo === 'Vuelo' && f('v1').servicios[0].valor === 1000000, 'resumen por tipo de servicio');
ok(f('v1').proveedores.some((p) => p.nombre === 'Aerolínea' && p.costo === 800000) && f('v1').proveedores.some((p) => p.nombre === 'Operador SAS'), 'proveedor por nombre comercial (o razón social)');

// Errores claros
respuesta = { codigo: 400, texto: '{"message":"Clave de los informes no válida."}' };
let msg = '';
try { ctx.sincronizar(); } catch (e) { msg = e.message; }
ok(/no aceptó la clave/.test(msg), 'clave mala: explica que hay que crear una nueva');
respuesta = { codigo: 500, texto: 'falló' };
try { ctx.sincronizar(); msg = ''; } catch (e) { msg = e.message; }
ok(/respondió 500/.test(msg), 'otro error: muestra el código');
respuesta = { codigo: 200, texto: '3' };
props.SUPABASE_KEY = 'sb_secret_abc';
try { ctx.sincronizar(); msg = ''; } catch (e) { msg = e.message; }
ok(/PUBLICABLE/.test(msg), 'rechaza la llave secreta');
props.SUPABASE_KEY = 'sb_publishable_x';
delete props.CLAVE_VENTAS;
try { ctx.sincronizar(); msg = ''; } catch (e) { msg = e.message; }
ok(/CLAVE_VENTAS/.test(msg), 'avisa si falta la clave');
props.CLAVE_VENTAS = 'c'.repeat(48);

// Instalar deja un solo disparador de 10 minutos
ctx.instalar();
ctx.instalar();
ok(disparadores.length === 1 && disparadores[0].m === 10 && disparadores[0].fn === 'sincronizar', 'instalar deja un solo disparador cada 10 minutos');
ctx.desinstalar();
ok(disparadores.length === 0, 'desinstalar quita el disparador');
const manifiesto = JSON.parse(fs.readFileSync(path.join(__dirname, 'appsscript.json'), 'utf8'));
ok(manifiesto.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets.readonly') && !manifiesto.oauthScopes.some((s) => /spreadsheets$|drive/.test(s)), 'el permiso sobre la hoja es SOLO LECTURA');

console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nTodo OK');
process.exit(fallos.length ? 1 : 0);
