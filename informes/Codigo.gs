/* =====================================================================
   Intranet Caminos · Gestor de reservas (AppSheet) → Informes de gestión
   Lee la hoja de Google del gestor de reservas y manda a la intranet una
   fila resumida por venta. Corre solo cada 10 minutos. Pasos de
   instalación en informes/LEEME.md.

   - SOLO LEE la hoja: el permiso que pide es «ver hojas de cálculo»
     (spreadsheets.readonly). No puede cambiar ni borrar nada en ella.
   - No manda datos personales: ni clientes, ni solicitantes, ni
     pasajeros, ni teléfonos. Solo asesora, fechas, estado, tipo de venta,
     destino, plan, número de pasajeros y valores.
   - Entra a la intranet con la clave CLAVE_VENTAS, que la administración
     crea en «Informes de gestión». La intranet solo guarda su huella.
   ===================================================================== */

var HOJA_ID_PREDETERMINADA = '1k32N3e4r5jS0iWvyPWsUGr6XLY7homB5sEhJIj9Bjbg';

// Hojas y columnas que se leen (por nombre de encabezado, no por posición)
var HOJAS = {
  ventas: 'PIPELINE',
  servicios: 'SERVICIOS',
  pagos: 'CONTROL_PAGOS',
  pagosProv: 'PAGOS_PROVEEDORES',
  asesores: 'ASESORES',
  costeos: 'PANEL_DE_COSTEOS',
  proveedores: 'PROVEEDORES',
};

// ---------- Se corren a mano (menú «Ejecutar») ----------

// Prueba la conexión y deja la sincronización corriendo cada 10 minutos.
function instalar() {
  revisarPropiedades_();
  var r = sincronizar();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sincronizar').timeBased().everyMinutes(10).create();
  Logger.log('Listo: se sincroniza cada 10 minutos. Primera vuelta: ' + JSON.stringify(r));
}

// Para dejar de sincronizar (los informes se quedan con la última vuelta).
function desinstalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizar') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Sincronización detenida.');
}

// ---------- Sincronización ----------

function sincronizar() {
  var props = revisarPropiedades_();
  var libro = SpreadsheetApp.openById(props.HOJA_ID || HOJA_ID_PREDETERMINADA);
  var tablas = {};
  Object.keys(HOJAS).forEach(function (k) {
    var hoja = libro.getSheetByName(HOJAS[k]);
    tablas[k] = hoja ? hoja.getDataRange().getValues() : [];
  });
  if (!tablas.ventas.length) throw new Error('No encuentro la hoja ' + HOJAS.ventas + ' en el gestor de reservas.');
  var res = construirFilas_(tablas);
  var url = props.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/sincronizar_ventas';
  var r = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: props.SUPABASE_KEY },
    payload: JSON.stringify({ p_clave: props.CLAVE_VENTAS, p_filas: res.filas }),
    muteHttpExceptions: true,
  });
  var codigo = r.getResponseCode();
  if (codigo === 401 || codigo === 403 || (codigo >= 300 && /clave/i.test(r.getContentText()))) {
    throw new Error('La intranet no aceptó la clave. Crea una nueva en «Informes de gestión» y cópiala en la propiedad CLAVE_VENTAS.');
  }
  if (codigo >= 300) throw new Error('La intranet respondió ' + codigo + ': ' + r.getContentText().slice(0, 300));
  var cuenta = { enviadas: res.filas.length, omitidas: res.omitidas };
  Logger.log(JSON.stringify(cuenta));
  return cuenta;
}

// ---------- De la hoja al resumen (sin datos personales) ----------

function construirFilas_(t) {
  var asesores = indice_(t.asesores, ['Email', 'Correo'], ['Nombre']);
  var planes = indice_(t.costeos, ['ID_Costeo'], ['Nombre_Plan']);
  var proveedores = indice_(t.proveedores, ['ID Proveedor', 'ID_Proveedor'], ['Nombre Comercial', 'Razón Social']);

  // Servicios por venta: valor (gran total) y costo (total proveedor)
  var porVenta = {};
  recorrer_(t.servicios, function (f) {
    var id = texto_(f('ID_Venta'));
    if (!id) return;
    var v = porVenta[id] || (porVenta[id] = { valor: 0, costo: 0, tipos: {}, prov: {}, cobrado: 0, pagadoProv: 0 });
    var valor = num_(f('Gran_Total_Servicio', 'Gran_Total'));
    var costo = num_(f('Total Proveedor', 'Total_Proveedor'));
    v.valor += valor;
    v.costo += costo;
    var tipo = texto_(f('Tipo_Servicio')) || 'Otros';
    var tp = v.tipos[tipo] || (v.tipos[tipo] = { tipo: tipo, valor: 0, costo: 0 });
    tp.valor += valor;
    tp.costo += costo;
    var idProv = texto_(f('Proveedor'));
    if (idProv && costo) {
      var nombre = proveedores[idProv] || 'Proveedor ' + idProv.slice(0, 6);
      v.prov[nombre] = (v.prov[nombre] || 0) + costo;
    }
  });
  // Abonos del cliente (sin anulados ni pendientes)
  recorrer_(t.pagos, function (f) {
    var id = texto_(f('ID_Venta'));
    var estado = texto_(f('Estado_Pago')).toUpperCase();
    if (!id || estado === 'ANULADO' || estado === 'PENDIENTE') return;
    var v = porVenta[id] || (porVenta[id] = { valor: 0, costo: 0, tipos: {}, prov: {}, cobrado: 0, pagadoProv: 0 });
    var cop = num_(f('Abono_Equivalente_COP'));
    v.cobrado += cop || num_(f('Monto'));
  });
  // Pagos hechos a proveedores
  recorrer_(t.pagosProv, function (f) {
    var id = texto_(f('ID_Venta'));
    if (!id || texto_(f('Estado_Pago_Prov')).toLowerCase() !== 'pagado') return;
    var v = porVenta[id] || (porVenta[id] = { valor: 0, costo: 0, tipos: {}, prov: {}, cobrado: 0, pagadoProv: 0 });
    v.pagadoProv += num_(f('Monto')) || num_(f('Costo_Neto'));
  });

  var filas = [], omitidas = 0, vistos = {};
  recorrer_(t.ventas, function (f) {
    var id = texto_(f('ID_Venta'));
    var fecha = fecha_(f('Fecha_Registro'));
    var estado = texto_(f('Estado'));
    if (!id || !fecha || !estado || vistos[id]) { if (id || estado) omitidas++; return; }
    vistos[id] = true;
    var correo = texto_(f('Agente')).toLowerCase();
    var s = porVenta[id] || { valor: 0, costo: 0, tipos: {}, prov: {}, cobrado: 0, pagadoProv: 0 };
    var plan = texto_(f('Paquete_Religioso'));
    filas.push({
      id: id.slice(0, 60),
      asesora: (asesores[correo] || correo.split('@')[0] || '').slice(0, 80),
      fecha: fecha,
      estado: estado.slice(0, 40),
      tipo_venta: texto_(f('Tipo_Venta')).slice(0, 60),
      tipo_viaje: capital_(texto_(f('Tipo_De_Viaje'))).slice(0, 40),
      destino: texto_(f('Destino')).slice(0, 120),
      plan: (plan ? planes[plan] || '' : '').slice(0, 160),
      salida: fecha_(f('Fecha_Ida')),
      regreso: fecha_(f('Fecha_Regreso')),
      pasajeros: Math.max(0, Math.min(10000, Math.round(num_(f('Numero_Pasajeros_Estimados'))))),
      valor: redondo_(s.valor),
      costo: redondo_(s.costo),
      cobrado: redondo_(s.cobrado),
      pagado_prov: redondo_(s.pagadoProv),
      seguimiento: (texto_(f('Estado_Segundo_Seguimiento')) || texto_(f('Estado_Pimer_Seguimiento', 'Estado_Primer_Seguimiento'))).slice(0, 120),
      servicios: Object.keys(s.tipos).map(function (k) {
        return { tipo: k.slice(0, 60), valor: redondo_(s.tipos[k].valor), costo: redondo_(s.tipos[k].costo) };
      }),
      proveedores: Object.keys(s.prov).map(function (k) { return { nombre: k.slice(0, 80), costo: redondo_(s.prov[k]) }; }),
    });
  });
  return { filas: filas, omitidas: omitidas };
}

// ---------- Ayudas ----------

function revisarPropiedades_() {
  var p = PropertiesService.getScriptProperties().getProperties();
  var falta = ['SUPABASE_URL', 'SUPABASE_KEY', 'CLAVE_VENTAS'].filter(function (k) { return !p[k]; });
  if (falta.length) throw new Error('Faltan propiedades del script: ' + falta.join(', ') + ' (ver informes/LEEME.md).');
  if (/^sb_secret_|service_role/.test(p.SUPABASE_KEY)) throw new Error('SUPABASE_KEY debe ser la llave PUBLICABLE (sb_publishable_…), nunca la secreta.');
  return p;
}

// Recorre una hoja (primera fila = encabezados) y da una función para leer
// cada columna por su nombre.
function recorrer_(tabla, fn) {
  if (!tabla || tabla.length < 2) return;
  var pos = {};
  tabla[0].forEach(function (h, i) { pos[normal_(h)] = i; });
  for (var r = 1; r < tabla.length; r++) {
    var fila = tabla[r];
    // Con varios nombres de columna, el primero que tenga dato
    fn(function () {
      for (var a = 0; a < arguments.length; a++) {
        var i = pos[normal_(arguments[a])];
        if (i != null && fila[i] !== '' && fila[i] != null) return fila[i];
      }
      return '';
    });
  }
}

function indice_(tabla, claves, valores) {
  var m = {};
  recorrer_(tabla, function (f) {
    var k = texto_(f.apply(null, claves));
    var v = texto_(f.apply(null, valores));
    if (k && v) m[k.indexOf('@') > 0 ? k.toLowerCase() : k] = v;
  });
  return m;
}

function normal_(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s_]+/g, '').toLowerCase();
}
function texto_(v) { return v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); }
function capital_(s) { s = s.toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
function redondo_(n) { return Math.round(n * 100) / 100; }

// Números: vienen como número; si vienen como texto, «$ 1.234.567,5» o «1,234,567.5»
function num_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var s = texto_(v).replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  var coma = s.lastIndexOf(','), punto = s.lastIndexOf('.');
  if (coma > -1 && punto > -1) s = coma > punto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (coma > -1) s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1 || /^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  var n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

// Fechas: Date de la hoja, «dd/mm/aaaa [hh:mm]» o «aaaa-mm-dd» → «aaaa-mm-dd»
function fecha_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return v.getFullYear() + '-' + dos_(v.getMonth() + 1) + '-' + dos_(v.getDate());
  }
  var s = texto_(v), m;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return valida_(+m[3], +m[2], +m[1]);
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return valida_(+m[1], +m[2], +m[3]);
  return null;
}
function valida_(a, m, d) {
  var f = new Date(a, m - 1, d);
  if (a < 2000 || a > 2100 || f.getMonth() !== m - 1 || f.getDate() !== d) return null;
  return a + '-' + dos_(m) + '-' + dos_(d);
}
function dos_(n) { return (n < 10 ? '0' : '') + n; }
