/* =====================================================================
   Supabase simulado · Intranet Caminos
   Reemplaza a supabase-js en pruebas/demo.html. Guarda todo en memoria
   (al recargar vuelve a empezar) y expone la misma API que usa app.js:
   auth, from() con filtros, rpc(), storage y functions.

   Imita las reglas RLS principales para que cada rol vea lo que le toca,
   pero NO reemplaza las pruebas de permisos en Postgres
   (supabase/pruebas): sirve para la interfaz.

   Datos sembrados: personas FICTICIAS de ejemplo (correo @caminos.example),
   todas entran directo; el primer ingreso (cambio de contraseña y datos) se
   ve al crear una cuenta nueva desde Equipo.
   una sede (Bogotá), turnos de ejemplo y 45 días de jornadas generadas
   con una semilla fija. Contraseña de todas las cuentas: clave1234.
   ===================================================================== */
(function () {
  'use strict';

  const CLAVE_DEMO = 'clave1234';
  const TZ = 'America/Bogota';
  const OFFSET_H = 5; // Bogotá: UTC−5 todo el año
  const LATENCIA = 70;

  // ---------- Utilidades ----------
  let semilla = 20261006;
  function azar() { // mulberry32
    semilla |= 0; semilla = (semilla + 0x6D2B79F5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));
  const clonar = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
  const ahoraISO = () => new Date().toISOString();
  const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); });
  function fechaHoy() {
    const p = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; });
    return `${p.year}-${p.month}-${p.day}`;
  }
  function minutoAhora() {
    const p = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; });
    return +p.hour * 60 + +p.minute;
  }
  function sumarDias(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  const isodow = (iso) => { const g = new Date(iso + 'T12:00:00Z').getUTCDay(); return g === 0 ? 7 : g; };
  const toMin = (t) => (t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : null);
  // fecha local + minutos → timestamptz ISO
  function marcaISO(fecha, min) {
    const [y, m, d] = fecha.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, OFFSET_H, 0, 0) + min * 60000 + entre(0, 59) * 1000).toISOString();
  }
  const err = (message, code) => ({ message, code: code || 'P0001', details: null, hint: null });
  const espera = () => new Promise((r) => setTimeout(r, LATENCIA));

  // ---------- Datos sembrados ----------
  const HOY = fechaHoy();
  const db = {
    sedes: [{ id: 1, nombre: 'Bogotá', zona_horaria: TZ, ips_oficina: [] }],
    areas: [{ id: 1, nombre: 'Gerencia' }, { id: 2, nombre: 'Ventas' }, { id: 3, nombre: 'Operaciones' }, { id: 4, nombre: 'Contabilidad' }],
    turnos: [
      { id: 1, sede_id: 1, codigo: '1', nombre: 'Turno 1', entrada: '07:00:00', salida_almuerzo: '12:00:00', regreso_almuerzo: '13:00:00', salida: '16:30:00', activo: true },
      { id: 2, sede_id: 1, codigo: '2', nombre: 'Turno 2', entrada: '07:00:00', salida_almuerzo: '12:00:00', regreso_almuerzo: '13:00:00', salida: '16:00:00', activo: true },
      { id: 3, sede_id: 1, codigo: '3', nombre: 'Turno 3', entrada: '08:00:00', salida_almuerzo: '13:00:00', regreso_almuerzo: '14:00:00', salida: '17:30:00', activo: true },
      { id: 4, sede_id: 1, codigo: '4', nombre: 'Turno 4', entrada: '08:00:00', salida_almuerzo: '13:00:00', regreso_almuerzo: '14:00:00', salida: '17:00:00', activo: true },
      { id: 5, sede_id: 1, codigo: 'S1', nombre: 'Sábado 1', entrada: '08:00:00', salida_almuerzo: null, regreso_almuerzo: null, salida: '12:00:00', activo: true },
      { id: 6, sede_id: 1, codigo: 'D', nombre: 'Descanso', entrada: null, salida_almuerzo: null, regreso_almuerzo: null, salida: null, activo: true },
      { id: 7, sede_id: 1, codigo: 'V', nombre: 'Vacaciones', entrada: null, salida_almuerzo: null, regreso_almuerzo: null, salida: null, activo: true },
    ],
    perfiles: [], configuracion: [], horario_base: [], malla: [], malla_historial: [], marcas: [],
    herramientas: [
      { id: 1, nombre: 'Gestor de reservas', descripcion: 'La app de operación de Caminos: ventas, reservas, pasajeros y proveedores.', icono: 'reservas', pie: 'AppSheet', url: 'https://www.appsheet.com/start/eb769707-eafd-445c-aa00-eb637321ef76#appName=GESTORDERESERVAS-CAMINOS2-850658711&view=INICIO', orden: 1, areas_visibles: null, activo: true },
      { id: 2, nombre: 'Caminos Documentos', descripcion: 'Cotizaciones, confirmaciones, vouchers e itinerarios con el diseño de Caminos.', icono: 'documentos', pie: 'Claude', url: 'https://claude.ai/artifact/WPzKkP7MwdKBaGrrGVpZ1Y', orden: 2, areas_visibles: null, activo: true },
      { id: 3, nombre: 'Cotizador OMNIAXIS', descripcion: 'Plantilla maestra del cotizador.', icono: 'cotizador', pie: 'Google Sheets', url: 'https://docs.google.com/spreadsheets/d/1n_wPCi90RUk69Yiclf-Uc1viJZIWQs7Qc1Z5k1ZUWM0/edit?gid=131584006#gid=131584006', orden: 3, areas_visibles: null, activo: true },
    ],
    comunicados: [], comunicado_imagenes: [], comunicado_lecturas: [], solicitudes: [], solicitud_adjuntos: [], revisores: [],
  };
  const SERIAL = ['sedes', 'areas', 'turnos', 'malla_historial', 'marcas', 'herramientas', 'comunicados', 'comunicado_imagenes', 'solicitudes', 'solicitud_adjuntos'];
  const CLAVES = {
    malla: ['persona_id', 'fecha'], horario_base: ['persona_id', 'dia'], comunicado_lecturas: ['comunicado_id', 'persona_id'],
    revisores: ['persona_id'], configuracion: ['clave'], perfiles: ['id'], turnos: ['sede_id', 'codigo'], marcas: ['persona_id', 'fecha', 'tipo'],
  };
  const sigId = {};

  // Personas ficticias (correo @caminos.example, dominio reservado para ejemplos)
  const GENTE = [
    { id: 'a0000000-0000-4000-8000-000000000001', nombre: 'Andrea Rojas', correo: 'andrea.rojas@caminos.example', area_id: 1, rol: 'gerente', es_admin: true, etiqueta: 'Gerencia y administración' },
    { id: 'a0000000-0000-4000-8000-000000000002', nombre: 'Carolina Méndez', correo: 'carolina.mendez@caminos.example', area_id: 3, rol: 'directora', etiqueta: 'Directora de operaciones', horario: [3, 3, 3, 3, 4, 5] },
    { id: 'a0000000-0000-4000-8000-000000000003', nombre: 'Julián Torres', correo: 'julian.torres@caminos.example', area_id: 4, rol: 'supervisor', etiqueta: 'Supervisor (contabilidad)', horario: [1, 1, 1, 1, 2, null] },
    { id: 'a0000000-0000-4000-8000-000000000004', nombre: 'Daniela Castro', correo: 'daniela.castro@caminos.example', area_id: 2, rol: 'colaborador', etiqueta: 'Colaboradora (ventas)', horario: [1, 1, 1, 1, 2, 5], hoyLibre: true },
    { id: 'a0000000-0000-4000-8000-000000000005', nombre: 'Santiago Pérez', correo: 'santiago.perez@caminos.example', area_id: 2, rol: 'colaborador', horario: [3, 3, 3, 3, 4, null] },
    { id: 'a0000000-0000-4000-8000-000000000006', nombre: 'Valentina Ruiz', correo: 'valentina.ruiz@caminos.example', area_id: 3, rol: 'colaborador', horario: [1, 1, 1, 1, 2, 5] },
    { id: 'a0000000-0000-4000-8000-000000000007', nombre: 'Felipe Moreno', correo: 'felipe.moreno@caminos.example', area_id: 2, rol: 'colaborador', horario: [3, 3, 3, 3, 4, 5], tardon: true },
    { id: 'a0000000-0000-4000-8000-000000000008', nombre: 'Laura Gómez', correo: 'laura.gomez@caminos.example', area_id: 3, rol: 'colaborador', activo: false },
  ];
  const ID = {};
  GENTE.forEach((g) => { ID[g.nombre.split(' ')[0].toLowerCase()] = g.id; });

  const usuarios = GENTE.map((g) => ({
    id: g.id, email: g.correo, password: CLAVE_DEMO, banned: g.activo === false,
    user_metadata: g.primerIngreso ? { debe_cambiar_contrasena: true } : {},
  }));
  db.perfiles = GENTE.map((g) => ({
    id: g.id, nombre: g.nombre, correo: g.correo, area_id: g.area_id, sede_id: 1, rol: g.rol, es_admin: !!g.es_admin,
    activo: g.activo !== false, acepto_datos: g.primerIngreso ? null : sumarDias(HOY, -60) + 'T13:00:00Z', creado: sumarDias(HOY, -90) + 'T13:00:00Z',
  }));
  GENTE.forEach((g) => (g.horario || []).forEach((t, i) => { if (t) db.horario_base.push({ persona_id: g.id, dia: i + 1, turno_id: t, actualizado: ahoraISO(), actualizado_por: ID.carolina }); }));

  const INICIO = sumarDias(HOY, -60);
  db.configuracion = [
    { clave: 'modulo_solicitudes', valor: { activo: true }, actualizado: ahoraISO() },
    { clave: 'tolerancias', valor: { entrada_min: 5, almuerzo_min: 5 }, actualizado: ahoraISO() },
    { clave: 'meta_puntualidad', valor: { porcentaje: 95 }, actualizado: ahoraISO() },
    { clave: 'validar_ip', valor: { activo: false }, actualizado: ahoraISO() },
    { clave: 'inicio_horarios', valor: { fecha: INICIO }, actualizado: ahoraISO() },
  ];

  // Cambios puntuales de ejemplo
  const lunes = sumarDias(HOY, 1 - isodow(HOY));
  db.malla.push({ persona_id: ID.felipe, fecha: sumarDias(lunes, -5), turno_id: 1 });
  db.malla.push({ persona_id: ID.valentina, fecha: sumarDias(lunes, 5), turno_id: 6 });
  db.malla.push({ persona_id: ID.santiago, fecha: sumarDias(lunes, 5), turno_id: 5 });

  // Solicitudes de ejemplo
  const sol = (o) => db.solicitudes.push(Object.assign({ id: db.solicitudes.length + 1, hora_desde: null, hora_hasta: null, motivo: null, estado: 'pendiente', revisado_por: null, revisado_en: null, comentario: null, creado: ahoraISO() }, o));
  sol({ persona_id: ID.santiago, tipo: 'vacaciones', desde: sumarDias(HOY, -20), hasta: sumarDias(HOY, -16), motivo: 'Viaje familiar', estado: 'aprobada', revisado_por: ID.julián || ID['julián'], revisado_en: sumarDias(HOY, -30) + 'T15:00:00Z', creado: sumarDias(HOY, -33) + 'T15:00:00Z' });
  sol({ persona_id: ID.felipe, tipo: 'incapacidad', desde: sumarDias(HOY, -9), hasta: sumarDias(HOY, -8), motivo: 'Gripa', estado: 'aprobada', revisado_por: ID.andrea, revisado_en: sumarDias(HOY, -8) + 'T14:00:00Z', creado: sumarDias(HOY, -9) + 'T12:00:00Z' });
  sol({ persona_id: ID.felipe, tipo: 'permiso', desde: sumarDias(HOY, -12), hasta: sumarDias(HOY, -12), hora_desde: '15:00:00', hora_hasta: '17:00:00', motivo: 'Diligencia personal', estado: 'rechazada', revisado_por: ID['julián'], revisado_en: sumarDias(HOY, -13) + 'T14:00:00Z', comentario: 'Ese día hay cierre de mes; pásalo a otra fecha.', creado: sumarDias(HOY, -14) + 'T12:00:00Z' });
  sol({ persona_id: ID.valentina, tipo: 'permiso', desde: sumarDias(HOY, 5), hasta: sumarDias(HOY, 5), hora_desde: '14:00:00', hora_hasta: '16:00:00', motivo: 'Cita médica', creado: sumarDias(HOY, -1) + 'T16:00:00Z' });
  sol({ persona_id: ID.daniela, tipo: 'vacaciones', desde: sumarDias(HOY, 21), hasta: sumarDias(HOY, 25), motivo: 'Vacaciones de fin de año', creado: sumarDias(HOY, -2) + 'T16:00:00Z' });
  db.revisores.push({ persona_id: ID['julián'], sede_id: null, tipos: ['vacaciones', 'permiso'], nivel: 'aprobar' });

  // Comunicados de ejemplo
  const com = (o) => { const c = Object.assign({ id: db.comunicados.length + 1, cuerpo: '', destino: 'todos', destino_id: null, requiere_confirmacion: true, fijado: false }, o); db.comunicados.push(c); return c; };
  const c1 = com({ autor_id: ID.andrea, titulo: 'Bienvenidos a la intranet de Caminos', cuerpo: 'Desde hoy marcamos la jornada, consultamos la malla y pedimos vacaciones y permisos desde aquí.\nEn Inicio están los accesos al Gestor de reservas, a Caminos Documentos y al Cotizador.\nSi tienes dudas, abre la Guía de uso desde tu avatar.', fijado: true, creado: sumarDias(HOY, -10) + 'T13:10:00Z' });
  const c2 = com({ autor_id: ID.carolina, titulo: 'Cierre de mes: reportes de operación', cuerpo: 'Antes del último viernes del mes, cada persona de operaciones deja al día los pasajeros y pagos de sus reservas en el Gestor de reservas.', destino: 'area', destino_id: 3, creado: sumarDias(HOY, -3) + 'T14:30:00Z' });
  com({ autor_id: ID.andrea, titulo: 'Atención al cliente el sábado', cuerpo: 'Este sábado atendemos de 8:00 a 12:00. Revisa tu turno en la malla.', requiere_confirmacion: false, creado: sumarDias(HOY, -1) + 'T21:00:00Z' });
  db.comunicado_imagenes.push({ id: 1, comunicado_id: c1.id, ruta: c1.id + '/bienvenida.svg', nombre: 'bienvenida.svg', orden: 0 });
  ['carolina', 'julián', 'santiago', 'valentina'].forEach((n, i) => db.comunicado_lecturas.push({ comunicado_id: c1.id, persona_id: ID[n], leido_en: sumarDias(HOY, -10 + i) + 'T15:00:00Z' }));
  db.comunicado_lecturas.push({ comunicado_id: c2.id, persona_id: ID.laura, leido_en: sumarDias(HOY, -2) + 'T15:00:00Z' });

  // Imagen de ejemplo (dibujo con la estrella de la marca)
  const ESTRELLA = 'M339.16,587.19l25.9,207.53,26.12-205.32,66.68,38.99-40.16-68.24,101.38-25.73-102.55-23.79,42.5-68.63-69.02,40.94-24.76-101.77-23.98,102.55-69.02-43.28,42.5,69.8-103.72,23.79,103.33,24.56s-44.84,70.97-42.89,70.19c1.95-.78,67.69-41.6,67.69-41.6Z';
  const svgBienvenida = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#D63B4D"/><g transform="translate(760 120) scale(1.3) translate(-211 -381)" fill="#F6E7C9" opacity=".35"><path d="${ESTRELLA}"/></g><text x="90" y="330" font-family="Poppins, sans-serif" font-size="44" font-weight="600" letter-spacing="6" fill="#FFFFFF" opacity=".9">INTRANET</text><text x="90" y="440" font-family="Poppins, sans-serif" font-size="96" font-weight="700" fill="#FFFFFF">Bienvenidos</text><rect x="92" y="490" width="120" height="10" rx="5" fill="#F5B75F"/><text x="90" y="590" font-family="Poppins, sans-serif" font-size="36" fill="#FFFFFF">Caminos · Para ir más lejos</text></svg>`;
  const archivos = { 'comunicados/1/bienvenida.svg': 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgBienvenida) };

  // ---------- Malla efectiva (misma lógica que la función SQL) ----------
  function mallaEfectiva(desde, hasta) {
    const inicio = (cfg('inicio_horarios') || {}).fecha || '9999-12-31';
    const out = db.malla.filter((m) => m.fecha >= desde && m.fecha <= hasta).map((m) => ({ persona_id: m.persona_id, fecha: m.fecha, turno_id: m.turno_id, cambio: true }));
    const conBase = new Set(db.horario_base.map((h) => h.persona_id));
    db.perfiles.filter((p) => p.activo && conBase.has(p.id)).forEach((p) => {
      const d0 = db.turnos.filter((t) => t.sede_id === p.sede_id && t.codigo === 'D').sort((a, b) => a.id - b.id)[0];
      for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
        if (f < inicio) continue;
        if (db.malla.some((m) => m.persona_id === p.id && m.fecha === f)) continue;
        const hb = db.horario_base.find((h) => h.persona_id === p.id && h.dia === isodow(f));
        const tid = hb ? hb.turno_id : d0 && d0.id;
        if (tid) out.push({ persona_id: p.id, fecha: f, turno_id: tid, cambio: false });
      }
    });
    return out;
  }
  const cfg = (c) => { const r = db.configuracion.find((x) => x.clave === c); return r && r.valor; };

  // ---------- Jornadas generadas (45 días, semilla fija) ----------
  (function generarMarcas() {
    const desde = sumarDias(HOY, -45);
    const ahora = minutoAhora();
    const aus = (pid, f) => db.solicitudes.some((s) => s.persona_id === pid && s.estado === 'aprobada' && !s.hora_desde && s.desde <= f && s.hasta >= f);
    mallaEfectiva(desde, HOY).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).forEach((m) => {
      const t = db.turnos.find((x) => x.id === m.turno_id);
      if (!t || !t.entrada) return;
      const g = GENTE.find((x) => x.id === m.persona_id);
      if (aus(m.persona_id, m.fecha)) return;
      const esHoy = m.fecha === HOY;
      if (esHoy && g.hoyLibre) return; // la cuenta de demostración marca ella misma
      if (!esHoy && azar() < 0.03) return; // olvidó marcar
      const r = azar();
      const tarde = g.tardon ? r < 0.3 : r < 0.1;
      const ent = toMin(t.entrada) + (tarde ? entre(6, 28) : entre(-12, 4));
      const marcas = [['entrada', ent]];
      if (t.salida_almuerzo) {
        const sa = toMin(t.salida_almuerzo) + entre(-4, 6);
        const larga = azar() < 0.08;
        const dur = toMin(t.regreso_almuerzo) - toMin(t.salida_almuerzo) + (larga ? entre(11, 25) : entre(-6, 4));
        marcas.push(['salida_almuerzo', sa], ['regreso_almuerzo', sa + dur]);
      }
      const r2 = azar();
      const sal = toMin(t.salida) + (r2 < 0.06 ? -entre(10, 40) : r2 < 0.16 ? entre(30, 80) : entre(0, 14));
      marcas.push(['salida', sal]);
      marcas.forEach(([tipo, min]) => {
        if (esHoy && min > ahora) return;
        if (esHoy && g.nombre === 'Santiago Pérez' && tipo === 'entrada' && ahora > toMin(t.entrada) + 20) return; // sin marcar hoy
        db.marcas.push({ id: db.marcas.length + 1, persona_id: m.persona_id, fecha: m.fecha, tipo, hora: marcaISO(m.fecha, min), ip: null, corregida_por: null });
      });
    });
    // regreso sin entrada no debe existir (por si Santiago no marcó la entrada hoy)
    db.marcas = db.marcas.filter((x) => x.fecha !== HOY || x.tipo === 'entrada' || db.marcas.some((y) => y.persona_id === x.persona_id && y.fecha === HOY && y.tipo === 'entrada'));
    db.marcas.forEach((x, i) => { x.id = i + 1; });
  })();

  SERIAL.forEach((t) => { sigId[t] = db[t].reduce((m, r) => Math.max(m, r.id || 0), 0) + 1; });

  // ---------- Sesión y permisos (equivalentes a las funciones SQL) ----------
  let sesion = null;
  const oyentes = [];
  const uid = () => (sesion ? sesion.user.id : null);
  const yo = () => db.perfiles.find((p) => p.id === uid() && p.activo) || null;
  const perfil = (id) => db.perfiles.find((p) => p.id === id) || {};
  const esAdmin = () => !!(yo() && yo().es_admin);
  const esGerencia = () => !!(yo() && (yo().rol === 'gerente' || yo().es_admin));
  const esSupervisor = () => !!(yo() && yo().rol === 'supervisor');
  const lideraSede = (s) => !!(yo() && (esGerencia() || (yo().rol === 'directora' && yo().sede_id === s)));
  const puedePublicar = () => !!(yo() && (esGerencia() || yo().rol === 'directora'));
  const gestionaCuentas = () => esAdmin() || esSupervisor();
  const modulo = () => !!(cfg('modulo_solicitudes') || {}).activo;
  const esDestinatario = (c, pid) => { const p = perfil(pid); return p.activo && c.autor_id !== pid && (c.destino === 'todos' || (c.destino === 'area' && p.area_id === c.destino_id) || (c.destino === 'sede' && p.sede_id === c.destino_id)); };
  function puedeVerSolicitud(id) {
    const s = db.solicitudes.find((x) => x.id === id);
    if (!s || !yo()) return false;
    if (s.persona_id === uid() || esGerencia()) return true;
    const r = db.revisores.find((x) => x.persona_id === uid());
    return !!(r && r.tipos.includes(s.tipo) && (r.sede_id == null || r.sede_id === perfil(s.persona_id).sede_id));
  }
  const comVisible = (c) => c.autor_id === uid() || esGerencia() || puedePublicar() || esDestinatario(c, uid());

  // Reglas de lectura (USING de select)
  const LEER = {
    marcas: (r) => r.persona_id === uid() || lideraSede(perfil(r.persona_id).sede_id),
    comunicados: comVisible,
    comunicado_imagenes: (r) => { const c = db.comunicados.find((x) => x.id === r.comunicado_id); return !!c && comVisible(c); },
    comunicado_lecturas: (r) => r.persona_id === uid() || esGerencia() || puedePublicar(),
    solicitudes: (r) => puedeVerSolicitud(r.id),
    solicitud_adjuntos: (r) => puedeVerSolicitud(r.solicitud_id),
    revisores: (r) => r.persona_id === uid() || esGerencia(),
    herramientas: (r) => esGerencia() || (r.activo && (!r.areas_visibles || r.areas_visibles.includes((yo() || {}).area_id))),
  };
  // Reglas de escritura (USING y WITH CHECK)
  const sedeDePersona = (pid) => perfil(pid).sede_id;
  const autorOGerencia = (cid) => { const c = db.comunicados.find((x) => x.id === cid); return !!c && (c.autor_id === uid() || esGerencia()); };
  const solPendientePropia = (sid) => { const s = db.solicitudes.find((x) => x.id === sid); return !!s && s.persona_id === uid() && s.estado === 'pendiente'; };
  const ESCRIBIR = {
    sedes: () => esAdmin(), areas: () => esAdmin(), configuracion: () => esGerencia(), herramientas: () => esGerencia(),
    turnos: (r) => lideraSede(r.sede_id) || esSupervisor(),
    malla: (r) => lideraSede(sedeDePersona(r.persona_id)) || esSupervisor(),
    horario_base: (r) => lideraSede(sedeDePersona(r.persona_id)) || esSupervisor(),
    marcas: (r, op) => op !== 'insert' && lideraSede(sedeDePersona(r.persona_id)),
    comunicados: (r, op) => (op === 'insert' ? puedePublicar() && r.autor_id === uid() : r.autor_id === uid() || esGerencia()),
    comunicado_imagenes: (r) => autorOGerencia(r.comunicado_id),
    comunicado_lecturas: (r, op) => op === 'insert' && r.persona_id === uid() && esDestinatario(db.comunicados.find((c) => c.id === r.comunicado_id) || {}, uid()),
    solicitudes: (r, op) => (op === 'insert' ? r.persona_id === uid() && r.estado === 'pendiente' && !r.revisado_por && modulo() : op === 'delete' ? r.persona_id === uid() && r.estado === 'pendiente' : false),
    solicitud_adjuntos: (r) => solPendientePropia(r.solicitud_id),
    revisores: () => esGerencia(),
    perfiles: (r, op) => esAdmin() || (op === 'update' && gestionaCuentas() && r.id !== uid() && r.rol === 'colaborador' && !r.es_admin),
    malla_historial: () => false,
  };
  const DEFECTOS = {
    comunicados: () => ({ cuerpo: '', destino: 'todos', destino_id: null, requiere_confirmacion: true, fijado: false, creado: ahoraISO() }),
    solicitudes: () => ({ estado: 'pendiente', revisado_por: null, revisado_en: null, comentario: null, hora_desde: null, hora_hasta: null, motivo: null, creado: ahoraISO() }),
    comunicado_lecturas: () => ({ leido_en: ahoraISO() }),
    comunicado_imagenes: () => ({ orden: 0 }),
    turnos: () => ({ activo: true, entrada: null, salida_almuerzo: null, regreso_almuerzo: null, salida: null }),
    revisores: () => ({ sede_id: null, nivel: 'aprobar' }),
    horario_base: () => ({}),
    configuracion: () => ({ actualizado: ahoraISO() }),
  };
  function revisarRestricciones(tabla, r) {
    if (tabla === 'turnos' && ((!r.entrada) !== (!r.salida) || (!r.salida_almuerzo) !== (!r.regreso_almuerzo))) return err('new row for relation "turnos" violates check constraint', '23514');
    if (tabla === 'solicitudes' && (r.hasta < r.desde || (!r.hora_desde) !== (!r.hora_hasta))) return err('new row for relation "solicitudes" violates check constraint', '23514');
    if (tabla === 'comunicados' && (!r.titulo || r.titulo.length > 140)) return err('new row for relation "comunicados" violates check constraint', '23514');
    if (tabla === 'revisores' && (!r.tipos || !r.tipos.length)) return err('new row for relation "revisores" violates check constraint', '23514');
    return null;
  }
  const mismaClave = (tabla, a, b) => (CLAVES[tabla] || ['id']).every((k) => String(a[k]) === String(b[k]));
  function historial(op, antes, despues) {
    const r = despues || antes;
    db.malla_historial.push({ id: sigId.malla_historial++, persona_id: r.persona_id, fecha: r.fecha, turno_antes: antes ? antes.turno_id : null, turno_despues: despues ? despues.turno_id : null, cambiado_por: uid(), cambiado_en: ahoraISO() });
  }
  function cascada(tabla, filas) {
    if (tabla === 'comunicados') {
      const ids = new Set(filas.map((f) => f.id));
      db.comunicado_imagenes = db.comunicado_imagenes.filter((x) => !ids.has(x.comunicado_id));
      db.comunicado_lecturas = db.comunicado_lecturas.filter((x) => !ids.has(x.comunicado_id));
    }
    if (tabla === 'solicitudes') {
      const ids = new Set(filas.map((f) => f.id));
      db.solicitud_adjuntos = db.solicitud_adjuntos.filter((x) => !ids.has(x.solicitud_id));
    }
  }

  // ---------- Consultas ----------
  const igual = (a, b) => (a == null || b == null ? a == b : String(a) === String(b));
  class Consulta {
    constructor(tabla, fuente) {
      this.tabla = tabla; this.fuente = fuente; this.op = 'select'; this.filtros = []; this.orden = []; this.rango = null; this.lim = null; this.modo = null; this.devolver = false;
    }
    select() { if (this.op !== 'select') this.devolver = true; return this; }
    insert(filas) { this.op = 'insert'; this.datos = [].concat(filas); return this; }
    update(obj) { this.op = 'update'; this.datos = obj; return this; }
    upsert(filas, opc) { this.op = 'upsert'; this.datos = [].concat(filas); this.conflicto = opc && opc.onConflict ? opc.onConflict.split(',') : null; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(c, v) { this.filtros.push((r) => igual(r[c], v)); return this; }
    neq(c, v) { this.filtros.push((r) => !igual(r[c], v)); return this; }
    in(c, vs) { const s = new Set(vs.map(String)); this.filtros.push((r) => s.has(String(r[c]))); return this; }
    gte(c, v) { this.filtros.push((r) => r[c] >= v); return this; }
    lte(c, v) { this.filtros.push((r) => r[c] <= v); return this; }
    gt(c, v) { this.filtros.push((r) => r[c] > v); return this; }
    lt(c, v) { this.filtros.push((r) => r[c] < v); return this; }
    is(c, v) { this.filtros.push((r) => r[c] === v); return this; }
    order(c, opc) { this.orden.push([c, !opc || opc.ascending !== false]); return this; }
    range(a, b) { this.rango = [a, b]; return this; }
    limit(n) { this.lim = n; return this; }
    single() { this.modo = 'single'; return this; }
    maybeSingle() { this.modo = 'maybe'; return this; }
    then(ok, mal) { return espera().then(() => this.ejecutar()).then(ok, mal); }

    visibles() {
      const leer = LEER[this.tabla];
      return (this.fuente ? this.fuente() : db[this.tabla]).filter((r) => !leer || leer(r));
    }
    ordenar(filas) {
      if (!this.orden.length) return filas;
      return filas.slice().sort((a, b) => {
        for (const [c, asc] of this.orden) {
          const va = a[c], vb = b[c];
          if (va === vb) continue;
          if (va == null) return asc ? 1 : -1;
          if (vb == null) return asc ? -1 : 1;
          const r = va < vb ? -1 : 1;
          return asc ? r : -r;
        }
        return 0;
      });
    }
    resultado(filas) {
      let data = filas;
      if (this.modo === 'single') {
        if (data.length !== 1) return { data: null, error: err('JSON object requested, multiple (or no) rows returned', 'PGRST116') };
        data = data[0];
      } else if (this.modo === 'maybe') {
        if (data.length > 1) return { data: null, error: err('multiple rows returned', 'PGRST116') };
        data = data[0] || null;
      }
      return { data: clonar(data), error: null };
    }
    ejecutar() {
      if (this.error) return { data: null, error: this.error };
      if (this.op === 'select') {
        let filas = this.ordenar(this.visibles().filter((r) => this.filtros.every((f) => f(r))));
        if (this.rango) filas = filas.slice(this.rango[0], this.rango[1] + 1);
        if (this.lim != null) filas = filas.slice(0, this.lim);
        return this.resultado(filas);
      }
      const tabla = this.tabla, puede = ESCRIBIR[tabla] || (() => true);
      if (!yo()) return { data: null, error: err('permission denied for table ' + tabla, '42501') };
      if (this.op === 'insert' || this.op === 'upsert') {
        const hechas = [];
        for (const d of this.datos) {
          const existente = this.op === 'upsert' && db[tabla].find((r) => (this.conflicto || CLAVES[tabla] || ['id']).every((k) => igual(r[k], d[k])));
          if (existente) {
            const nueva = Object.assign({}, existente, clonar(d));
            if (!puede(existente, 'update') || !puede(nueva, 'update')) return { data: null, error: err('new row violates row-level security policy for table "' + tabla + '"', '42501') };
            const e = revisarRestricciones(tabla, nueva);
            if (e) return { data: null, error: e };
            if (tabla === 'malla') historial('update', clonar(existente), nueva);
            Object.assign(existente, clonar(d));
            hechas.push(existente);
            continue;
          }
          const fila = Object.assign((DEFECTOS[tabla] || (() => ({})))(), clonar(d));
          if (SERIAL.includes(tabla) && fila.id == null) fila.id = sigId[tabla]++;
          if (!puede(fila, 'insert')) return { data: null, error: err('new row violates row-level security policy for table "' + tabla + '"', '42501') };
          const e = revisarRestricciones(tabla, fila);
          if (e) return { data: null, error: e };
          if (db[tabla].some((r) => mismaClave(tabla, r, fila))) return { data: null, error: err('duplicate key value violates unique constraint', '23505') };
          db[tabla].push(fila);
          if (tabla === 'malla') historial('insert', null, fila);
          hechas.push(fila);
        }
        return this.devolver ? this.resultado(hechas) : { data: null, error: null };
      }
      const objetivo = this.visibles().filter((r) => this.filtros.every((f) => f(r)) && puede(r, this.op));
      if (this.op === 'update') {
        for (const r of objetivo) {
          const nueva = Object.assign({}, r, clonar(this.datos));
          if (!puede(nueva, 'update')) return { data: null, error: err('new row violates row-level security policy for table "' + tabla + '"', '42501') };
          const e = revisarRestricciones(tabla, nueva);
          if (e) return { data: null, error: e };
        }
        objetivo.forEach((r) => { const antes = clonar(r); Object.assign(r, clonar(this.datos)); if (tabla === 'malla') historial('update', antes, r); });
        return this.devolver ? this.resultado(objetivo) : { data: null, error: null };
      }
      if (this.op === 'delete') {
        const quitar = new Set(objetivo);
        db[tabla] = db[tabla].filter((r) => !quitar.has(r));
        if (tabla === 'malla') objetivo.forEach((r) => historial('delete', r, null));
        cascada(tabla, objetivo);
        return this.devolver ? this.resultado(objetivo) : { data: null, error: null };
      }
      return { data: null, error: err('operación no soportada') };
    }
  }

  // ---------- RPC ----------
  const NOMBRES_PASO = { entrada: 'la entrada', salida_almuerzo: 'la salida a almorzar', regreso_almuerzo: 'el regreso de almuerzo', salida: 'la salida' };
  const RPC = {
    marcar({ p_tipo }) {
      const p = yo();
      if (!p) throw err('Tu cuenta no está activa.');
      const hoy = fechaHoy();
      const ya = (t) => db.marcas.some((m) => m.persona_id === p.id && m.fecha === hoy && m.tipo === t);
      if (cfg('validar_ip') && cfg('validar_ip').activo) throw err('Solo puedes marcar desde la red de la oficina.');
      if ((p_tipo === 'salida_almuerzo' || p_tipo === 'salida') && !ya('entrada')) throw err('Primero marca la entrada.');
      if (p_tipo === 'regreso_almuerzo' && !ya('salida_almuerzo')) throw err('Primero marca la salida a almorzar.');
      if (ya(p_tipo)) throw err(`Ya marcaste ${NOMBRES_PASO[p_tipo]} hoy.`);
      const m = { id: db.marcas.length + 1, persona_id: p.id, fecha: hoy, tipo: p_tipo, hora: ahoraISO(), ip: null, corregida_por: null };
      db.marcas.push(m);
      return m;
    },
    revisar_solicitud({ p_id, p_aprobar, p_comentario }) {
      const s = db.solicitudes.find((x) => x.id === p_id);
      if (!s) throw err('La solicitud no existe.');
      if (s.persona_id === uid()) throw err('No puedes revisar tu propia solicitud.');
      if (s.estado !== 'pendiente') throw err('Esta solicitud ya fue revisada.');
      const r = db.revisores.find((x) => x.persona_id === uid());
      const ok = esGerencia() || (r && r.nivel === 'aprobar' && r.tipos.includes(s.tipo) && (r.sede_id == null || r.sede_id === perfil(s.persona_id).sede_id));
      if (!ok) throw err('No tienes permiso para revisar esta solicitud.');
      Object.assign(s, { estado: p_aprobar ? 'aprobada' : 'rechazada', revisado_por: uid(), revisado_en: ahoraISO(), comentario: (p_comentario || '').trim() || null });
      return s;
    },
    aceptar_datos() { const p = yo(); if (p && !p.acepto_datos) p.acepto_datos = ahoraISO(); return null; },
    ausencias_aprobadas({ p_desde, p_hasta }) {
      return db.solicitudes.filter((s) => s.estado === 'aprobada' && !s.hora_desde && s.desde <= p_hasta && s.hasta >= p_desde && (s.persona_id === uid() || lideraSede(perfil(s.persona_id).sede_id)))
        .map((s) => ({ persona_id: s.persona_id, tipo: s.tipo, desde: s.desde, hasta: s.hasta }));
    },
    es_admin() { return esAdmin(); },
    puede_gestionar_cuentas() { return gestionaCuentas(); },
    malla_efectiva({ p_desde, p_hasta }) { return mallaEfectiva(p_desde, p_hasta); },
  };
  function rpc(nombre, args) {
    const q = new Consulta('rpc:' + nombre, null);
    q.ejecutar = function () {
      if (!sesion) return { data: null, error: err('permission denied for function ' + nombre, '42501') };
      if (!RPC[nombre]) return { data: null, error: err('función desconocida: ' + nombre, '42883') };
      let res;
      try { res = RPC[nombre](args || {}); } catch (e) { return { data: null, error: e }; }
      if (!Array.isArray(res)) return { data: clonar(res), error: null };
      this.fuente = () => res;
      return Consulta.prototype.ejecutar.call(this);
    };
    return q;
  }

  // ---------- Auth ----------
  const avisar = (evento) => oyentes.forEach((cb) => { try { cb(evento, sesion); } catch (e) { /* nada */ } });
  const usuarioPublico = (u) => ({ id: u.id, email: u.email, user_metadata: clonar(u.user_metadata) });
  const auth = {
    async getSession() { await espera(); return { data: { session: sesion ? clonar(sesion) : null }, error: null }; },
    async getUser() { await espera(); return { data: { user: sesion ? clonar(sesion.user) : null }, error: null }; },
    async signInWithPassword({ email, password }) {
      await espera();
      const u = usuarios.find((x) => x.email === String(email).toLowerCase());
      if (!u || u.password !== password) return { data: { user: null, session: null }, error: { name: 'AuthApiError', message: 'Invalid login credentials', status: 400 } };
      if (u.banned) return { data: { user: null, session: null }, error: { name: 'AuthApiError', message: 'User is banned', status: 400 } };
      sesion = { access_token: 'demo-' + u.id, user: usuarioPublico(u) };
      avisar('SIGNED_IN');
      return { data: { user: clonar(sesion.user), session: clonar(sesion) }, error: null };
    },
    async updateUser({ password, data }) {
      await espera();
      if (!sesion) return { data: { user: null }, error: { message: 'Auth session missing!' } };
      const u = usuarios.find((x) => x.id === uid());
      if (password) {
        if (password === u.password) return { data: { user: null }, error: { name: 'AuthApiError', message: 'New password should be different from the old password.' } };
        u.password = password;
      }
      if (data) u.user_metadata = Object.assign({}, u.user_metadata, data);
      sesion.user = usuarioPublico(u);
      avisar('USER_UPDATED');
      return { data: { user: clonar(sesion.user) }, error: null };
    },
    async signOut() { await espera(); sesion = null; avisar('SIGNED_OUT'); return { error: null }; },
    onAuthStateChange(cb) { oyentes.push(cb); return { data: { subscription: { unsubscribe() { const i = oyentes.indexOf(cb); if (i >= 0) oyentes.splice(i, 1); } } } }; },
  };

  // ---------- Storage ----------
  function storage(bucket) {
    return {
      async upload(ruta, archivo) {
        await espera();
        const id = Number(String(ruta).split('/')[0]);
        const ok = bucket === 'comunicados' ? autorOGerencia(id) : solPendientePropia(id);
        if (!ok) return { data: null, error: err('new row violates row-level security policy', '42501') };
        archivos[bucket + '/' + ruta] = URL.createObjectURL(archivo);
        return { data: { path: ruta }, error: null };
      },
      async createSignedUrls(rutas) {
        await espera();
        return { data: rutas.map((r) => ({ path: r, signedUrl: archivos[bucket + '/' + r] || null, error: archivos[bucket + '/' + r] ? null : 'Object not found' })), error: null };
      },
      async remove(rutas) { await espera(); rutas.forEach((r) => { delete archivos[bucket + '/' + r]; }); return { data: rutas, error: null }; },
    };
  }

  // ---------- Edge Function crear-usuario ----------
  function errorFuncion(estado, mensaje) {
    return { data: null, error: { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: { status: estado, json: async () => ({ error: mensaje }) } } };
  }
  async function invocar(nombre, { body }) {
    await espera();
    if (nombre !== 'crear-usuario') return errorFuncion(404, 'Función desconocida.');
    if (!sesion) return errorFuncion(401, 'Falta la sesión.');
    if (!gestionaCuentas()) return errorFuncion(403, 'No tienes permiso para administrar cuentas.');
    const b = body || {};
    const puedeTocar = (id) => {
      if (!id) return 'Falta la persona.';
      if (id === uid()) return 'No puedes cambiar tu propia cuenta desde aquí.';
      if (esAdmin()) return null;
      const p = perfil(id);
      return p.rol !== 'colaborador' || p.es_admin ? 'Solo la administración puede cambiar esta cuenta.' : null;
    };
    if (b.accion === 'crear') {
      const correo = String(b.correo || '').trim().toLowerCase();
      if (!correo.includes('@') || !String(b.nombre || '').trim()) return errorFuncion(400, 'Escribe el nombre y un correo válido.');
      if (!esAdmin() && b.rol !== 'colaborador') return errorFuncion(403, 'Las cuentas de supervisores, directoras y gerentes las crea la administración.');
      if (!b.contrasena || b.contrasena.length < 8) return errorFuncion(400, 'La contraseña debe tener 8 caracteres o más.');
      if (usuarios.some((u) => u.email === correo)) return errorFuncion(409, 'Ya existe una cuenta con ese correo.');
      const id = uuid();
      usuarios.push({ id, email: correo, password: b.contrasena, banned: false, user_metadata: { debe_cambiar_contrasena: true } });
      db.perfiles.push({ id, nombre: String(b.nombre).trim(), correo, area_id: b.area_id || null, sede_id: b.sede_id || 1, rol: b.rol || 'colaborador', es_admin: false, activo: true, acepto_datos: null, creado: ahoraISO() });
      return { data: { ok: true, id }, error: null };
    }
    if (b.accion === 'restablecer') {
      const no = puedeTocar(b.id);
      if (no) return errorFuncion(403, no);
      const u = usuarios.find((x) => x.id === b.id);
      u.password = b.contrasena;
      u.user_metadata = Object.assign({}, u.user_metadata, { debe_cambiar_contrasena: true });
      return { data: { ok: true }, error: null };
    }
    if (b.accion === 'desactivar' || b.accion === 'reactivar') {
      const no = puedeTocar(b.id);
      if (no) return errorFuncion(403, no);
      const activo = b.accion === 'reactivar';
      usuarios.find((x) => x.id === b.id).banned = !activo;
      perfil(b.id).activo = activo;
      return { data: { ok: true }, error: null };
    }
    return errorFuncion(400, 'Acción desconocida.');
  }

  // ---------- API pública ----------
  window.supabase = {
    createClient() {
      return {
        auth,
        from: (tabla) => new Consulta(tabla, null),
        rpc,
        storage: { from: storage },
        functions: { invoke: invocar },
      };
    },
  };
  window.SUPABASE_DEMO = {
    clave: CLAVE_DEMO,
    cuentas: GENTE.filter((g) => g.etiqueta).map((g) => ({ correo: g.correo, nombre: g.nombre, rol: g.etiqueta })),
    db, // para pruebas automatizadas
  };
})();
