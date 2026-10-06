/* =====================================================================
   Intranet Caminos · app.js
   Una sola página, sin frameworks ni compilación. Cada pantalla es una
   función que devuelve HTML como texto y render() reemplaza #app.
   Sin onclick en el HTML: los botones llevan data-* y hay un escuchador
   por tipo de evento (ver «Eventos» al final).
   La seguridad vive en la base (RLS + funciones); aquí los permisos solo
   muestran u ocultan.
   ===================================================================== */
(function () {
  'use strict';

  // ---------- Cliente y versión ----------
  const CFG = window.INTRANET_CONFIG || {};
  // Mientras config.js no tenga el proyecto real, la página muestra «en preparación».
  const SIN_CONFIGURAR = !CFG.supabaseUrl || /PENDIENTE/.test(CFG.supabaseUrl + CFG.supabaseKey);
  const sb = window.supabase && !SIN_CONFIGURAR ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey) : null;
  const VERSION = (function () {
    try { return new URL(document.currentScript.src, location.href).searchParams.get('v') || ''; } catch (e) { return ''; }
  })();

  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
  };

  // Al abrir y al volver a la pestaña: si index.html trae otra versión, recarga una vez.
  async function revisarVersion() {
    if (!VERSION || location.protocol === 'file:') return;
    try {
      const r = await fetch(location.pathname + '?nocache=' + Date.now(), { cache: 'no-store' });
      const m = (await r.text()).match(/assets\/app\.js\?v=([\w.-]+)/);
      if (!m || m[1] === VERSION || ss.get('recarga-' + m[1])) return;
      ss.set('recarga-' + m[1], '1');
      location.replace(location.pathname + '?v=' + encodeURIComponent(m[1]) + location.hash);
    } catch (e) { /* sin red: se sigue con la versión abierta */ }
  }

  // ---------- Textos de Caminos (§11.7 del manual) ----------
  const MARCA = {
    nombre: 'Caminos',
    lema: 'Para ir más lejos',
    registro: '', // PENDIENTE: número de RNT para el pie de página
    direccion: 'Calle 79 # 16a-20, Oficina 507 · Bogotá',
    web: 'agenciacaminos.com.co',
    correoEjemplo: 'nombre@agenciacaminos.com.co',
    logo: 'assets/logo-caminos.svg',
    logoBlanco: 'assets/logo-caminos-blanco.svg',
    textoClave: 'Intranet Caminos',
    // PENDIENTE: reemplazar por el texto legal de Caminos (Ley 1581 de 2012) y poner false.
    datosPendiente: true,
    datos: [
      'En cumplimiento de la Ley 1581 de 2012 y del Decreto 1377 de 2013, autorizo a Caminos, como responsable del tratamiento, para recolectar, almacenar, usar y suprimir mis datos personales: nombre, correo corporativo, área, sede, horario, registros de entrada y salida, solicitudes y sus soportes.',
      'La finalidad es administrar la jornada laboral, la comunicación interna y los procesos de talento humano de la agencia. Los soportes de incapacidad pueden contener datos sensibles de salud; entregarlos es opcional y solo los ven la gerencia y las personas que ella asigne.',
      'Puedo conocer, actualizar, rectificar y suprimir mis datos, y revocar esta autorización, escribiendo a la gerencia de Caminos.',
    ],
  };

  // ---------- Íconos (SVG en línea estilo Lucide, ISC) ----------
  const IC = {
    inicio: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    calendario: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    calcheck: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
    megafono: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    usuarios: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    ayuda: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    llave: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    externo: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    flecha: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    izq: '<path d="m15 18-6-6 6-6"/>',
    der: '<path d="m9 18 6-6-6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    mas: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    basura: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    imagen: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    buscar: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    recargar: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    descargar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    reloj: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    alerta: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    fijar: '<line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>',
    documento: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    hoja: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 9v12"/><path d="M15 9v12"/>',
    reservas: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    grafica: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    copiar: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    avion: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    tenedor: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    lista: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
    libro: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    volver: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    cotizador: '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
    usuarioMas: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
  };
  const ico = (n, cls) => `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;
  // Estrella de ocho puntas de la marca (decorativa)
  const estrella = (cls) => `<svg class="${cls || ''}" viewBox="211.03 381.17 308.05 413.55" aria-hidden="true"><path d="M339.16,587.19l25.9,207.53,26.12-205.32,66.68,38.99-40.16-68.24,101.38-25.73-102.55-23.79,42.5-68.63-69.02,40.94-24.76-101.77-23.98,102.55-69.02-43.28,42.5,69.8-103.72,23.79,103.33,24.56s-44.84,70.97-42.89,70.19c1.95-.78,67.69-41.6,67.69-41.6Z"/></svg>`;

  // ---------- Utilidades ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const initials = (n) => String(n || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
  const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const urlSegura = (u) => (/^https?:\/\//i.test(String(u || '')) ? u : '#');

  // Fechas por zona horaria de la sede. Fechas puras como texto ISO; los días
  // se suman en UTC a mediodía para no saltar con cambios de hora.
  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fmts = {};
  function partes(tz, d) {
    const f = fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }));
    const o = {};
    f.formatToParts(d).forEach((p) => { o[p.type] = p.value; });
    return o;
  }
  const fechaEn = (tz, d) => { const p = partes(tz, d || new Date()); return `${p.year}-${p.month}-${p.day}`; };
  const horaEn = (tz, d) => { const p = partes(tz, d || new Date()); return `${p.hour}:${p.minute}`; };
  const segEn = (tz, d) => { const p = partes(tz, d || new Date()); return `${+p.hour}:${p.minute}:${p.second}`; };
  const toMin = (t) => (t ? (+String(t).slice(0, 2)) * 60 + (+String(t).slice(3, 5)) : null);
  const hhmm = (t) => (t ? `${+String(t).slice(0, 2)}:${String(t).slice(3, 5)}` : '');
  const hm = (min) => `${Math.floor(min / 60)}:${String(Math.round(min) % 60).padStart(2, '0')}`;
  const minDe = (ts, tz) => toMin(horaEn(tz, new Date(ts)));
  const horaDe = (ts, tz) => hhmm(horaEn(tz, new Date(ts)));
  const ahoraMin = (tz) => toMin(horaEn(tz));
  function sumarDias(iso, n) {
    const d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  const diaSemana = (iso) => { const g = new Date(iso + 'T12:00:00Z').getUTCDay(); return g === 0 ? 7 : g; };
  const lunesDe = (iso) => sumarDias(iso, 1 - diaSemana(iso));
  const fechaLarga = (iso) => `${DIAS_LARGOS[diaSemana(iso) - 1]} ${+iso.slice(8, 10)} de ${MESES[+iso.slice(5, 7) - 1]}`;
  const fechaCorta = (iso) => `${+iso.slice(8, 10)} ${MESES[+iso.slice(5, 7) - 1].slice(0, 3)}`;
  const fechaHora = (ts, tz) => `${fechaCorta(fechaEn(tz, new Date(ts)))} · ${horaDe(ts, tz)}`;
  const ultimoDia = (mes) => { const [y, m] = mes.split('-').map(Number); return `${mes}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`; };
  const nombreMes = (mes) => `${MESES[+mes.slice(5, 7) - 1]} ${mes.slice(0, 4)}`;

  // ---------- Estado ----------
  const S = {
    pantalla: 'cargando', error: '', correoLogin: '', claveVoluntaria: false, ocupado: '',
    usuario: null, perfil: null, sedes: [], areas: [], turnos: [], herramientas: [], personas: [], config: {}, revisores: [],
    view: 'inicio', menu: false, cargandoVista: false, errorVista: '',
    hoy: null,
    malla: { lunes: '', sede: 'todas', vista: 'semana', filas: [], base: [], edit: null, guardando: false },
    turnoSede: null,
    asistencia: null, asisSede: 'todas',
    equipo: { claveNueva: null, filtro: '', confirmar: null, borrador: {} },
    inf: { mes: '', sede: 'todas', area: 'todas', orden: { col: 'minTarde', asc: false }, sel: null, datos: null },
    com: { lista: [], imgs: [], lect: [], filtro: 'todos', q: '', borrador: { confirmar: true }, archivos: [], borrar: null },
    lb: null,
    sol: { lista: [], adj: [], tipo: 'vacaciones', borrador: {}, archivos: [], cancelar: null, coment: {} },
  };

  // ---------- Permisos de interfaz (solo muestran u ocultan) ----------
  const P = () => S.perfil || {};
  const esAdmin = () => !!P().es_admin;
  const esGerencia = () => P().rol === 'gerente' || esAdmin();
  const esLider = () => esGerencia() || P().rol === 'directora';
  const lideraSede = (s) => esGerencia() || (P().rol === 'directora' && P().sede_id === s);
  const esSupervisor = () => P().rol === 'supervisor';
  const editaMalla = (s) => lideraSede(s) || esSupervisor();
  const gestionaCuentas = () => esAdmin() || esSupervisor();
  const puedeTocarCuenta = (p) => p.id !== P().id && (esAdmin() || (esSupervisor() && p.rol === 'colaborador' && !p.es_admin));
  const puedePublicar = () => esLider();
  const ROLES = { colaborador: 'Colaborador', supervisor: 'Supervisor', directora: 'Directora de operaciones', gerente: 'Gerente' };
  const tol = () => {
    const t = S.config.tolerancias || {};
    return { entrada: t.entrada_min == null ? 5 : +t.entrada_min, almuerzo: t.almuerzo_min == null ? 5 : +t.almuerzo_min };
  };
  const meta = () => { const m = S.config.meta_puntualidad || {}; return m.porcentaje == null ? 95 : +m.porcentaje; };

  // Directorio
  const persona = (id) => S.personas.find((p) => p.id === id);
  const nombreDe = (id) => (persona(id) || {}).nombre || 'Alguien';
  const sedeDe = (id) => S.sedes.find((s) => s.id === id);
  const areaDe = (id) => S.areas.find((a) => a.id === id);
  const tzSede = (id) => (sedeDe(id) || {}).zona_horaria || 'America/Bogota';
  const tzPersona = (pid) => tzSede((persona(pid) || {}).sede_id);
  const miTz = () => tzSede(P().sede_id);
  const variasSedes = () => S.sedes.length > 1;
  const activas = () => S.personas.filter((p) => p.activo);

  // ---------- Turnos ----------
  const turno = (id) => S.turnos.find((t) => t.id === id);
  const conHorario = (t) => !!(t && t.entrada && t.salida);
  const conAlmuerzo = (t) => !!(t && t.salida_almuerzo && t.regreso_almuerzo);
  const turnoEtq = (t) => (conHorario(t)
    ? `${hhmm(t.entrada)}–${hhmm(t.salida)} · ${t.nombre}${conAlmuerzo(t) ? ' · alm ' + hhmm(t.salida_almuerzo) : ''}`
    : t ? t.nombre : '');
  const turnoPie = (t) => (conHorario(t) ? (conAlmuerzo(t) ? `almuerzo ${hhmm(t.salida_almuerzo)}–${hhmm(t.regreso_almuerzo)}` : 'sin almuerzo') : 'sin horario');
  const chipTxt = (t) => (conHorario(t) ? `${hhmm(t.entrada)}–${hhmm(t.salida)}` : t ? t.nombre : '—');
  const claveHorario = (t) => [t.entrada, t.salida, t.salida_almuerzo, t.regreso_almuerzo].join('|');
  // Los turnos con horario se ordenan por entrada y salida y toman f0…f9 en ese
  // orden: el mismo horario siempre se ve del mismo color, en cualquier sede.
  function colorTurno(t) {
    if (!t) return 't-none';
    if (t.codigo === 'D') return 't-D';
    if (t.codigo === 'V') return 't-V';
    if (!conHorario(t)) return 't-none';
    const claves = [...new Set(S.turnos.filter(conHorario).sort(ordenTurnos).map(claveHorario))];
    return 'f' + (claves.indexOf(claveHorario(t)) % 10);
  }
  function ordenTurnos(a, b) {
    const ha = conHorario(a), hb = conHorario(b);
    if (ha !== hb) return ha ? -1 : 1;
    if (ha) return (a.entrada + a.salida).localeCompare(b.entrada + b.salida) || String(a.salida_almuerzo || '').localeCompare(String(b.salida_almuerzo || ''));
    const r = (t) => (t.codigo === 'D' ? 0 : t.codigo === 'V' ? 1 : 2);
    return r(a) - r(b) || a.nombre.localeCompare(b.nombre);
  }
  const turnosDeSede = (s) => S.turnos.filter((t) => t.sede_id === s && t.activo !== false).sort(ordenTurnos);
  const turnoD = (s) => S.turnos.find((t) => t.sede_id === s && t.codigo === 'D');

  // ---------- Datos ----------
  async function q(p) {
    const { data, error } = await p;
    if (error) throw error;
    return data;
  }
  // La API devuelve como máximo 1.000 filas por consulta: se pagina siempre.
  async function todas(fn) {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const d = await q(fn().range(i, i + 999));
      out.push(...(d || []));
      if (!d || d.length < 1000) break;
    }
    return out;
  }
  const mallaEfectiva = (desde, hasta) => todas(() => sb.rpc('malla_efectiva', { p_desde: desde, p_hasta: hasta }).order('fecha').order('persona_id'));

  function errorTexto(e) {
    const m = String((e && (e.message || e.error_description || e.error)) || e || '');
    if (/invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/banned/i.test(m)) return 'Tu cuenta está desactivada. Habla con la administración.';
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(m) || (e && e.name === 'AuthRetryableFetchError')) return 'No hay conexión con el servidor.';
    if (/should be different/i.test(m)) return 'La contraseña nueva debe ser distinta de la temporal.';
    if (/row-level security|permission denied/i.test(m)) return 'No tienes permiso para hacer esto.';
    if (/duplicate key/i.test(m)) return 'Ese registro ya existe.';
    if (/violates check constraint/i.test(m)) return 'Revisa los datos: hay un valor que no es válido.';
    return m || 'Ocurrió un error. Intenta de nuevo.';
  }

  // ---------- Avisos ----------
  let toastT = null;
  function toast(msg, tipo) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'toast show ' + (tipo || 'ok');
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.className = 'toast ' + (tipo || 'ok'); }, 3200);
  }

  // Envuelve una acción: marca el botón ocupado y traduce el error.
  async function accion(clave, fn) {
    if (S.ocupado) return;
    S.ocupado = clave;
    render();
    try {
      await fn();
    } catch (e) {
      toast(errorTexto(e), 'bad');
    } finally {
      S.ocupado = '';
      render();
    }
  }
  const ocupado = (clave) => (S.ocupado === clave ? ' disabled aria-busy="true"' : S.ocupado ? ' disabled' : '');

  // ---------- Render ----------
  let foco = null;
  function render() {
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = vista();
    if (foco) {
      const el = app.querySelector(foco);
      foco = null;
      if (el) { el.focus(); if (el.select && el.type === 'password') el.select(); }
    }
    // En el celular las pestañas se desplazan: deja visible la actual
    const tabs = app.querySelector('.tabs'), actual = tabs && tabs.querySelector('[aria-current="page"]');
    if (actual && tabs.scrollWidth > tabs.clientWidth) tabs.scrollLeft = actual.offsetLeft - (tabs.clientWidth - actual.offsetWidth) / 2;
    const sel = app.querySelector('select.shift');
    if (sel) {
      sel.focus();
      try { sel.showPicker && sel.showPicker(); } catch (e) { /* algunos navegadores no lo permiten */ }
    }
  }
  function vista() {
    switch (S.pantalla) {
      case 'login': return loginView();
      case 'sinperfil': return sinPerfilView();
      case 'clave': return claveView();
      case 'datos': return datosView();
      case 'app': return appView();
      case 'preparacion': return preparacionView();
      case 'sinred': return sinRedView();
      default: return `<div class="arranque">${estrella('arranque-star')}<span>Cargando la intranet…</span></div>`;
    }
  }

  // ---------- Acceso ----------
  async function arrancar() {
    revisarVersion();
    if (SIN_CONFIGURAR) { S.pantalla = 'preparacion'; render(); return; }
    if (!sb) { S.pantalla = 'sinred'; render(); return; }
    render();
    try {
      const { data } = await sb.auth.getSession();
      if (!data || !data.session) { S.pantalla = 'login'; render(); return; }
      await cargarUsuario(data.session.user);
    } catch (e) {
      S.pantalla = 'login';
      S.error = errorTexto(e);
      render();
    }
  }

  async function cargarUsuario(user) {
    S.usuario = user;
    const perfil = await q(sb.from('perfiles').select('*').eq('id', user.id).maybeSingle());
    if (!perfil || !perfil.activo) { S.pantalla = 'sinperfil'; render(); return; }
    S.perfil = perfil;
    if (user.user_metadata && user.user_metadata.debe_cambiar_contrasena) { S.pantalla = 'clave'; foco = 'input[name=clave]'; render(); return; }
    if (!perfil.acepto_datos) { S.pantalla = 'datos'; render(); return; }
    await entrarApp();
  }

  async function entrarApp() {
    const [sedes, areas, turnos, herramientas, config, personas, revisores] = await Promise.all([
      q(sb.from('sedes').select('*').order('id')),
      q(sb.from('areas').select('*').order('nombre')),
      q(sb.from('turnos').select('*').order('sede_id').order('id')),
      q(sb.from('herramientas').select('*').order('orden')),
      q(sb.from('configuracion').select('*')),
      todas(() => sb.from('perfiles').select('*').order('nombre')),
      q(sb.from('revisores').select('*')),
    ]);
    Object.assign(S, { sedes, areas, turnos, herramientas, personas, revisores });
    S.config = {};
    config.forEach((c) => { S.config[c.clave] = c.valor; });
    S.pantalla = 'app';
    const pedida = (location.hash || '').replace('#', '');
    await ir(TABS.some((t) => t.id === pedida) || pedida === 'guia' ? pedida : 'inicio');
    // Insignias: comunicados sin confirmar y solicitudes por aprobar
    try {
      if (S.view !== 'comunicados' && S.view !== 'inicio') await cargarComunicados();
      if (verSolicitudes() && S.view !== 'solicitudes') await cargarSolicitudes();
      render();
    } catch (e) { /* las insignias no son críticas */ }
  }

  async function salir() {
    try { await sb.auth.signOut(); } catch (e) { /* igual se limpia */ }
    reiniciar();
  }
  function reiniciar() {
    Object.assign(S, {
      pantalla: 'login', error: '', usuario: null, perfil: null, view: 'inicio', menu: false, hoy: null, asistencia: null, lb: null,
      malla: { lunes: '', sede: 'todas', vista: 'semana', filas: [], base: [], edit: null, guardando: false },
      com: { lista: [], imgs: [], lect: [], filtro: 'todos', q: '', borrador: { confirmar: true }, archivos: [], borrar: null },
      sol: { lista: [], adj: [], tipo: 'vacaciones', borrador: {}, archivos: [], cancelar: null, coment: {} },
      equipo: { claveNueva: null, filtro: '', confirmar: null, borrador: {} },
      inf: { mes: '', sede: 'todas', area: 'todas', orden: { col: 'minTarde', asc: false }, sel: null, datos: null },
    });
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* nada */ }
    render();
  }

  function marcoAcceso(html) {
    return `<main class="login">
      <section class="login-hero">
        <img class="login-logo" src="${MARCA.logoBlanco}" alt="${esc(MARCA.nombre)}">
        ${estrella('login-star')}
        <div class="login-copy">
          <span class="eyebrow">Intranet</span>
          <h1>Tu jornada, tu equipo y tus herramientas, <em>en un solo lugar.</em></h1>
          <p>Marca tu jornada, revisa tu horario y entérate de lo que pasa en ${esc(MARCA.nombre)}.</p>
        </div>
        <span class="login-lema">${esc(MARCA.nombre)} · ${esc(MARCA.lema)}</span>
      </section>
      <section class="login-side">${html}</section>
    </main>`;
  }

  function loginView() {
    const demo = CFG.demo && CFG.demo.cuentas ? `<div class="demo-cuentas">
        <span class="eyebrow">Demostración · datos de ejemplo</span>
        <p class="hint">Personas y datos ficticios: nada de lo que hagas aquí se guarda, al recargar todo vuelve a empezar. Toca una cuenta para llenar el correo. La contraseña de todas es <b>${esc(CFG.demo.clave || '')}</b>.</p>
        <div class="demo-lista">${CFG.demo.cuentas.map((c) => `<button type="button" class="demo-cta" data-demo="${esc(c.correo)}"><b>${esc(c.rol)}</b><span>${esc(c.nombre)}</span></button>`).join('')}</div>
      </div>` : '';
    return marcoAcceso(`<form class="card login-card" data-form="login" novalidate>
        <span class="eyebrow">Ingresar</span>
        <h2>Entra a la intranet</h2>
        <label class="field"><span>Correo corporativo</span>
          <input name="correo" type="email" autocomplete="username" inputmode="email" placeholder="${esc(MARCA.correoEjemplo)}" value="${esc(S.correoLogin)}" required></label>
        <label class="field"><span>Contraseña</span>
          <input name="clave" type="password" autocomplete="current-password" required></label>
        ${S.error ? `<p class="err" role="alert">${ico('alerta')}${esc(S.error)}</p>` : ''}
        <button class="btn block" type="submit"${ocupado('login')}>${S.ocupado === 'login' ? 'Entrando…' : 'Entrar'}</button>
        <p class="hint">¿Olvidaste tu contraseña? Pídele a la administración que la restablezca.</p>
      </form>${demo}`);
  }

  function claveView() {
    const voluntaria = S.claveVoluntaria;
    return marcoAcceso(`<form class="card login-card" data-form="clave" novalidate>
        <span class="eyebrow">${voluntaria ? 'Tu cuenta' : 'Primer ingreso'}</span>
        <h2>${voluntaria ? 'Cambia tu contraseña' : 'Crea tu contraseña'}</h2>
        <p class="hint">${voluntaria ? 'Escribe la contraseña nueva dos veces.' : `Hola, ${esc(primerNombre(P().nombre))}. La contraseña temporal solo sirve una vez: crea una propia de 8 caracteres o más.`}</p>
        <label class="field"><span>Contraseña nueva</span><input name="clave" type="password" autocomplete="new-password" minlength="8" required></label>
        <label class="field"><span>Repítela</span><input name="clave2" type="password" autocomplete="new-password" minlength="8" required></label>
        ${S.error ? `<p class="err" role="alert">${ico('alerta')}${esc(S.error)}</p>` : ''}
        <button class="btn block" type="submit"${ocupado('clave')}>Guardar contraseña</button>
        ${voluntaria ? '<button class="btn txt block" type="button" data-accion="cancelarClave">Cancelar</button>' : '<button class="btn txt block" type="button" data-accion="salir">Salir</button>'}
      </form>`);
  }

  function datosView() {
    return marcoAcceso(`<div class="card login-card">
        <span class="eyebrow">Tratamiento de datos</span>
        <h2>Autorización de tratamiento de datos personales</h2>
        ${MARCA.datosPendiente ? '<p class="notice warn">Texto de ejemplo: la gerencia debe reemplazarlo por el texto legal de Caminos antes de usar la intranet.</p>' : ''}
        <div class="legal">${MARCA.datos.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
        ${S.error ? `<p class="err" role="alert">${ico('alerta')}${esc(S.error)}</p>` : ''}
        <button class="btn block" type="button" data-accion="aceptarDatos"${ocupado('datos')}>Acepto</button>
        <button class="btn txt block" type="button" data-accion="salir">No acepto · salir</button>
      </div>`);
  }

  function preparacionView() {
    return marcoAcceso(`<div class="card login-card">
        <span class="eyebrow">Muy pronto</span>
        <h2>La intranet se está preparando</h2>
        <p>Estamos conectando la base de datos y cargando las cuentas y los horarios del equipo. Cuando esté lista, entrarás aquí con tu correo corporativo.</p>
        <p class="hint">Mientras tanto, puedes conocer cómo funciona en la demostración. Usa datos de ejemplo y nada de lo que hagas allí se guarda.</p>
        <a class="btn block" href="pruebas/demo.html">${ico('flecha')}Ver la demostración</a>
      </div>`);
  }

  function sinRedView() {
    return marcoAcceso(`<div class="card login-card">
        <span class="eyebrow">Sin conexión</span>
        <h2>No hay conexión con el servidor</h2>
        <p>No se pudo cargar una parte de la intranet. Revisa tu conexión y recarga la página. Si sigue igual, prueba en una ventana de incógnito u otro navegador: un antivirus o una extensión puede estar bloqueándola.</p>
        <button class="btn block" type="button" data-accion="recargar">${ico('recargar')}Recargar</button>
      </div>`);
  }

  function sinPerfilView() {
    return marcoAcceso(`<div class="card login-card">
        <span class="eyebrow">Cuenta sin perfil</span>
        <h2>Tu cuenta aún no está lista</h2>
        <p>Tu usuario existe, pero no tiene un perfil activo en la intranet. Pídele a la administración que lo revise.</p>
        <button class="btn block" type="button" data-accion="salir">Salir</button>
      </div>`);
  }

  // ---------- Marco de la aplicación ----------
  const TABS = [
    { id: 'inicio', nombre: 'Inicio', ver: () => true },
    { id: 'malla', nombre: 'Malla', ver: () => true },
    { id: 'comunicados', nombre: 'Comunicados', ver: () => true, badge: () => sinConfirmar().length },
    { id: 'asistencia', nombre: 'Asistencia', ver: () => esLider() },
    { id: 'informes', nombre: 'Informes', ver: () => esLider() },
    { id: 'solicitudes', nombre: 'Solicitudes', ver: () => verSolicitudes(), badge: () => porRevisar().length },
    { id: 'equipo', nombre: 'Equipo', ver: () => gestionaCuentas() },
  ];
  const puedeVer = (v) => v === 'guia' || TABS.some((t) => t.id === v && t.ver());

  function appView() {
    const tabs = TABS.filter((t) => t.ver());
    const pie = [MARCA.direccion, MARCA.web, MARCA.registro].filter(Boolean).map(esc).join(' · ');
    return `<header class="top"><div class="wrap top-in">
        <a class="brand" href="#inicio" data-view="inicio"><img src="${MARCA.logo}" alt="${esc(MARCA.nombre)}"><span>Intranet</span></a>
        ${CFG.demo ? '<span class="demo-tag" title="Datos de ejemplo: nada se guarda al recargar">Demostración</span>' : ''}
        <nav class="tabs" aria-label="Secciones">${tabs.map((t) => {
          const n = t.badge ? t.badge() : 0;
          return `<button type="button" data-view="${t.id}"${S.view === t.id ? ' aria-current="page"' : ''}>${t.nombre}${n ? `<span class="badge" aria-label="${n} pendientes">${n}</span>` : ''}</button>`;
        }).join('')}</nav>
        <div class="menu">
          <button type="button" class="avatar" data-accion="menu" aria-haspopup="true" aria-expanded="${S.menu}" aria-label="Tu cuenta">${esc(initials(P().nombre))}</button>
          ${S.menu ? menuPop() : ''}
        </div>
      </div></header>
      <main class="wrap page" id="contenido">${S.cargandoVista ? cargandoBloque() : S.errorVista ? errorVistaView() : vistaActual()}</main>
      <footer class="foot-site"><div class="wrap"><span><b>${esc(MARCA.nombre)}</b> — ${esc(MARCA.lema)}</span><span>${pie}</span></div></footer>
      ${S.lb ? lightboxView() : ''}`;
  }

  function menuPop() {
    const p = P();
    const sede = sedeDe(p.sede_id), area = areaDe(p.area_id);
    return `<div class="menu-pop" role="menu">
        <div class="menu-yo"><b>${esc(p.nombre)}</b><span>${esc(ROLES[p.rol] || p.rol)}${p.es_admin ? ' · Administración' : ''}</span><span>${esc([area && area.nombre, sede && sede.nombre].filter(Boolean).join(' · '))}</span></div>
        <button type="button" role="menuitem" data-view="guia">${ico('libro')}Guía de uso</button>
        <button type="button" role="menuitem" data-accion="cambiarClave">${ico('llave')}Cambiar contraseña</button>
        <button type="button" role="menuitem" data-accion="salir">${ico('salir')}Cerrar sesión</button>
      </div>`;
  }

  const cargandoBloque = () => `<div class="cargando">${estrella('arranque-star')}<span>Cargando…</span></div>`;
  const errorVistaView = () => `<div class="notice bad">${ico('alerta')}<div><b>No se pudo cargar esta sección.</b><p>${esc(S.errorVista)}</p><button class="btn sm" type="button" data-view="${esc(S.view)}">Reintentar</button></div></div>`;

  function vistaActual() {
    switch (S.view) {
      case 'malla': return mallaView();
      case 'comunicados': return comunicadosView();
      case 'asistencia': return asistenciaView();
      case 'informes': return informesView();
      case 'solicitudes': return solicitudesView();
      case 'equipo': return equipoView();
      case 'guia': return guiaView();
      default: return inicioView();
    }
  }

  const encabezado = (eyebrow, titulo, lead, extra) => `<div class="page-h"><div><span class="eyebrow">${eyebrow}</span><h1 class="display">${titulo}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div>${extra || ''}</div>`;

  // ---------- Inicio ----------
  async function cargarInicio() {
    const tz = miTz(), hoy = fechaEn(tz), lunes = lunesDe(hoy), domingo = sumarDias(lunes, 6), yo = P().id;
    const [semana, marcas, ausencias, misSol] = await Promise.all([
      q(sb.rpc('malla_efectiva', { p_desde: lunes, p_hasta: domingo }).eq('persona_id', yo)),
      q(sb.from('marcas').select('*').eq('persona_id', yo).eq('fecha', hoy)),
      q(sb.rpc('ausencias_aprobadas', { p_desde: lunes, p_hasta: domingo })),
      q(sb.from('solicitudes').select('*').eq('persona_id', yo).order('creado', { ascending: false }).limit(30)),
      cargarComunicados(),
    ]);
    S.hoy = { fecha: hoy, lunes, semana: semana || [], marcas: marcas || [], ausencias: (ausencias || []).filter((a) => a.persona_id === yo), misSol: misSol || [] };
  }

  const saludo = () => { const h = ahoraMin(miTz()) / 60; return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; };

  function inicioView() {
    const p = P(), h = S.hoy;
    if (!h) return cargandoBloque();
    const area = areaDe(p.area_id), sede = sedeDe(p.sede_id);
    const pend = sinConfirmar().length;
    return `<section class="hello">
        <div>
          <span class="eyebrow">${esc(fechaLarga(h.fecha))}${area ? ' · ' + esc(area.nombre) : ''}${sede && variasSedes() ? ' · ' + esc(sede.nombre) : ''}</span>
          <h1 class="display">${saludo()}, <em>${esc(primerNombre(p.nombre))}</em></h1>
        </div>
        <button type="button" class="btn ghost" data-view="guia">${ico('ayuda')}¿Dudas? Guía de uso</button>
      </section>
      ${pend ? `<div class="alerta">${ico('megafono')}<span>Tienes <b>${plural(pend, 'comunicado', 'comunicados')}</b> por confirmar.</span><button type="button" class="btn sm" data-view="comunicados">Ver comunicados</button></div>` : ''}
      <div class="grid-home">
        <div class="col">
          ${paseView()}
          <section><div class="sec-h"><h2>Herramientas</h2><span class="hint">Se abren en una pestaña nueva</span></div>${herramientasView()}</section>
        </div>
        <div class="col">
          ${comunicadosMini()}
          ${moduloSol() ? misSolicitudesMini() : ''}
          ${semanaView()}
        </div>
      </div>`;
  }

  const PASOS = [
    { tipo: 'entrada', cod: 'ENT', nombre: 'Entrada', boton: 'Marcar entrada' },
    { tipo: 'salida_almuerzo', cod: 'ALM', nombre: 'Salida a almuerzo', boton: 'Salir a almorzar' },
    { tipo: 'regreso_almuerzo', cod: 'REG', nombre: 'Regreso de almuerzo', boton: 'Marcar regreso' },
    { tipo: 'salida', cod: 'SAL', nombre: 'Salida', boton: 'Marcar salida' },
  ];

  // Evalúa un paso contra el turno: hora programada, hora real y etiqueta.
  function evaluar(tipo, t, marcas, tz) {
    const m = marcas[tipo];
    const campo = { entrada: 'entrada', salida_almuerzo: 'salida_almuerzo', regreso_almuerzo: 'regreso_almuerzo', salida: 'salida' }[tipo];
    const prog = t && t[campo] ? toMin(t[campo]) : null;
    const real = m ? minDe(m.hora, tz) : null;
    let chip = null;
    if (m && t && conHorario(t)) {
      if (tipo === 'entrada') {
        const d = real - prog;
        chip = d > tol().entrada ? { txt: `Tarde ${d} min`, cls: 'bad', alerta: true } : { txt: 'A tiempo', cls: 'ok' };
      } else if (tipo === 'regreso_almuerzo' && marcas.salida_almuerzo) {
        const dur = real - minDe(marcas.salida_almuerzo.hora, tz);
        const permitido = conAlmuerzo(t) ? toMin(t.regreso_almuerzo) - toMin(t.salida_almuerzo) : 60;
        chip = dur > permitido + tol().almuerzo ? { txt: `Almuerzo ${dur} min`, cls: 'warn', alerta: true } : { txt: `Almuerzo ${dur} min`, cls: 'ok' };
      } else if (tipo === 'salida') {
        const d = real - prog;
        chip = d < 0 ? { txt: `Salió ${-d} min antes`, cls: 'warn', alerta: true } : d >= 30 ? { txt: `${d} min extra`, cls: 'info' } : { txt: 'A tiempo', cls: 'ok' };
      }
    }
    return { prog, real, chip };
  }

  function ausenciaHoy() {
    const h = S.hoy;
    const a = h.ausencias.find((x) => x.desde <= h.fecha && x.hasta >= h.fecha);
    if (!a) return null;
    const sol = h.misSol.find((s) => s.estado === 'aprobada' && s.tipo === a.tipo && s.desde === a.desde && s.hasta === a.hasta);
    return { ...a, revisado_por: sol && sol.revisado_por };
  }

  function paseView() {
    const p = P(), h = S.hoy, tz = miTz();
    const fila = h.semana.find((x) => x.fecha === h.fecha);
    const t = fila ? turno(fila.turno_id) : null;
    const marcas = {};
    h.marcas.forEach((m) => { marcas[m.tipo] = m; });
    const aus = ausenciaHoy();
    const sinAlm = t && conHorario(t) && !conAlmuerzo(t);
    const pasos = PASOS.filter((x) => !(sinAlm && (x.tipo === 'salida_almuerzo' || x.tipo === 'regreso_almuerzo')));
    const completa = !!marcas.salida;
    const sig = completa ? null : pasos.find((x) => !marcas[x.tipo]);
    const descanso = t && !conHorario(t);
    const sede = sedeDe(p.sede_id);
    const validarIp = S.config.validar_ip && S.config.validar_ip.activo;

    let aviso = '';
    if (aus) {
      const T = TIPOS[aus.tipo];
      aviso = `<div class="notice info">${ico(T.icono)}<div><b>Hoy no tienes que marcar.</b><p>${esc(T.nombre)} del ${esc(fechaCorta(aus.desde))} al ${esc(fechaCorta(aus.hasta))}${aus.revisado_por ? ` · aprobó ${esc(nombreDe(aus.revisado_por))}` : ''}.</p></div></div>`;
    } else if (descanso) {
      aviso = `<div class="notice">${ico('sol')}<div><b>Hoy no tienes jornada programada.</b><p>Tu turno de hoy es «${esc(t.nombre)}».</p></div></div>`;
    } else if (!t) {
      aviso = `<div class="notice warn">${ico('alerta')}<div><b>No tienes turno asignado hoy.</b><p>Puedes marcar igual; la líder de tu sede lo revisará.</p></div></div>`;
    }
    const mostrarBoton = !aus && !descanso;

    const legs = pasos.map((x) => {
      const ev = evaluar(x.tipo, t, marcas, tz);
      const estado = marcas[x.tipo] ? 'done' : sig && sig.tipo === x.tipo && mostrarBoton ? 'next' : '';
      return `<li class="leg ${estado}">
          <span class="dot">${marcas[x.tipo] ? ico('check') : ''}</span>
          <span class="leg-p"><b class="leg-cod">${x.cod}</b><span class="leg-nom">${x.nombre}</span>${ev.chip ? `<span class="chip ${ev.chip.cls} xs">${esc(ev.chip.txt)}</span>` : ''}</span>
          <span class="leg-h"><span class="sr">Programada </span>${ev.prog != null ? hm(ev.prog) : '—'}</span>
          <span class="leg-h real"><span class="sr">Marcada </span>${ev.real != null ? `<b>${hm(ev.real)}</b>` : '—'}</span>
        </li>`;
    }).join('');
    const cabLegs = '<li class="leg-cab" aria-hidden="true"><span></span><span>Paso</span><span>Turno</span><span>Marcada</span></li>';

    let boton = '';
    if (mostrarBoton) {
      if (completa) boton = `<div class="completa">${ico('check')}Jornada completa</div>`;
      else if (sig) {
        boton = `<button type="button" class="btn mark-btn" data-marcar="${sig.tipo}"${ocupado('marcar')}>${S.ocupado === 'marcar' ? 'Marcando…' : esc(sig.boton)}</button>`;
        if (sig.tipo === 'salida_almuerzo') boton += `<button type="button" class="btn txt sm" data-marcar="salida"${ocupado('marcar')}>Hoy no almuerzo · marcar salida</button>`;
      }
      boton += `<p class="pass-pie">${ico('reloj')}${validarIp ? `Solo desde la oficina ${esc(sede ? sede.nombre : '')}` : 'La hora la pone el servidor'}</p>`;
    }

    return `<article class="pass" aria-label="Pase de jornada">
        <div class="stub">
          ${estrella('stub-star')}
          <div class="stub-top"><span class="eyebrow">Pase de jornada</span><span>${esc(fechaCorta(h.fecha))}</span></div>
          <div class="stub-name">${esc(p.nombre)}</div>
          ${t && conHorario(t)
            ? `<div class="route"><div><small>Entrada</small><b>${hhmm(t.entrada)}</b></div><span class="route-line">${ico('avion')}</span><div><small>Salida</small><b>${hhmm(t.salida)}</b></div></div>`
            : `<div class="route vacia"><b>${t ? esc(t.nombre) : 'Sin turno'}</b></div>`}
          <dl class="stub-dl">
            <div><dt>Turno</dt><dd>${t ? esc(t.nombre) : '—'}</dd></div>
            <div><dt>Almuerzo</dt><dd>${t && conHorario(t) ? (conAlmuerzo(t) ? `${hhmm(t.salida_almuerzo)}–${hhmm(t.regreso_almuerzo)}` : 'Sin almuerzo') : '—'}</dd></div>
            <div><dt>Sede</dt><dd>${esc(sede ? sede.nombre : '—')}</dd></div>
          </dl>
          <div class="clock"><small>Hora en ${esc(sede ? sede.nombre : 'la sede')}</small><span id="clock">${segEn(tz)}</span></div>
        </div>
        <div class="pass-body">
          ${aviso}
          <ol class="legs">${cabLegs}${legs}</ol>
          <div class="pass-acc">${boton}</div>
        </div>
      </article>`;
  }

  function herramientasView() {
    const lista = S.herramientas.filter((x) => x.activo !== false && (!x.areas_visibles || !x.areas_visibles.length || x.areas_visibles.includes(P().area_id)));
    if (!lista.length) return '<p class="vacio">No hay herramientas para tu área.</p>';
    return `<div class="tools">${lista.map((x) => `<a class="tool" href="${esc(urlSegura(x.url))}" target="_blank" rel="noopener noreferrer">
        <span class="tool-h"><span class="sq">${ico(IC[x.icono] ? x.icono : x.icono === 'documentos' ? 'documento' : 'externo')}</span>${x.pie ? `<span class="tag">${esc(x.pie)}</span>` : ''}</span>
        <b>${esc(x.nombre)}</b>
        <span class="tool-d">${esc(x.descripcion || '')}</span>
        <span class="tool-pie">Abrir${ico('externo')}</span>
      </a>`).join('')}</div>`;
  }

  function comunicadosMini() {
    const lista = comunicadosVisibles().slice().sort((a, b) => (pendiente(b) - pendiente(a)) || (b.creado > a.creado ? 1 : -1)).slice(0, 3);
    return `<section class="card mini">
        <div class="sec-h"><h2>Comunicados</h2><button type="button" class="enlace" data-view="comunicados">Ver todos</button></div>
        ${lista.length ? `<ul class="mini-lista">${lista.map((c) => `<li><button type="button" data-view="comunicados" data-ir-com="${c.id}">
            <span class="mini-t">${pendiente(c) ? '<span class="punto" aria-label="Sin confirmar"></span>' : ''}${esc(c.titulo)}</span>
            <span class="hint">${esc(nombreDe(c.autor_id))} · ${esc(fechaHora(c.creado, miTz()))}</span>
          </button></li>`).join('')}</ul>` : '<p class="vacio">Aún no hay comunicados.</p>'}
      </section>`;
  }

  function misSolicitudesMini() {
    const lista = (S.hoy.misSol || []).slice(0, 3);
    return `<section class="card mini">
        <div class="sec-h"><h2>Mis solicitudes</h2><button type="button" class="enlace" data-view="solicitudes">Nueva solicitud</button></div>
        ${lista.length ? `<ul class="mini-lista">${lista.map((s) => `<li><button type="button" data-view="solicitudes">
            <span class="mini-t">${esc(TIPOS[s.tipo].nombre)} · ${esc(rangoSol(s))}</span>
            <span class="chip ${ESTADOS[s.estado].cls}">${ESTADOS[s.estado].txt}</span>
          </button></li>`).join('')}</ul>` : '<p class="vacio">No tienes solicitudes.</p>'}
      </section>`;
  }

  function semanaView() {
    const h = S.hoy;
    const dias = [0, 1, 2, 3, 4, 5].map((i) => sumarDias(h.lunes, i));
    return `<section class="card mini">
        <div class="sec-h"><h2>Tu semana</h2><button type="button" class="enlace" data-view="malla">Ver malla</button></div>
        <ol class="week">${dias.map((d, i) => {
          const f = h.semana.find((x) => x.fecha === d);
          const t = f ? turno(f.turno_id) : null;
          const a = h.ausencias.find((x) => x.desde <= d && x.hasta >= d);
          return `<li class="day${d === h.fecha ? ' hoy' : ''}">
              <span class="day-n">${DIAS[i]}<small>${+d.slice(8, 10)}</small></span>
              ${a ? `<span class="chipt t-V">${esc(TIPOS[a.tipo].nombre)}</span>` : `<span class="chipt ${colorTurno(t)}" title="${esc(t ? turnoEtq(t) : 'Sin turno')}">${esc(t ? chipTxt(t) : '—')}</span>`}
              ${t && !a ? `<small class="day-pie">${esc(turnoPie(t))}</small>` : ''}
            </li>`;
        }).join('')}</ol>
      </section>`;
  }

  // ---------- Malla de horarios ----------
  // Turnos (catálogo) + horario fijo semanal + cambios puntuales = malla efectiva.
  async function cargarMalla() {
    const M = S.malla;
    if (!M.lunes) M.lunes = lunesDe(fechaEn(miTz()));
    const [filas, base, turnos] = await Promise.all([
      mallaEfectiva(M.lunes, sumarDias(M.lunes, 5)),
      todas(() => sb.from('horario_base').select('*').order('persona_id').order('dia')),
      q(sb.from('turnos').select('*').order('sede_id').order('id')),
    ]);
    M.filas = filas;
    M.base = base;
    S.turnos = turnos;
  }

  const inicioHorarios = () => ((S.config.inicio_horarios || {}).fecha || '9999-12-31');
  // Turno que daría el horario fijo ese día (para saber si un cambio es redundante)
  function turnoBase(p, fecha) {
    if (fecha < inicioHorarios()) return null;
    const filas = S.malla.base.filter((b) => b.persona_id === p.id);
    if (!filas.length) return null;
    const f = filas.find((b) => b.dia === diaSemana(fecha));
    if (f) return f.turno_id;
    const d = turnoD(p.sede_id);
    return d ? d.id : null;
  }

  // Personas activas agrupadas por área, orden alfabético dentro de cada grupo
  function porArea(personas) {
    const grupos = {};
    personas.forEach((p) => {
      const a = areaDe(p.area_id);
      const k = a ? a.nombre : 'Sin área';
      (grupos[k] = grupos[k] || []).push(p);
    });
    return Object.keys(grupos).sort((a, b) => (a === 'Sin área') - (b === 'Sin área') || a.localeCompare(b, 'es'))
      .map((k) => ({ area: k, personas: grupos[k].sort((x, y) => x.nombre.localeCompare(y.nombre, 'es')) }));
  }

  const personaTd = (p) => `<th scope="row" class="persona"><span class="avatar sm">${esc(initials(p.nombre))}</span><span><b>${esc(p.nombre)}</b>${variasSedes() ? `<small>${esc((sedeDe(p.sede_id) || {}).nombre || '')}</small>` : ''}</span></th>`;

  // Una celda: chip (o botón para quien edita) o, abierta, un selector de turno.
  function celdaTurno(tipo, p, clave, turnoId, cambio, td) {
    const tdCls = td ? ` class="${td}"` : '';
    const t = turnoId ? turno(turnoId) : null;
    const id = `${tipo}|${p.id}|${clave}`;
    const puede = editaMalla(p.sede_id);
    if (puede && S.malla.edit === id) {
      const ops = turnosDeSede(p.sede_id).filter((x) => tipo === 'm' || x.codigo !== 'V');
      return `<td class="celda-ed${td ? ' ' + td : ''}"><select class="shift" data-celda="${esc(id)}" aria-label="Turno de ${esc(p.nombre)}"${S.malla.guardando ? ' disabled' : ''}>
          ${tipo === 'm' && cambio ? '<option value="__base">↺ Volver al horario fijo</option>' : ''}
          ${!t ? '<option value="" selected disabled>Elige un turno…</option>' : ''}
          ${ops.map((x) => `<option value="${x.id}"${t && x.id === t.id ? ' selected' : ''}>${esc(turnoEtq(x))}</option>`).join('')}
        </select></td>`;
    }
    const cls = `chipt ${colorTurno(t)}${cambio ? ' cambio' : ''}`;
    const titulo = t ? `${turnoEtq(t)} · ${turnoPie(t)}${cambio ? ' · cambio puntual' : ''}` : 'Sin turno';
    if (puede) return `<td${tdCls}><button type="button" class="celda ${cls}" data-editar="${esc(id)}" title="${esc(titulo)}">${esc(t ? chipTxt(t) : '—')}</button></td>`;
    return `<td${tdCls}><span class="${cls}" title="${esc(titulo)}">${esc(t ? chipTxt(t) : '—')}</span></td>`;
  }

  function leyendaTurnos(ids) {
    const vistos = new Set(), items = [];
    S.turnos.filter((t) => ids.has(t.id)).sort(ordenTurnos).forEach((t) => {
      const k = conHorario(t) ? claveHorario(t) + '|' + t.nombre : t.codigo + t.nombre;
      if (vistos.has(k)) return;
      vistos.add(k);
      items.push(`<li><span class="chipt ${colorTurno(t)}">${esc(chipTxt(t))}</span><span><b>${esc(t.nombre)}</b> · ${esc(turnoPie(t))}</span></li>`);
    });
    return items.length ? `<ul class="leyenda">${items.join('')}<li><span class="chipt t-none cambio">7:00</span><span>Borde de color: cambio puntual de ese día</span></li></ul>` : '';
  }

  function mallaView() {
    const M = S.malla;
    const lider = esLider() || esSupervisor();
    if (!lider) M.vista = 'semana';
    const ayuda = {
      semana: lider ? 'Toca una celda para poner un cambio puntual ese día. El resto de la semana sale del horario fijo.' : 'Tu horario y el del equipo esta semana.',
      fijo: 'El horario de cada persona, lunes a sábado. Se llena una vez y la malla de cada semana sale de aquí.',
      turnos: 'Cada turno es una franja de horario. Las personas lo tienen en su horario fijo o en un cambio puntual.',
    }[M.vista];
    const sedes = S.sedes;
    const barra = `<div class="toolbar">
        ${lider ? `<div class="seg" role="group" aria-label="Vista">${[['semana', 'Semana'], ['fijo', 'Horario fijo'], ['turnos', 'Turnos']].map(([v, n]) => `<button type="button" data-mvista="${v}" aria-pressed="${M.vista === v}">${n}</button>`).join('')}</div>` : ''}
        ${variasSedes() && M.vista !== 'turnos' ? `<label class="field inline"><span>Sede</span><select data-msede="1"><option value="todas">Todas las sedes</option>${sedes.map((s) => `<option value="${s.id}"${String(M.sede) === String(s.id) ? ' selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select></label>` : ''}
      </div>`;
    let cuerpo = '';
    if (M.vista === 'fijo') cuerpo = horarioFijoView();
    else if (M.vista === 'turnos') cuerpo = turnosView();
    else cuerpo = semanaMallaView();
    return encabezado('Horarios', 'Malla <em>de horarios</em>', esc(ayuda), barra) + cuerpo;
  }

  function semanaMallaView() {
    const M = S.malla;
    const hoy = fechaEn(miTz());
    const dias = [0, 1, 2, 3, 4, 5].map((i) => sumarDias(M.lunes, i));
    const esta = lunesDe(hoy) === M.lunes;
    const personas = activas().filter((p) => M.sede === 'todas' || String(p.sede_id) === String(M.sede));
    const idx = {};
    M.filas.forEach((f) => { idx[f.persona_id + '|' + f.fecha] = f; });
    const usados = new Set();
    const filas = porArea(personas).map((g) => `<tr class="grupo"><th colspan="7" scope="rowgroup">${esc(g.area)}</th></tr>` + g.personas.map((p) => `<tr>${personaTd(p)}${dias.map((d) => {
      const f = idx[p.id + '|' + d];
      if (f) usados.add(f.turno_id);
      return celdaTurno('m', p, d, f && f.turno_id, f && f.cambio, d === hoy ? 'hoy' : '');
    }).join('')}</tr>`).join('')).join('');
    return `<div class="weeknav">
        <button type="button" class="btn ghost sm" data-semana="-7">${ico('izq')}Anterior</button>
        <b>${esc(fechaCorta(dias[0]))} – ${esc(fechaCorta(dias[5]))} ${dias[5].slice(0, 4)}</b>
        <button type="button" class="btn ghost sm" data-semana="7">Siguiente${ico('der')}</button>
        ${esta ? '' : '<button type="button" class="btn txt sm" data-semana="0">Esta semana</button>'}
      </div>
      <div class="tablewrap card flush"><table class="malla">
        <thead><tr><th scope="col">Persona</th>${dias.map((d, i) => `<th scope="col" class="${d === hoy ? 'hoy' : ''}">${DIAS[i]}<small>${esc(fechaCorta(d))}</small></th>`).join('')}</tr></thead>
        <tbody>${filas || '<tr><td colspan="7" class="vacio">No hay personas activas.</td></tr>'}</tbody>
      </table></div>
      ${leyendaTurnos(usados)}
      ${M.filas.length === 0 && personas.length ? `<p class="notice">${ico('alerta')}<span>Nadie tiene horario fijo esta semana. Cárgalo en «Horario fijo» (desde el ${esc(fechaCorta(inicioHorarios()))} la malla se llena sola).</span></p>` : ''}`;
  }

  function horarioFijoView() {
    const M = S.malla;
    const personas = activas().filter((p) => editaMalla(p.sede_id) && (M.sede === 'todas' || String(p.sede_id) === String(M.sede)));
    const idx = {};
    M.base.forEach((b) => { idx[b.persona_id + '|' + b.dia] = b; });
    const usados = new Set();
    const filas = porArea(personas).map((g) => `<tr class="grupo"><th colspan="7" scope="rowgroup">${esc(g.area)}</th></tr>` + g.personas.map((p) => `<tr>${personaTd(p)}${[1, 2, 3, 4, 5, 6].map((d) => {
      const b = idx[p.id + '|' + d];
      const tid = b ? b.turno_id : (turnoD(p.sede_id) || {}).id;
      if (tid) usados.add(tid);
      return celdaTurno('b', p, d, tid, false);
    }).join('')}</tr>`).join('')).join('');
    return `<div class="tablewrap card flush"><table class="malla">
        <thead><tr><th scope="col">Persona</th>${DIAS.map((d) => `<th scope="col">${d}</th>`).join('')}</tr></thead>
        <tbody>${filas || '<tr><td colspan="7" class="vacio">No hay personas cuya malla puedas editar.</td></tr>'}</tbody>
      </table></div>
      ${leyendaTurnos(usados)}
      <p class="hint">Los días sin turno cuentan como Descanso. Las personas sin ningún día cargado (por ejemplo, la gerencia) no aparecen en la malla semanal.</p>`;
  }

  function turnosView() {
    const sedes = S.sedes.filter((s) => editaMalla(s.id));
    if (!sedes.length) return '<p class="vacio">No tienes sedes para editar.</p>';
    if (!S.turnoSede || !sedes.some((s) => s.id === S.turnoSede)) S.turnoSede = sedes.some((s) => s.id === P().sede_id) ? P().sede_id : sedes[0].id;
    const lista = turnosDeSede(S.turnoSede);
    const campo = (t, c) => `<input type="time" value="${esc(String(t[c] || '').slice(0, 5))}" data-turno="${t.id}|${c}" aria-label="${esc(t.nombre)}: ${c.replace('_', ' ')}">`;
    return `<div class="toolbar">
        ${sedes.length > 1 ? `<label class="field inline"><span>Sede</span><select data-tsede="1">${sedes.map((s) => `<option value="${s.id}"${s.id === S.turnoSede ? ' selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select></label>` : ''}
        <button type="button" class="btn sm" data-accion="agregarTurno"${ocupado('turno')}>${ico('mas')}Agregar turno</button>
      </div>
      <div class="notice">${ico('alerta')}<span>Cada turno es una franja de horario. Si cambias sus horas aquí, cambian para todas las personas que lo tienen, también en los informes. Cada campo se guarda al salir de él.</span></div>
      <div class="tablewrap card flush"><table class="turnos">
        <thead><tr><th scope="col">Código</th><th scope="col">Nombre</th><th scope="col">Entrada</th><th scope="col">Sale a almorzar</th><th scope="col">Regresa</th><th scope="col">Salida</th></tr></thead>
        <tbody>${lista.map((t) => `<tr>
            <td><span class="chipt ${colorTurno(t)}">${esc(t.codigo)}</span></td>
            <td><input type="text" value="${esc(t.nombre)}" data-turno="${t.id}|nombre" aria-label="Nombre del turno ${esc(t.codigo)}" maxlength="40"></td>
            ${conHorario(t) ? `<td>${campo(t, 'entrada')}</td><td>${campo(t, 'salida_almuerzo')}</td><td>${campo(t, 'regreso_almuerzo')}</td><td>${campo(t, 'salida')}</td>`
              : '<td colspan="4" class="hint">Sin horario: no se marca asistencia</td>'}
          </tr>`).join('')}</tbody>
      </table></div>
      <p class="hint">Para un turno sin almuerzo (sábados), deja vacías las dos horas del almuerzo.</p>`;
  }

  async function guardarCelda(id, valor) {
    const [tipo, pid, clave] = id.split('|');
    const p = persona(pid);
    S.malla.guardando = true;
    try {
      if (tipo === 'm') {
        const base = turnoBase(p, clave);
        if (valor === '__base' || (base && String(base) === String(valor))) {
          await q(sb.from('malla').delete().eq('persona_id', pid).eq('fecha', clave));
        } else {
          await q(sb.from('malla').upsert({ persona_id: pid, fecha: clave, turno_id: +valor }, { onConflict: 'persona_id,fecha' }));
        }
      } else {
        const d = turnoD(p.sede_id);
        if (d && String(d.id) === String(valor)) {
          await q(sb.from('horario_base').delete().eq('persona_id', pid).eq('dia', +clave));
        } else {
          await q(sb.from('horario_base').upsert({ persona_id: pid, dia: +clave, turno_id: +valor }, { onConflict: 'persona_id,dia' }));
        }
      }
      S.malla.edit = null;
      await cargarMalla();
      toast(tipo === 'm' ? 'Malla actualizada.' : 'Horario fijo actualizado.');
    } catch (e) {
      toast(errorTexto(e), 'bad');
    } finally {
      S.malla.guardando = false;
      S.malla.edit = null;
      render();
    }
  }

  async function guardarTurno(id, campo, valor) {
    const t = turno(+id);
    if (!t) return;
    let v = valor;
    if (campo === 'nombre') {
      v = String(valor).trim();
      if (!v || v === t.nombre) { render(); return; }
    } else {
      v = valor ? valor + ':00' : null;
      if (String(t[campo] || '') === String(v || '')) return;
    }
    try {
      await q(sb.from('turnos').update({ [campo]: v }).eq('id', t.id));
      t[campo] = v;
      toast('Turno guardado.');
    } catch (e) {
      // Sin render en el caso feliz: así no se pierde el foco del campo siguiente.
      toast(campo === 'nombre' ? errorTexto(e) : 'Revisa las horas: entrada y salida van juntas, y las dos del almuerzo también.', 'bad');
      S.turnos = await q(sb.from('turnos').select('*').order('sede_id').order('id'));
      render();
    }
  }

  async function agregarTurno() {
    const s = S.turnoSede;
    const nums = S.turnos.filter((t) => t.sede_id === s && /^\d+$/.test(t.codigo)).map((t) => +t.codigo);
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    await q(sb.from('turnos').insert({ sede_id: s, codigo: String(n), nombre: 'Turno ' + n, entrada: '08:00:00', salida_almuerzo: '12:00:00', regreso_almuerzo: '13:00:00', salida: '17:00:00' }));
    S.turnos = await q(sb.from('turnos').select('*').order('sede_id').order('id'));
    toast(`Turno ${n} creado. Ajusta sus horas.`);
  }

  // ---------- Asistencia del día (líderes y gerencia) ----------
  async function cargarAsistencia() {
    const sedes = S.sedes.filter((s) => lideraSede(s.id));
    const fechas = [...new Set(sedes.map((s) => fechaEn(s.zona_horaria)))].sort();
    if (!fechas.length) { S.asistencia = { malla: [], marcas: [], ausencias: [], hora: new Date() }; return; }
    const desde = fechas[0], hasta = fechas[fechas.length - 1];
    const [malla, marcas, ausencias] = await Promise.all([
      mallaEfectiva(desde, hasta),
      todas(() => sb.from('marcas').select('*').gte('fecha', desde).lte('fecha', hasta).order('id')),
      q(sb.rpc('ausencias_aprobadas', { p_desde: desde, p_hasta: hasta })),
    ]);
    S.asistencia = { malla, marcas, ausencias, hora: new Date() };
  }

  // Estado de una persona hoy, en este orden: ausencia, descanso, sin entrada, con marcas.
  function estadoPersona(p, t, marcas, aus, tz) {
    if (aus) return { txt: TIPOS[aus.tipo].estado, cls: 'info', kpi: 'descanso' };
    if (t && !conHorario(t)) return { txt: t.nombre, cls: 'mute', kpi: 'descanso' };
    const ahora = ahoraMin(tz);
    if (!marcas.entrada) {
      if (!t) return { txt: ahora >= 720 ? 'Sin turno ni marca' : 'Sin turno', cls: 'mute', kpi: 'descanso' };
      const ent = toMin(t.entrada);
      if (ahora < ent) return { txt: 'Aún no inicia', cls: 'mute', kpi: 'descanso' };
      if (ahora > ent + 15) return { txt: 'Sin marcar entrada', cls: 'bad', kpi: 'sinmarcar' };
      return { txt: 'Por llegar', cls: 'warn', kpi: 'descanso' };
    }
    const alerta = PASOS.some((x) => { const ev = evaluar(x.tipo, t, marcas, tz); return ev.chip && ev.chip.alerta; });
    return alerta ? { txt: 'Con novedad', cls: 'warn', kpi: 'novedad' } : { txt: 'Al día', cls: 'ok', kpi: 'aldia' };
  }

  function asistenciaView() {
    const A = S.asistencia;
    if (!A) return cargandoBloque();
    const sedes = S.sedes.filter((s) => lideraSede(s.id));
    const personas = activas().filter((p) => lideraSede(p.sede_id) && (S.asisSede === 'todas' || String(p.sede_id) === String(S.asisSede)));
    const cuenta = { aldia: 0, novedad: 0, sinmarcar: 0, descanso: 0 };
    const filas = porArea(personas).map((g) => `<tr class="grupo"><th colspan="7" scope="rowgroup">${esc(g.area)}</th></tr>` + g.personas.map((p) => {
      const tz = tzSede(p.sede_id), hoy = fechaEn(tz);
      const f = A.malla.find((x) => x.persona_id === p.id && x.fecha === hoy);
      const t = f ? turno(f.turno_id) : null;
      const marcas = {};
      A.marcas.filter((m) => m.persona_id === p.id && m.fecha === hoy).forEach((m) => { marcas[m.tipo] = m; });
      const aus = A.ausencias.find((a) => a.persona_id === p.id && a.desde <= hoy && a.hasta >= hoy);
      const st = estadoPersona(p, t, marcas, aus, tz);
      cuenta[st.kpi]++;
      const celdas = PASOS.map((x) => {
        const ev = evaluar(x.tipo, t, marcas, tz);
        if (ev.real != null) return `<td class="num"><b>${hm(ev.real)}</b>${ev.chip && ev.chip.alerta ? `<span class="chip ${ev.chip.cls} xs">${esc(ev.chip.txt)}</span>` : ''}</td>`;
        return `<td class="num prog">${ev.prog != null && !(x.tipo.includes('almuerzo') && !conAlmuerzo(t)) ? hm(ev.prog) : '—'}</td>`;
      }).join('');
      return `<tr>${personaTd(p)}<td><span class="chipt ${colorTurno(t)}" title="${esc(t ? turnoEtq(t) : '')}">${esc(t ? chipTxt(t) : '—')}</span></td>${celdas}<td><span class="chip ${st.cls}">${esc(st.txt)}</span></td></tr>`;
    }).join('')).join('');
    const kpi = (n, txt, cls) => `<div class="kpi ${cls}"><b>${n}</b><span>${txt}</span></div>`;
    return encabezado('Hoy', '¿Quién está <em>trabajando hoy?</em>', `Comparado con la malla. Actualizado a las ${esc(horaDe(A.hora, miTz()))}.`,
      `<div class="toolbar">${sedes.length > 1 ? `<label class="field inline"><span>Sede</span><select data-asede="1"><option value="todas">Todas</option>${sedes.map((s) => `<option value="${s.id}"${String(S.asisSede) === String(s.id) ? ' selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select></label>` : ''}
        <button type="button" class="btn ghost sm" data-accion="recargarAsistencia"${ocupado('asis')}>${ico('recargar')}Actualizar</button></div>`)
      + `<div class="kpis four">${kpi(cuenta.aldia, 'Al día', 'ok')}${kpi(cuenta.novedad, 'Con novedad', 'warn')}${kpi(cuenta.sinmarcar, 'Sin marcar entrada', 'bad')}${kpi(cuenta.descanso, 'Descanso o por llegar', 'mute')}</div>
      <div class="tablewrap card flush"><table class="asis">
        <thead><tr><th scope="col">Persona</th><th scope="col">Turno</th>${PASOS.map((x) => `<th scope="col" class="num" title="${x.nombre}">${x.cod}</th>`).join('')}<th scope="col">Estado</th></tr></thead>
        <tbody>${filas || '<tr><td colspan="7" class="vacio">No hay personas en tu sede.</td></tr>'}</tbody>
      </table></div>
      <p class="hint">En gris, la hora programada de lo que aún no se marca.</p>`;
  }

  // ---------- Comunicados ----------
  const DESTINOS = { todos: 'Todo el equipo', area: 'Área', sede: 'Sede' };
  function destinatarios(c) {
    return activas().filter((p) => p.id !== c.autor_id && (c.destino === 'todos'
      || (c.destino === 'area' && p.area_id === c.destino_id)
      || (c.destino === 'sede' && p.sede_id === c.destino_id)));
  }
  const destinoTxt = (c) => (c.destino === 'todos' ? 'Todo el equipo' : c.destino === 'area' ? `Área ${(areaDe(c.destino_id) || {}).nombre || ''}` : `Sede ${(sedeDe(c.destino_id) || {}).nombre || ''}`);
  const leyo = (c, pid) => S.com.lect.some((l) => l.comunicado_id === c.id && l.persona_id === pid);
  const soyDestino = (c) => destinatarios(c).some((p) => p.id === P().id);
  const pendiente = (c) => !!(c.requiere_confirmacion && soyDestino(c) && !leyo(c, P().id));
  const comunicadosVisibles = () => S.com.lista.filter((c) => c.autor_id === P().id || esGerencia() || puedePublicar() || soyDestino(c));
  const sinConfirmar = () => comunicadosVisibles().filter(pendiente);

  async function cargarComunicados() {
    const lista = await q(sb.from('comunicados').select('*').order('fijado', { ascending: false }).order('creado', { ascending: false }).limit(300));
    const ids = lista.map((c) => c.id);
    let imgs = [], lect = [];
    if (ids.length) {
      [imgs, lect] = await Promise.all([
        q(sb.from('comunicado_imagenes').select('*').in('comunicado_id', ids).order('orden')),
        todas(() => sb.from('comunicado_lecturas').select('*').in('comunicado_id', ids).order('comunicado_id')),
      ]);
    }
    await firmar('comunicados', imgs);
    S.com.lista = lista;
    S.com.imgs = imgs;
    S.com.lect = lect;
  }

  // URL firmadas de 1 hora para archivos privados
  async function firmar(bucket, filas) {
    if (!filas.length) return;
    const { data } = await sb.storage.from(bucket).createSignedUrls(filas.map((f) => f.ruta), 3600);
    const urls = {};
    (data || []).forEach((d) => { if (d && d.signedUrl) urls[d.path] = d.signedUrl; });
    filas.forEach((f) => { f.url = urls[f.ruta] || ''; });
  }

  // Resalta la búsqueda sin importar tildes ni mayúsculas
  function resaltar(txt, busq) {
    txt = String(txt == null ? '' : txt);
    const nq = norm(busq).trim();
    if (!nq) return esc(txt);
    let nt = '';
    const mapa = [];
    for (let i = 0; i < txt.length; i++) {
      const n = norm(txt[i]);
      for (let j = 0; j < n.length; j++) mapa.push(i);
      nt += n;
    }
    let out = '', ultimo = 0, desde = 0, k;
    while ((k = nt.indexOf(nq, desde)) !== -1) {
      const a = mapa[k], b = mapa[k + nq.length - 1] + 1;
      if (a >= ultimo) { out += esc(txt.slice(ultimo, a)) + '<mark>' + esc(txt.slice(a, b)) + '</mark>'; ultimo = b; }
      desde = k + nq.length;
    }
    return out + esc(txt.slice(ultimo));
  }

  function avisoLectura(c) {
    if (!c.requiere_confirmacion) return '';
    let out = '';
    if (soyDestino(c)) {
      out += leyo(c, P().id)
        ? `<div class="lectura"><span class="chip ok">${ico('check')}Leído</span></div>`
        : `<div class="lectura"><span class="chip warn">Requiere confirmación</span><button type="button" class="btn sm" data-leer="${c.id}"${ocupado('leer' + c.id)}>${ico('check')}Confirmar lectura</button></div>`;
    }
    if (puedePublicar()) {
      const dest = destinatarios(c);
      const si = dest.filter((p) => leyo(c, p.id));
      const faltan = dest.filter((p) => !leyo(c, p.id));
      const pct = dest.length ? Math.round((si.length / dest.length) * 100) : 0;
      out += `<div class="seguimiento"><div class="seg-h"><span>Confirmado por <b>${si.length} de ${dest.length}</b></span><span class="hint">${pct} %</span></div>
          <div class="meter" role="img" aria-label="${pct} % confirmado"><span style="width:${pct}%"></span></div>
          ${faltan.length ? `<p class="hint">Faltan: ${faltan.map((p) => esc(p.nombre)).join(', ')}</p>` : ''}</div>`;
    }
    return out;
  }

  function notaView(c) {
    const tz = miTz();
    const imgs = S.com.imgs.filter((i) => i.comunicado_id === c.id);
    const puedeBorrar = c.autor_id === P().id || esGerencia();
    const pend = pendiente(c);
    const qq = S.com.q;
    const borrar = S.com.borrar === c.id
      ? `<span class="confirmar">¿Eliminar este comunicado? <button type="button" class="btn danger sm" data-borrarcom="${c.id}"${ocupado('borrar')}>Sí, eliminar</button><button type="button" class="btn txt sm" data-comf="cancelar">Cancelar</button></span>`
      : puedeBorrar ? `<button type="button" class="btn txt sm" data-comf="borrar:${c.id}">${ico('basura')}Eliminar</button>` : '';
    return `<article class="note${pend ? ' pend' : ''}" id="com-${c.id}">
        <header class="note-h">
          ${c.fijado ? `<span class="chip info">${ico('fijar')}Fijado</span>` : ''}
          <span class="note-meta"><b>${esc(nombreDe(c.autor_id))}</b> · ${esc(fechaHora(c.creado, tz))}${imgs.length ? ` · ${plural(imgs.length, 'imagen', 'imágenes')}` : ''}</span>
          ${borrar}
        </header>
        <h3>${resaltar(c.titulo, qq)}</h3>
        ${c.cuerpo ? `<p class="note-cuerpo">${resaltar(c.cuerpo, qq).replace(/\n/g, '<br>')}</p>` : ''}
        <p class="hint">Para: ${esc(destinoTxt(c))}</p>
        ${imgs.length ? `<div class="thumbs">${imgs.map((im, i) => `<button type="button" class="thumb" data-lb="${c.id}|${i}" aria-label="Ver imagen ${i + 1}">${im.url ? `<img src="${esc(im.url)}" alt="${esc(im.nombre || '')}" loading="lazy">` : ico('imagen')}</button>`).join('')}</div>` : ''}
        ${avisoLectura(c)}
      </article>`;
  }

  function listaComunicados() {
    const qq = norm(S.com.q).trim();
    let lista = comunicadosVisibles();
    if (S.com.filtro === 'pendientes') lista = lista.filter(pendiente);
    if (qq) lista = lista.filter((c) => norm(c.titulo + ' ' + c.cuerpo + ' ' + nombreDe(c.autor_id)).includes(qq));
    lista = lista.slice().sort((a, b) => (b.fijado - a.fijado) || (pendiente(b) - pendiente(a)) || (b.creado > a.creado ? 1 : -1));
    if (!lista.length) return `<p class="vacio">${qq ? 'Ningún comunicado coincide con la búsqueda.' : S.com.filtro === 'pendientes' ? 'No tienes comunicados por confirmar.' : 'Aún no hay comunicados.'}</p>`;
    return lista.map(notaView).join('');
  }

  function comunicadosView() {
    const pend = sinConfirmar().length;
    return encabezado('Avisos internos', '<em>Comunicados</em>', 'Lo que el equipo necesita saber. Si un comunicado pide confirmación, léelo y tócalo para confirmar.')
      + `<div class="grid-com${puedePublicar() ? '' : ' solo'}">
        <section class="news">
          <div class="toolbar">
            <div class="seg" role="group" aria-label="Filtro">
              <button type="button" data-comf="todos" aria-pressed="${S.com.filtro === 'todos'}">Todos</button>
              <button type="button" data-comf="pendientes" aria-pressed="${S.com.filtro === 'pendientes'}">Sin confirmar (${pend})</button>
            </div>
            <label class="search">${ico('buscar')}<input type="search" data-buscar="com" value="${esc(S.com.q)}" placeholder="Buscar" aria-label="Buscar comunicados"></label>
          </div>
          <div id="lista-com">${listaComunicados()}</div>
        </section>
        ${puedePublicar() ? composeView() : ''}
      </div>`;
  }

  function composeView() {
    const b = S.com.borrador;
    const destinoSel = b.destino || 'todos';
    const [dt, did] = destinoSel.split(':');
    const n = destinatarios({ autor_id: P().id, destino: dt, destino_id: did ? +did : null }).length;
    const opts = [`<option value="todos">Todo el equipo</option>`]
      .concat(S.areas.map((a) => `<option value="area:${a.id}"${destinoSel === 'area:' + a.id ? ' selected' : ''}>Área: ${esc(a.nombre)}</option>`))
      .concat(variasSedes() ? S.sedes.map((s) => `<option value="sede:${s.id}"${destinoSel === 'sede:' + s.id ? ' selected' : ''}>Sede: ${esc(s.nombre)}</option>`) : []);
    return `<aside class="compose card">
        <form data-form="com" data-borrador="com" novalidate>
          <span class="eyebrow">Publicar</span>
          <h2>Nuevo comunicado</h2>
          <label class="field"><span>Título</span><input name="titulo" maxlength="140" value="${esc(b.titulo || '')}" required><small class="hint">${(b.titulo || '').length}/140</small></label>
          <label class="field"><span>Mensaje</span><textarea name="cuerpo" rows="6">${esc(b.cuerpo || '')}</textarea></label>
          <label class="field"><span>Para</span><select name="destino">${opts.join('')}</select><small class="hint">Lo recibirán ${plural(n, 'persona', 'personas')}.</small></label>
          <label class="chk"><input type="checkbox" name="confirmar"${b.confirmar !== false ? ' checked' : ''}><span>Pedir confirmación de lectura</span></label>
          <label class="chk"><input type="checkbox" name="fijar"${b.fijar ? ' checked' : ''}><span>Fijar arriba</span></label>
          <label class="field"><span>Imágenes (JPG, PNG o WEBP)</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple data-archivos="com"></label>
          ${S.com.archivos.length ? `<div class="thumbs">${S.com.archivos.map((f, i) => `<span class="thumb prev"><img src="${esc(f.url)}" alt=""><button type="button" class="quitar" data-quitarimg="${i}" aria-label="Quitar ${esc(f.file.name)}">${ico('x')}</button></span>`).join('')}</div>` : ''}
          <button class="btn block" type="submit"${ocupado('publicar')}>${S.ocupado === 'publicar' ? 'Publicando…' : 'Publicar'}</button>
        </form>
      </aside>`;
  }

  // Reduce a 1920 px y JPG 0,85 si la imagen es más grande o pesa más de 1,5 MB.
  async function prepararImagen(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    let img;
    try { img = await cargarImagen(file); } catch (e) { return file; }
    const max = Math.max(img.width, img.height);
    if (max <= 1920 && file.size <= 1.5 * 1024 * 1024) return file;
    const k = Math.min(1, 1920 / max);
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k);
    cv.height = Math.round(img.height * k);
    const cx = cv.getContext('2d');
    cx.fillStyle = '#FFFFFF';
    cx.fillRect(0, 0, cv.width, cv.height);
    cx.drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  }
  function cargarImagen(file) {
    return new Promise((ok, mal) => {
      const u = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => { URL.revokeObjectURL(u); ok(im); };
      im.onerror = (e) => { URL.revokeObjectURL(u); mal(e); };
      im.src = u;
    });
  }
  const nombreArchivo = (n) => norm(n).replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').slice(-60) || 'archivo';

  async function subirArchivos(bucket, carpeta, archivos) {
    const subidos = [];
    let fallas = 0;
    for (let i = 0; i < archivos.length; i++) {
      try {
        const f = await prepararImagen(archivos[i]);
        const ruta = `${carpeta}/${Date.now()}-${i + 1}-${nombreArchivo(f.name)}`;
        const { error } = await sb.storage.from(bucket).upload(ruta, f, { contentType: f.type || 'application/octet-stream', upsert: false });
        if (error) throw error;
        subidos.push({ ruta, nombre: archivos[i].name, tipo_mime: f.type, orden: i });
      } catch (e) { fallas++; }
    }
    return { subidos, fallas };
  }

  async function publicarComunicado(form) {
    const b = S.com.borrador;
    const titulo = String(b.titulo || '').trim();
    if (!titulo) { toast('Escribe un título.', 'bad'); form.titulo.focus(); return; }
    const [destino, did] = String(b.destino || 'todos').split(':');
    await accion('publicar', async () => {
      const c = await q(sb.from('comunicados').insert({
        autor_id: P().id, titulo, cuerpo: String(b.cuerpo || '').trim(), destino, destino_id: did ? +did : null,
        requiere_confirmacion: b.confirmar !== false, fijado: !!b.fijar,
      }).select().single());
      const { subidos, fallas } = await subirArchivos('comunicados', c.id, S.com.archivos.map((x) => x.file));
      if (subidos.length) await q(sb.from('comunicado_imagenes').insert(subidos.map((s) => ({ comunicado_id: c.id, ruta: s.ruta, nombre: s.nombre, orden: s.orden }))));
      S.com.archivos.forEach((x) => URL.revokeObjectURL(x.url));
      S.com.borrador = { confirmar: true };
      S.com.archivos = [];
      await cargarComunicados();
      toast(fallas ? `Comunicado publicado, pero ${plural(fallas, 'imagen no se pudo', 'imágenes no se pudieron')} subir.` : 'Comunicado publicado.', fallas ? 'warn' : 'ok');
    });
  }

  function lightboxView() {
    const L = S.lb, it = L.items[L.i];
    const esPdf = /pdf/i.test(it.tipo || '') || /\.pdf$/i.test(it.nombre || it.ruta || '');
    return `<div class="lightbox" role="dialog" aria-modal="true" aria-label="${esc(L.titulo)}">
        <div class="lb-h"><span><b>${esc(L.titulo)}</b> · ${L.i + 1} de ${L.items.length}</span>
          <span class="lb-acc">${it.url ? `<a class="btn ghost sm" href="${esc(it.url)}" target="_blank" rel="noopener">${ico('externo')}Abrir en tamaño completo</a>` : ''}
          <button type="button" class="btn txt sm" data-accion="lbCerrar" aria-label="Cerrar">${ico('x')}</button></span></div>
        <div class="lb-cuerpo">
          ${L.items.length > 1 ? `<button type="button" class="lb-nav izq" data-lbmover="-1" aria-label="Anterior">${ico('izq')}</button>` : ''}
          ${esPdf ? `<div class="lb-pdf">${ico('documento')}<b>${esc(it.nombre || 'Documento PDF')}</b><a class="btn" href="${esc(it.url)}" target="_blank" rel="noopener">Abrir el PDF</a></div>`
            : it.url ? `<img src="${esc(it.url)}" alt="${esc(it.nombre || '')}">` : '<p class="vacio">No se pudo cargar el archivo.</p>'}
          ${L.items.length > 1 ? `<button type="button" class="lb-nav der" data-lbmover="1" aria-label="Siguiente">${ico('der')}</button>` : ''}
        </div>
      </div>`;
  }

  // ---------- Solicitudes (módulo opcional) ----------
  const TIPOS = {
    vacaciones: { nombre: 'Vacaciones', ayuda: 'Días de descanso', estado: 'Vacaciones', icono: 'sol' },
    permiso: { nombre: 'Permiso', ayuda: 'Un día, unas horas o una cita', estado: 'Ausencia con permiso', icono: 'reloj' },
    incapacidad: { nombre: 'Incapacidad', ayuda: 'Sube la foto de la incapacidad', estado: 'Incapacidad', icono: 'documento' },
  };
  const TODOS_TIPOS = Object.keys(TIPOS);
  const ESTADOS = { pendiente: { txt: 'Pendiente', cls: 'warn' }, aprobada: { txt: 'Aprobada', cls: 'ok' }, rechazada: { txt: 'Rechazada', cls: 'bad' } };
  const moduloSol = () => !!(S.config.modulo_solicitudes && S.config.modulo_solicitudes.activo);
  const miAcceso = () => S.revisores.find((r) => r.persona_id === P().id) || null;
  const verSolicitudes = () => moduloSol() || esGerencia();
  const cubreSede = (acc, pid) => acc.sede_id == null || acc.sede_id === (persona(pid) || {}).sede_id;
  const puedeVerSol = (s) => s.persona_id === P().id || esGerencia() || (() => { const a = miAcceso(); return !!(a && a.tipos.includes(s.tipo) && cubreSede(a, s.persona_id)); })();
  function puedeAprobar(s) {
    if (s.estado !== 'pendiente' || s.persona_id === P().id) return false;
    if (esGerencia()) return true;
    const a = miAcceso();
    return !!(a && a.nivel === 'aprobar' && a.tipos.includes(s.tipo) && cubreSede(a, s.persona_id));
  }
  const porRevisar = () => S.sol.lista.filter(puedeAprobar);
  // Días sin contar domingos
  function diasHabiles(desde, hasta) {
    let n = 0;
    for (let d = desde; d <= hasta; d = sumarDias(d, 1)) if (diaSemana(d) !== 7) n++;
    return n;
  }
  const rangoSol = (s) => (s.desde === s.hasta ? fechaCorta(s.desde) : `${fechaCorta(s.desde)} – ${fechaCorta(s.hasta)}`);
  const duracionSol = (s) => (s.hora_desde ? `${hhmm(s.hora_desde)}–${hhmm(s.hora_hasta)}` : plural(diasHabiles(s.desde, s.hasta), 'día', 'días'));

  async function cargarSolicitudes() {
    const [lista, revisores] = await Promise.all([
      todas(() => sb.from('solicitudes').select('*').order('creado', { ascending: false })),
      q(sb.from('revisores').select('*')),
    ]);
    const ids = lista.map((s) => s.id);
    const adj = ids.length ? await q(sb.from('solicitud_adjuntos').select('*').in('solicitud_id', ids)) : [];
    await firmar('soportes', adj);
    S.sol.lista = lista.filter(puedeVerSol);
    S.sol.adj = adj;
    S.revisores = revisores;
  }

  function solTarjeta(s, revisar) {
    const T = TIPOS[s.tipo], E = ESTADOS[s.estado], p = persona(s.persona_id) || {};
    const mia = s.persona_id === P().id;
    const adj = S.sol.adj.filter((a) => a.solicitud_id === s.id);
    const area = areaDe(p.area_id), sede = sedeDe(p.sede_id);
    return `<article class="sol">
        <div class="sol-h">
          <span class="sq">${ico(T.icono)}</span>
          <div class="sol-t"><b>${esc(T.nombre)}${mia ? '' : ' · ' + esc(p.nombre || '')}</b><small>${esc(rangoSol(s))} · ${esc(duracionSol(s))}</small></div>
          <span class="chip ${E.cls}">${E.txt}</span>
        </div>
        ${mia ? '' : `<p class="hint">${esc([area && area.nombre, variasSedes() && sede && sede.nombre].filter(Boolean).join(' · '))}</p>`}
        ${s.motivo ? `<p class="sol-motivo">${esc(s.motivo)}</p>` : ''}
        ${adj.length ? `<div class="soportes">${adj.map((a, i) => `<button type="button" class="soporte" data-lbsol="${s.id}|${i}">${ico(/pdf/.test(a.tipo_mime || '') ? 'documento' : 'clip')}${esc(a.nombre || 'Soporte')}</button>`).join('')}</div>` : ''}
        ${s.revisado_por ? `<p class="hint">${s.estado === 'aprobada' ? 'Aprobó' : 'Rechazó'} ${esc(nombreDe(s.revisado_por))} el ${esc(fechaCorta(fechaEn(miTz(), new Date(s.revisado_en))))}${s.comentario ? `: «${esc(s.comentario)}»` : '.'}</p>` : ''}
        ${mia && s.estado === 'pendiente' ? (S.sol.cancelar === s.id
          ? `<p class="confirmar">¿Cancelar esta solicitud? <button type="button" class="btn danger sm" data-cancelarsol="${s.id}"${ocupado('cancelar')}>Sí, cancelar</button><button type="button" class="btn txt sm" data-cancelarsol="no">No</button></p>`
          : `<button type="button" class="btn txt sm" data-cancelarsol="pedir:${s.id}">Cancelar solicitud</button>`) : ''}
        ${revisar ? `<div class="revisar">
            <label class="field"><span>Comentario (opcional)</span><input type="text" data-coment="${s.id}" value="${esc(S.sol.coment[s.id] || '')}" maxlength="300"></label>
            <div class="acc"><button type="button" class="btn sm" data-revisar="${s.id}|1"${ocupado('rev' + s.id)}>${ico('check')}Aprobar</button><button type="button" class="btn ghost sm" data-revisar="${s.id}|0"${ocupado('rev' + s.id)}>Rechazar</button></div>
          </div>` : ''}
      </article>`;
  }

  function solFormView() {
    const b = S.sol.borrador, tipo = S.sol.tipo, hoy = fechaEn(miTz());
    return `<section class="card">
        <form data-form="sol" data-borrador="sol" novalidate>
          <span class="eyebrow">Nueva solicitud</span>
          <h2>¿Qué necesitas?</h2>
          <div class="tipos" role="radiogroup" aria-label="Tipo de solicitud">${TODOS_TIPOS.map((k) => `<button type="button" role="radio" aria-checked="${tipo === k}" data-soltipo="${k}"><span class="sq">${ico(TIPOS[k].icono)}</span><b>${TIPOS[k].nombre}</b><small>${TIPOS[k].ayuda}</small></button>`).join('')}</div>
          <div class="form-grid">
            <label class="field"><span>Desde</span><input type="date" name="desde" value="${esc(b.desde || hoy)}" required></label>
            <label class="field"><span>Hasta</span><input type="date" name="hasta" value="${esc(b.hasta || b.desde || hoy)}" required></label>
            ${tipo === 'permiso' ? `<label class="field"><span>Hora desde (opcional)</span><input type="time" name="hora_desde" value="${esc(b.hora_desde || '')}"></label>
            <label class="field"><span>Hora hasta</span><input type="time" name="hora_hasta" value="${esc(b.hora_hasta || '')}"></label>` : ''}
          </div>
          <label class="field"><span>${tipo === 'incapacidad' ? 'Diagnóstico o comentario' : 'Motivo'}</span><textarea name="motivo" rows="3">${esc(b.motivo || '')}</textarea></label>
          <label class="field"><span>Soportes (opcional): foto o PDF</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,.heic,application/pdf" data-archivos="sol"></label>
          ${S.sol.archivos.length ? `<ul class="archivos">${S.sol.archivos.map((f, i) => `<li>${ico('clip')}<span>${esc(f.name)}</span><button type="button" class="btn txt sm" data-quitarsop="${i}" aria-label="Quitar ${esc(f.name)}">${ico('x')}</button></li>`).join('')}</ul>` : ''}
          <button class="btn block" type="submit"${ocupado('sol')}>${S.ocupado === 'sol' ? 'Enviando…' : 'Enviar solicitud'}</button>
        </form>
      </section>`;
  }

  function revisoresView() {
    const filas = S.revisores.map((r) => {
      const p = persona(r.persona_id);
      if (!p) return '';
      return `<tr>
          <th scope="row" class="persona"><span class="avatar sm">${esc(initials(p.nombre))}</span><span><b>${esc(p.nombre)}</b><small>${esc(ROLES[p.rol] || '')}</small></span></th>
          <td>${variasSedes() ? `<select data-rev="${r.persona_id}|sede_id" aria-label="Sede"><option value="">Todas las sedes</option>${S.sedes.map((s) => `<option value="${s.id}"${r.sede_id === s.id ? ' selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select>` : 'Todas'}</td>
          <td><div class="chks">${TODOS_TIPOS.map((t) => `<label class="chk"><input type="checkbox" data-revtipo="${r.persona_id}|${t}"${r.tipos.includes(t) ? ' checked' : ''}><span>${TIPOS[t].nombre}</span></label>`).join('')}</div></td>
          <td><select data-rev="${r.persona_id}|nivel" aria-label="Permiso"><option value="aprobar"${r.nivel === 'aprobar' ? ' selected' : ''}>Ver, aprobar y rechazar</option><option value="ver"${r.nivel === 'ver' ? ' selected' : ''}>Solo ver</option></select></td>
          <td><button type="button" class="btn txt sm" data-revquitar="${r.persona_id}">Quitar</button></td>
        </tr>`;
    }).join('');
    const candidatos = activas().filter((p) => p.rol !== 'gerente' && !p.es_admin && !S.revisores.some((r) => r.persona_id === p.id));
    return `<div class="tablewrap"><table class="perm">
        <thead><tr><th scope="col">Persona</th><th scope="col">Sede</th><th scope="col">Tipos</th><th scope="col">Permiso</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead>
        <tbody>
          <tr class="fija"><th scope="row">Gerencia</th><td>Todas</td><td>Todos los tipos</td><td>Siempre</td><td></td></tr>
          ${filas}
        </tbody>
      </table></div>
      ${candidatos.length ? `<div class="addrow"><label class="field inline"><span>Dar acceso a</span><select id="rev-nuevo">${candidatos.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></label><button type="button" class="btn sm" data-accion="revAgregar"${ocupado('rev')}>${ico('mas')}Dar acceso</button></div>` : ''}`;
  }

  function solicitudesView() {
    const mias = S.sol.lista.filter((s) => s.persona_id === P().id);
    const ajenas = S.sol.lista.filter((s) => s.persona_id !== P().id);
    const pend = ajenas.filter(puedeAprobar);
    const historial = ajenas.filter((s) => !puedeAprobar(s));
    const acc = miAcceso();
    const revisa = esGerencia() || !!acc;
    let explica = '';
    if (acc && !esGerencia()) {
      explica = `<div class="notice info">${ico('lista')}<span>La gerencia te dio acceso para <b>${acc.nivel === 'aprobar' ? 'ver, aprobar y rechazar' : 'ver'}</b> solicitudes de ${acc.tipos.map((t) => TIPOS[t].nombre.toLowerCase()).join(', ')}${variasSedes() ? (acc.sede_id ? ` de la sede ${esc((sedeDe(acc.sede_id) || {}).nombre || '')}` : ' de todas las sedes') : ''}. Nunca las tuyas.</span></div>`;
    }
    const gerencia = esGerencia() ? `<section class="modcard card">
        <div class="modcard-h">
          <div><span class="eyebrow">Gerencia</span><h2>Módulo de solicitudes</h2><p class="hint">${moduloSol() ? 'Activo: el equipo puede pedir vacaciones, permisos e incapacidades.' : 'Apagado: nadie puede crear solicitudes. Lo aprobado sigue justificando ausencias.'}</p></div>
          <button type="button" class="switch" role="switch" aria-checked="${moduloSol()}" data-accion="moduloSol"${ocupado('modulo')}><span></span><b>${moduloSol() ? 'Activo' : 'Apagado'}</b></button>
        </div>
        <h3>¿Quién revisa las solicitudes?</h3>
        <p class="hint">Las líderes de sede no revisan solicitudes por defecto. Asigna aquí a quien las revisa (por ejemplo, contabilidad).</p>
        ${revisoresView()}
      </section>` : '';
    return encabezado('Vacaciones, permisos e incapacidades', '<em>Solicitudes</em>', moduloSol() ? 'Pide tus días y sigue su estado. La gerencia asigna quién las revisa.' : '')
      + gerencia
      + (!moduloSol() ? `<div class="notice">${ico('alerta')}<span>La gerencia aún no ha activado las solicitudes.</span></div>` : '')
      + explica
      + (revisa ? `<section class="sol-sec"><div class="sec-h"><h2>Por aprobar (${pend.length})</h2></div>${pend.length ? `<div class="sol-grid">${pend.map((s) => solTarjeta(s, true)).join('')}</div>` : '<p class="vacio">No hay solicitudes pendientes.</p>'}</section>` : '')
      + `<div class="grid-sol">
          ${moduloSol() ? solFormView() : ''}
          <section class="sol-sec"><div class="sec-h"><h2>Mis solicitudes</h2></div>${mias.length ? mias.map((s) => solTarjeta(s, false)).join('') : '<p class="vacio">Aún no has pedido nada.</p>'}</section>
        </div>`
      + (revisa && historial.length ? `<section class="sol-sec"><div class="sec-h"><h2>Historial del equipo</h2></div><div class="sol-grid">${historial.map((s) => solTarjeta(s, false)).join('')}</div></section>` : '');
  }

  async function enviarSolicitud() {
    const b = S.sol.borrador, tipo = S.sol.tipo, hoy = fechaEn(miTz());
    const desde = b.desde || hoy, hasta = b.hasta || desde;
    const hd = tipo === 'permiso' ? b.hora_desde || '' : '', hh = tipo === 'permiso' ? b.hora_hasta || '' : '';
    if (hasta < desde) { toast('La fecha «hasta» no puede ser antes de «desde».', 'bad'); return; }
    if (!!hd !== !!hh) { toast('Escribe las dos horas o ninguna.', 'bad'); return; }
    if (hd && hd >= hh) { toast('La hora final debe ser después de la inicial.', 'bad'); return; }
    await accion('sol', async () => {
      const s = await q(sb.from('solicitudes').insert({
        persona_id: P().id, tipo, desde, hasta, hora_desde: hd || null, hora_hasta: hh || null, motivo: String(b.motivo || '').trim() || null,
      }).select().single());
      const { subidos, fallas } = await subirArchivos('soportes', s.id, S.sol.archivos);
      if (subidos.length) await q(sb.from('solicitud_adjuntos').insert(subidos.map((x) => ({ solicitud_id: s.id, ruta: x.ruta, nombre: x.nombre, tipo_mime: x.tipo_mime }))));
      S.sol.borrador = {};
      S.sol.archivos = [];
      await cargarSolicitudes();
      toast(fallas ? `Solicitud enviada, pero ${plural(fallas, 'soporte no se pudo', 'soportes no se pudieron')} subir.` : 'Solicitud enviada.', fallas ? 'warn' : 'ok');
    });
  }

  // ---------- Informes mensuales (panel de gerencia) ----------
  function mesesDisponibles() {
    const hoy = fechaEn(miTz());
    let y = +hoy.slice(0, 4), m = +hoy.slice(5, 7);
    const out = [];
    for (let i = 0; i < 12; i++) {
      out.push(`${y}-${String(m).padStart(2, '0')}`);
      m--; if (m === 0) { m = 12; y--; }
    }
    return out;
  }

  async function cargarInforme() {
    const I = S.inf;
    if (!I.mes) { const ms = mesesDisponibles(); I.mes = +fechaEn(miTz()).slice(8, 10) <= 5 ? ms[1] : ms[0]; }
    const mes = I.mes;
    if (P().rol === 'directora' && !esGerencia()) I.sede = P().sede_id;
    const desde = I.mes + '-01', hasta = ultimoDia(I.mes);
    const [malla, marcas, ausencias, coms] = await Promise.all([
      mallaEfectiva(desde, hasta),
      todas(() => sb.from('marcas').select('*').gte('fecha', desde).lte('fecha', hasta).order('id')),
      q(sb.rpc('ausencias_aprobadas', { p_desde: desde, p_hasta: hasta })),
      q(sb.from('comunicados').select('*').gte('creado', desde + 'T00:00:00').lte('creado', sumarDias(hasta, 1) + 'T00:00:00').order('creado')),
    ]);
    const enMes = coms.filter((c) => fechaEn(miTz(), new Date(c.creado)).slice(0, 7) === I.mes);
    const lect = enMes.length ? await todas(() => sb.from('comunicado_lecturas').select('*').in('comunicado_id', enMes.map((c) => c.id)).order('comunicado_id')) : [];
    if (S.inf !== I || I.mes !== mes) return; // llegó tarde: ya se pidió otro mes
    I.datos = { desde, hasta, malla, marcas, ausencias, coms: enMes, lect };
  }

  function calcularInforme() {
    const I = S.inf, D = I.datos, tl = tol();
    const filtro = (p) => lideraSede(p.sede_id) && (I.sede === 'todas' || String(p.sede_id) === String(I.sede)) && (I.area === 'todas' || String(p.area_id) === String(I.area));
    const personas = S.personas.filter(filtro);
    const ids = new Set(personas.map((p) => p.id));
    const marcas = {};
    D.marcas.forEach((m) => { if (ids.has(m.persona_id)) marcas[m.persona_id + '|' + m.fecha + '|' + m.tipo] = m; });
    const porDia = {};
    const filas = personas.map((p) => {
      const tz = tzSede(p.sede_id), hoy = fechaEn(tz);
      const r = { p, jornadas: 0, tardes: 0, minTarde: 0, almLargos: 0, salidasAntes: 0, extraMin: 0, sinMarcar: 0, conPermiso: 0, comSin: 0, dias: [] };
      D.malla.filter((f) => f.persona_id === p.id && f.fecha < hoy).forEach((f) => {
        const t = turno(f.turno_id);
        if (!conHorario(t)) return;
        const aus = D.ausencias.find((a) => a.persona_id === p.id && a.desde <= f.fecha && a.hasta >= f.fecha);
        if (aus) { r.conPermiso++; r.dias.push({ fecha: f.fecha, txt: TIPOS[aus.tipo].estado, cls: 'info' }); return; }
        const m = (tipo) => marcas[p.id + '|' + f.fecha + '|' + tipo];
        const ent = m('entrada');
        if (!ent) { r.sinMarcar++; r.dias.push({ fecha: f.fecha, txt: 'Sin marcar', cls: 'bad' }); return; }
        r.jornadas++;
        const tarde = minDe(ent.hora, tz) - toMin(t.entrada);
        if (tarde > tl.entrada) {
          r.tardes++; r.minTarde += tarde;
          r.dias.push({ fecha: f.fecha, txt: `Tarde ${tarde} min`, cls: 'bad' });
          (porDia[f.fecha] = porDia[f.fecha] || []).push({ nombre: p.nombre, min: tarde });
        }
        const alm = m('salida_almuerzo'), reg = m('regreso_almuerzo');
        if (alm && reg && conAlmuerzo(t)) {
          const dur = minDe(reg.hora, tz) - minDe(alm.hora, tz);
          if (dur > toMin(t.regreso_almuerzo) - toMin(t.salida_almuerzo) + tl.almuerzo) { r.almLargos++; r.dias.push({ fecha: f.fecha, txt: `Almuerzo ${dur} min`, cls: 'warn' }); }
        }
        const sal = m('salida');
        if (sal) {
          const d = minDe(sal.hora, tz) - toMin(t.salida);
          if (d < 0) { r.salidasAntes++; r.dias.push({ fecha: f.fecha, txt: `Salió ${-d} min antes`, cls: 'warn' }); }
          if (d >= 30) { r.extraMin += d; r.dias.push({ fecha: f.fecha, txt: `${d} min extra`, cls: 'info' }); }
        }
      });
      r.comSin = D.coms.filter((c) => c.requiere_confirmacion && destinatarios(c).some((x) => x.id === p.id) && !D.lect.some((l) => l.comunicado_id === c.id && l.persona_id === p.id)).length;
      r.puntualidad = r.jornadas ? ((r.jornadas - r.tardes) / r.jornadas) * 100 : null;
      r.dias.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
      return r;
    }).filter((r) => r.jornadas || r.sinMarcar || r.conPermiso);
    const tot = filas.reduce((a, r) => {
      ['jornadas', 'tardes', 'minTarde', 'almLargos', 'salidasAntes', 'extraMin', 'sinMarcar', 'conPermiso'].forEach((k) => { a[k] += r[k]; });
      return a;
    }, { jornadas: 0, tardes: 0, minTarde: 0, almLargos: 0, salidasAntes: 0, extraMin: 0, sinMarcar: 0, conPermiso: 0 });
    tot.puntualidad = tot.jornadas ? ((tot.jornadas - tot.tardes) / tot.jornadas) * 100 : null;
    return { filas, tot, porDia };
  }

  const pct1 = (v) => (v == null ? '—' : `${v.toFixed(1).replace('.', ',')} %`);

  function graficaDias(porDia) {
    const I = S.inf, desde = I.mes + '-01', hasta = ultimoDia(I.mes);
    const dias = [];
    for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d);
    const vals = dias.map((d) => (porDia[d] || []).length);
    const max = Math.max(0, ...vals);
    const paso = max <= 5 ? 1 : max <= 10 ? 2 : 5;
    const tope = Math.max(paso, Math.ceil(max / paso) * paso);
    const W = 720, H = 220, L = 32, R = 8, T = 12, B = 30;
    const bw = (W - L - R) / dias.length;
    const y = (v) => T + (H - T - B) * (1 - v / tope);
    let svg = '';
    for (let v = 0; v <= tope; v += paso) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="g"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="t">${v}</text>`;
    dias.forEach((d, i) => {
      const v = vals[i], x = L + i * bw;
      if (v) svg += `<rect x="${x + bw * 0.18}" y="${y(v)}" width="${bw * 0.64}" height="${y(0) - y(v)}" rx="2" class="b" data-dia="${d}"/>`;
      svg += `<rect x="${x}" y="${T}" width="${bw}" height="${H - T - B}" class="hit" data-dia="${d}"/>`;
      if (i === 0 || diaSemana(d) === 1) svg += `<text x="${x + bw / 2}" y="${H - 10}" text-anchor="middle" class="t">${+d.slice(8, 10)}</text>`;
    });
    return `<div class="chartbox"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Llegadas tarde por día en ${esc(nombreMes(I.mes))}, máximo ${max}">${svg}</svg><div class="tip" id="tip" hidden></div></div>
      <p class="hint">Días marcados: el 1 y cada lunes. Pasa el cursor sobre un día para ver quién llegó tarde.</p>`;
  }

  function informesView() {
    const I = S.inf;
    if (!I.datos) return cargandoBloque();
    const { filas, tot, porDia } = calcularInforme();
    const m = meta();
    const sedes = S.sedes.filter((s) => lideraSede(s.id));
    const directora = P().rol === 'directora' && !esGerencia();
    const filtros = `<div class="filters">
        <label class="field inline"><span>Mes</span><select data-inf="mes">${mesesDisponibles().map((x) => `<option value="${x}"${x === I.mes ? ' selected' : ''}>${esc(nombreMes(x))}</option>`).join('')}</select></label>
        ${variasSedes() ? `<label class="field inline"><span>Sede</span><select data-inf="sede"${directora ? ' disabled' : ''}>${directora ? '' : '<option value="todas">Todas</option>'}${sedes.map((s) => `<option value="${s.id}"${String(I.sede) === String(s.id) ? ' selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select></label>` : ''}
        <label class="field inline"><span>Área</span><select data-inf="area"><option value="todas">Todas</option>${S.areas.map((a) => `<option value="${a.id}"${String(I.area) === String(a.id) ? ' selected' : ''}>${esc(a.nombre)}</option>`).join('')}</select></label>
        <button type="button" class="btn ghost sm" data-accion="exportar">${ico('descargar')}Exportar a Excel</button>
      </div>`;
    const cab = encabezado('Panel de gerencia', `Informe de <em>${esc(nombreMes(I.mes))}</em>`, `Solo cuentan días cerrados con turno con horario. Tolerancias: ${tol().entrada} min en la entrada y ${tol().almuerzo} min en el almuerzo.`, filtros);
    if (!filas.length) return cab + `<p class="vacio card">No hay jornadas cerradas para estos filtros.</p>`;
    const nivel = tot.puntualidad == null ? 'mute' : tot.puntualidad >= m ? 'ok' : tot.puntualidad >= m - 10 ? 'warn' : 'bad';
    const k = (n, txt, sub) => `<div class="kpi"><b>${n}</b><span>${txt}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const kpis = `<div class="kpis six">
        <div class="kpi hero ${nivel}"><span>Puntualidad</span><b>${pct1(tot.puntualidad)}</b>
          <div class="meter ${nivel}" role="img" aria-label="Meta ${m} %"><span style="width:${Math.min(100, tot.puntualidad || 0)}%"></span><i style="left:${m}%"></i></div>
          <small>Meta ${m} % · ${plural(tot.jornadas, 'jornada', 'jornadas')}</small></div>
        ${k(tot.tardes, 'Llegadas tarde', `${tot.minTarde} min en total`)}
        ${k(tot.almLargos, 'Almuerzos largos')}
        ${k(tot.salidasAntes, 'Salidas antes')}
        ${k(tot.sinMarcar, 'Jornadas sin marcar')}
        ${k(tot.conPermiso, 'Ausencias con permiso')}
        ${k(hm(tot.extraMin), 'Horas extra', 'salidas de 30 min o más')}
      </div>`;
    const rank = filas.filter((r) => r.minTarde > 0).sort((a, b) => b.minTarde - a.minTarde).slice(0, 8);
    const maxR = rank.length ? rank[0].minTarde : 1;
    const sel = I.sel && filas.find((r) => r.p.id === I.sel);
    const ranking = `<section class="card"><div class="sec-h"><h2>¿Quién llegó más tarde?</h2></div>
        ${rank.length ? `<ol class="rank">${rank.map((r) => `<li><button type="button" data-selinf="${r.p.id}" aria-pressed="${I.sel === r.p.id}"><span class="rank-n">${esc(r.p.nombre)}</span><span class="rank-bar"><span style="width:${(r.minTarde / maxR) * 100}%"></span></span><span class="rank-v">${r.minTarde} min · ${r.tardes}×</span></button></li>`).join('')}</ol>` : '<p class="vacio">Nadie llegó tarde este mes.</p>'}
        ${sel ? `<div class="detail"><div class="sec-h"><h3>${esc(sel.p.nombre)}</h3><button type="button" class="btn txt sm" data-selinf="">${ico('x')}Cerrar</button></div>
            <p class="hint">${plural(sel.jornadas, 'jornada', 'jornadas')} · puntualidad ${pct1(sel.puntualidad)} · ${sel.tardes} tardes (${sel.minTarde} min) · ${sel.sinMarcar} sin marcar · ${sel.conPermiso} con permiso</p>
            ${sel.dias.length ? `<ul class="chips-dia">${sel.dias.map((d) => `<li><small>${esc(fechaCorta(d.fecha))}</small><span class="chip ${d.cls} xs">${esc(d.txt)}</span></li>`).join('')}</ul>` : '<p class="vacio">Sin novedades este mes.</p>'}</div>` : '<p class="hint">Toca un nombre para ver el detalle por día.</p>'}
      </section>`;
    const cols = [['nombre', 'Persona'], ['jornadas', 'Jornadas'], ['tardes', 'Tardes'], ['minTarde', 'Min. tarde'], ['almLargos', 'Alm. largos'], ['salidasAntes', 'Salidas antes'], ['extraMin', 'Extra'], ['sinMarcar', 'Sin marcar'], ['conPermiso', 'Permiso'], ['comSin', 'Sin confirmar'], ['puntualidad', 'Puntualidad']];
    const o = I.orden;
    const ord = filas.slice().sort((a, b) => {
      const va = o.col === 'nombre' ? a.p.nombre : a[o.col], vb = o.col === 'nombre' ? b.p.nombre : b[o.col];
      const r = typeof va === 'string' ? va.localeCompare(vb, 'es') : (va == null ? -1 : va) - (vb == null ? -1 : vb);
      return o.asc ? r : -r;
    });
    const tabla = `<section><div class="sec-h"><h2>Por persona</h2><span class="hint">Toca un encabezado para ordenar</span></div>
        <div class="tablewrap card flush"><table class="rep">
          <thead><tr>${cols.map(([c, n]) => `<th scope="col"${c === 'nombre' ? '' : ' class="num"'} aria-sort="${o.col === c ? (o.asc ? 'ascending' : 'descending') : 'none'}"><button type="button" data-orden="${c}">${n}${o.col === c ? (o.asc ? ' ↑' : ' ↓') : ''}</button></th>`).join('')}</tr></thead>
          <tbody>${ord.map((r) => `<tr><th scope="row"><button type="button" class="enlace" data-selinf="${r.p.id}">${esc(r.p.nombre)}</button>${r.p.activo ? '' : ' <small class="hint">(desactivada)</small>'}</th>
            <td class="num">${r.jornadas}</td><td class="num">${r.tardes}</td><td class="num">${r.minTarde}</td><td class="num">${r.almLargos}</td><td class="num">${r.salidasAntes}</td><td class="num">${hm(r.extraMin)}</td><td class="num">${r.sinMarcar}</td><td class="num">${r.conPermiso}</td><td class="num">${r.comSin}</td>
            <td class="num"><span class="chip xs ${r.puntualidad == null ? 'mute' : r.puntualidad >= m ? 'ok' : r.puntualidad >= m - 10 ? 'warn' : 'bad'}">${pct1(r.puntualidad)}</span></td></tr>`).join('')}</tbody>
        </table></div></section>`;
    const coms = S.inf.datos.coms.filter((c) => c.requiere_confirmacion);
    let conf = '';
    if (coms.length) {
      let total = 0, leidos = 0;
      const items = coms.map((c) => {
        const dest = destinatarios(c).filter((p) => personas2(p));
        const si = dest.filter((p) => S.inf.datos.lect.some((l) => l.comunicado_id === c.id && l.persona_id === p.id));
        total += dest.length; leidos += si.length;
        const faltan = dest.filter((p) => !si.includes(p));
        return `<li><div><b>${esc(c.titulo)}</b><small class="hint">${esc(fechaCorta(fechaEn(miTz(), new Date(c.creado))))} · ${si.length} de ${dest.length}</small></div>${faltan.length ? `<p class="hint">Faltan: ${faltan.map((p) => esc(p.nombre)).join(', ')}</p>` : '<p class="hint">Todos confirmaron.</p>'}</li>`;
      }).join('');
      const pg = total ? (leidos / total) * 100 : null;
      conf = `<section class="card"><div class="sec-h"><h2>Confirmación de comunicados</h2><span class="chip ${pg == null ? 'mute' : pg >= 90 ? 'ok' : 'warn'}">${pct1(pg)}</span></div><ul class="conf">${items}</ul></section>`;
    }
    function personas2(p) { return lideraSede(p.sede_id) && (I.sede === 'todas' || String(p.sede_id) === String(I.sede)) && (I.area === 'todas' || String(p.area_id) === String(I.area)); }
    return cab + kpis
      + `<div class="grid-rep">
          <section class="card"><div class="sec-h"><h2>Llegadas tarde por día</h2></div>${graficaDias(porDia)}</section>
          ${ranking}
        </div>`
      + tabla + conf;
  }

  function exportarInforme() {
    if (CFG.sinDescargas) { toast('En esta vista previa no se descargan archivos. En la intranet publicada, este botón baja el CSV para Excel.', 'warn'); return; }
    const { filas } = calcularInforme();
    const cab = ['Persona', 'Correo', 'Sede', 'Área', 'Jornadas', 'Llegadas tarde', 'Minutos tarde', 'Promedio tarde (min)', 'Almuerzos largos', 'Salidas antes', 'Horas extra (min)', 'Sin marcar', 'Con permiso', 'Comunicados sin confirmar', 'Puntualidad %'];
    // Textos que empiezan con = + - @ se anteponen con ' para que Excel no los tome como fórmula
    const celda = (v) => { let s = String(v == null ? '' : v); if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = "'" + s; return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lineas = [cab.join(';')].concat(filas.map((r) => [
      r.p.nombre, r.p.correo, (sedeDe(r.p.sede_id) || {}).nombre || '', (areaDe(r.p.area_id) || {}).nombre || '',
      r.jornadas, r.tardes, r.minTarde, r.tardes ? (r.minTarde / r.tardes).toFixed(1).replace('.', ',') : '0',
      r.almLargos, r.salidasAntes, r.extraMin, r.sinMarcar, r.conPermiso, r.comSin,
      r.puntualidad == null ? '' : r.puntualidad.toFixed(1).replace('.', ','),
    ].map(celda).join(';')));
    const sede = S.inf.sede !== 'todas' ? '-' + nombreArchivo((sedeDe(+S.inf.sede) || {}).nombre || '') : '';
    const blob = new Blob(['﻿' + lineas.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `asistencia-${S.inf.mes}${sede}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Archivo descargado. Ábrelo con Excel.');
  }

  // ---------- Equipo (cuentas) ----------
  // Contraseña temporal de 10 caracteres, sin caracteres confusos (0, O, 1, l, I)
  function claveTemporal() {
    const abc = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const out = [];
    const buf = new Uint8Array(1);
    while (out.length < 10) {
      crypto.getRandomValues(buf);
      if (buf[0] < 256 - (256 % abc.length)) out.push(abc[buf[0] % abc.length]);
    }
    return out.join('');
  }

  async function funcionCuentas(body) {
    const { data, error } = await sb.functions.invoke('crear-usuario', { body });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) { /* sin cuerpo */ }
      throw new Error(msg);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  }
  async function recargarPersonas() {
    S.personas = await todas(() => sb.from('perfiles').select('*').order('nombre'));
  }

  function equipoView() {
    const E = S.equipo, b = E.borrador;
    const rolesCrear = esAdmin() ? Object.keys(ROLES) : ['colaborador'];
    const clave = E.claveNueva ? `<section class="clave card" aria-live="polite">
        <span class="eyebrow">${E.claveNueva.nueva ? 'Cuenta creada' : 'Contraseña nueva'}</span>
        <h2>${esc(E.claveNueva.nombre)}</h2>
        <p class="hint">Esta contraseña temporal se muestra <b>una sola vez</b>. Envíala por un canal privado; al entrar, la persona creará la suya.</p>
        <dl><div><dt>Usuario</dt><dd>${esc(E.claveNueva.correo)}</dd></div><div><dt>Contraseña temporal</dt><dd class="mono">${esc(E.claveNueva.clave)}</dd></div></dl>
        <div class="acc"><button type="button" class="btn" data-copiar="clave">${ico('copiar')}Copiar</button><button type="button" class="btn ghost" data-accion="cerrarClave">Listo</button></div>
      </section>` : '';
    const crear = `<section class="card">
        <form data-form="cuenta" data-borrador="cuenta" novalidate>
          <span class="eyebrow">Nueva cuenta</span><h2>Crear cuenta</h2>
          <div class="form-grid">
            <label class="field"><span>Nombre completo</span><input name="nombre" value="${esc(b.nombre || '')}" autocomplete="off" required></label>
            <label class="field"><span>Correo corporativo</span><input name="correo" type="email" value="${esc(b.correo || '')}" placeholder="${esc(MARCA.correoEjemplo)}" autocomplete="off" required></label>
            ${variasSedes() ? `<label class="field"><span>Sede</span><select name="sede_id">${S.sedes.map((s) => `<option value="${s.id}"${String(b.sede_id || P().sede_id) === String(s.id) ? ' selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select></label>` : ''}
            <label class="field"><span>Área</span><select name="area_id"><option value="">Sin área</option>${S.areas.map((a) => `<option value="${a.id}"${String(b.area_id || '') === String(a.id) ? ' selected' : ''}>${esc(a.nombre)}</option>`).join('')}</select></label>
            <label class="field"><span>Rol</span><select name="rol">${rolesCrear.map((r) => `<option value="${r}"${(b.rol || 'colaborador') === r ? ' selected' : ''}>${esc(ROLES[r])}${r === 'supervisor' ? ' (crea cuentas)' : ''}</option>`).join('')}</select>
              ${esAdmin() ? '' : '<small class="hint">Las cuentas de supervisores, directoras y gerentes las crea la administración.</small>'}</label>
          </div>
          <button class="btn" type="submit"${ocupado('crear')}>${ico('usuarioMas')}${S.ocupado === 'crear' ? 'Creando…' : 'Crear cuenta'}</button>
        </form>
      </section>`;
    const f = norm(E.filtro).trim();
    const lista = S.personas.filter((p) => !f || norm(p.nombre + ' ' + p.correo).includes(f));
    return encabezado('Cuentas', '<em>Equipo</em>', 'Crea cuentas, cambia sede, área o rol, da una contraseña nueva o desactiva a quien ya no trabaja aquí. Desactivar no borra su historial.')
      + clave + crear
      + `<section><div class="toolbar"><label class="search">${ico('buscar')}<input type="search" data-buscar="equipo" value="${esc(E.filtro)}" placeholder="Buscar por nombre o correo" aria-label="Buscar personas"></label><span class="hint">${plural(activas().length, 'cuenta activa', 'cuentas activas')}</span></div>
        <div class="tablewrap card flush"><table class="perm equipo"><thead><tr><th scope="col">Persona</th>${variasSedes() ? '<th scope="col">Sede</th>' : ''}<th scope="col">Área</th><th scope="col">Rol</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
          <tbody id="lista-equipo">${filasEquipo(lista)}</tbody></table></div></section>`;
  }

  function filasEquipo(lista) {
    const E = S.equipo;
    if (!lista.length) return `<tr><td colspan="6" class="vacio">Nadie coincide con la búsqueda.</td></tr>`;
    return lista.map((p) => {
      const puede = puedeTocarCuenta(p);
      const dis = puede ? '' : ' disabled';
      const sub = p.es_admin ? 'Administración' : p.rol === 'supervisor' ? 'Crea cuentas' : '';
      let acc;
      if (p.id === P().id) acc = '<span class="hint">Tu cuenta</span>';
      else if (!puede) acc = '<span class="hint">Solo administración</span>';
      else if (E.confirmar && E.confirmar.id === p.id) {
        const txt = E.confirmar.accion === 'restablecer' ? '¿Dar una contraseña nueva?' : E.confirmar.accion === 'desactivar' ? '¿Desactivar? No podrá entrar.' : '¿Reactivar la cuenta?';
        acc = `<span class="confirmar">${txt}<span><button type="button" class="btn sm${E.confirmar.accion === 'desactivar' ? ' danger' : ''}" data-confirmar="si"${ocupado('cuenta')}>Sí</button><button type="button" class="btn txt sm" data-confirmar="no">No</button></span></span>`;
      } else {
        acc = `<button type="button" class="btn ghost sm" data-restablecer="${p.id}">${ico('llave')}Nueva contraseña</button>
          <button type="button" class="btn txt sm" data-activar="${p.id}|${p.activo ? 'desactivar' : 'reactivar'}">${p.activo ? 'Desactivar' : 'Reactivar'}</button>`;
      }
      return `<tr class="${p.activo ? '' : 'inactiva'}">
          <th scope="row" class="persona"><span class="avatar sm">${esc(initials(p.nombre))}</span><span><b>${esc(p.nombre)}</b><small>${esc(p.correo)}</small></span></th>
          ${variasSedes() ? `<td><select data-perfil="${p.id}|sede_id" aria-label="Sede"${dis}>${S.sedes.map((s) => `<option value="${s.id}"${p.sede_id === s.id ? ' selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select></td>` : ''}
          <td><select data-perfil="${p.id}|area_id" aria-label="Área"${dis}><option value="">Sin área</option>${S.areas.map((a) => `<option value="${a.id}"${p.area_id === a.id ? ' selected' : ''}>${esc(a.nombre)}</option>`).join('')}</select></td>
          <td><select data-perfil="${p.id}|rol" aria-label="Rol"${esAdmin() && p.id !== P().id ? '' : ' disabled'}>${Object.keys(ROLES).map((r) => `<option value="${r}"${p.rol === r ? ' selected' : ''}>${esc(ROLES[r])}</option>`).join('')}</select>${sub ? `<small class="hint">${sub}</small>` : ''}</td>
          <td><span class="chip ${p.activo ? 'ok' : 'mute'}">${p.activo ? 'Activa' : 'Desactivada'}</span></td>
          <td class="td-acc">${acc}</td>
        </tr>`;
    }).join('');
  }

  async function crearCuenta() {
    const b = S.equipo.borrador;
    const nombre = String(b.nombre || '').trim(), correo = String(b.correo || '').trim().toLowerCase();
    if (!nombre || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) { toast('Escribe el nombre y un correo válido.', 'bad'); return; }
    const rol = esAdmin() ? b.rol || 'colaborador' : 'colaborador';
    const clave = claveTemporal();
    await accion('crear', async () => {
      await funcionCuentas({ accion: 'crear', correo, nombre, sede_id: +(b.sede_id || P().sede_id), area_id: b.area_id ? +b.area_id : null, rol, contrasena: clave });
      S.equipo.claveNueva = { nombre, correo, clave, nueva: true };
      S.equipo.borrador = {};
      await recargarPersonas();
      toast('Cuenta creada.');
    });
  }

  async function confirmarCuenta() {
    const c = S.equipo.confirmar;
    const p = persona(c.id);
    await accion('cuenta', async () => {
      if (c.accion === 'restablecer') {
        const clave = claveTemporal();
        await funcionCuentas({ accion: 'restablecer', id: p.id, contrasena: clave });
        S.equipo.claveNueva = { nombre: p.nombre, correo: p.correo, clave, nueva: false };
        toast('Contraseña nueva lista.');
      } else {
        await funcionCuentas({ accion: c.accion, id: p.id });
        await recargarPersonas();
        toast(c.accion === 'desactivar' ? 'Cuenta desactivada.' : 'Cuenta reactivada.');
      }
      S.equipo.confirmar = null;
    });
  }

  async function copiarTexto(txt) {
    try { await navigator.clipboard.writeText(txt); toast('Copiado. Pégalo en un mensaje privado.'); return; } catch (e) { /* respaldo abajo */ }
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    toast(ok ? 'Copiado. Pégalo en un mensaje privado.' : 'No se pudo copiar: selecciona el texto y cópialo a mano.', ok ? 'ok' : 'warn');
  }

  // ---------- Guía de uso (cada quien ve lo que le aplica) ----------
  function guiaView() {
    const t = tol();
    const ip = S.config.validar_ip && S.config.validar_ip.activo;
    const secciones = [
      { id: 'primera', titulo: 'Entrar la primera vez', ver: true, html: `<ol>
          <li>Entra con tu <b>correo corporativo</b> y la <b>contraseña temporal</b> que te dio la administración.</li>
          <li>La intranet te pide crear tu propia contraseña, de 8 caracteres o más.</li>
          <li>Lee y acepta la autorización de tratamiento de datos.</li>
        </ol><p>¿Olvidaste la contraseña? Pídele a la administración${S.personas.some((p) => p.rol === 'supervisor') ? ' o a un supervisor' : ''} una nueva. Para cambiarla cuando quieras, toca tu avatar y elige «Cambiar contraseña».</p>` },
      { id: 'marcar', titulo: 'Marcar la jornada', ver: true, html: `<p>En Inicio está tu <b>pase de jornada</b>. Tiene cuatro pasos y un solo botón grande con el que sigue:</p>
        <ul class="pasos-guia">${PASOS.map((x) => `<li><span class="leg-cod">${x.cod}</span>${x.nombre}</li>`).join('')}</ul>
        <ul>
          <li>La hora la pone el servidor: no importa la hora de tu celular o computador.</li>
          <li>Tienes <b>${t.entrada} minutos</b> de gracia en la entrada y <b>${t.almuerzo} minutos</b> en el almuerzo.</li>
          <li>Si tu turno no tiene almuerzo (por ejemplo, los sábados), solo marcas entrada y salida.</li>
          <li>Si hoy no almuerzas, usa «Hoy no almuerzo · marcar salida».</li>
          <li>Si tienes vacaciones, permiso o incapacidad aprobados, ese día no tienes que marcar.</li>
        </ul>` },
      { id: 'malla', titulo: 'Malla, comunicados y herramientas', ver: true, html: `<ul>
          <li><b>Malla:</b> el horario de cada persona por semana. Las celdas con borde de color son cambios puntuales de ese día.</li>
          <li><b>Comunicados:</b> avisos internos. Si piden confirmación, léelos y toca «Confirmar lectura». En Inicio aparece una franja si tienes alguno pendiente.</li>
          <li><b>Herramientas:</b> las tarjetas de Inicio abren el Gestor de reservas, Caminos Documentos y el Cotizador en una pestaña nueva.</li>
        </ul>` },
      { id: 'solicitudes', titulo: 'Vacaciones, permisos e incapacidades', ver: moduloSol() || esGerencia(), html: `<ul>
          <li>En «Solicitudes» elige el tipo, las fechas y, si es un permiso de unas horas, la hora de inicio y de fin.</li>
          <li>Puedes adjuntar la foto o el PDF del soporte (opcional). Las fotos se reducen solas.</li>
          <li>Mientras esté pendiente puedes cancelarla. Cuando la revisen verás quién la aprobó o rechazó y su comentario.</li>
        </ul>` },
      { id: 'supervisores', titulo: 'Para supervisores: cuentas y malla', ver: esSupervisor(), html: `<ul>
          <li>En «Equipo» creas cuentas de colaboradores. La contraseña temporal aparece una sola vez: cópiala y envíala por un canal privado.</li>
          <li>Puedes cambiar sede y área de colaboradores, darles una contraseña nueva o desactivarlos. Las demás cuentas son solo de la administración.</li>
          <li>En «Malla» editas la semana, el horario fijo y los turnos de todas las sedes.</li>
        </ul>` },
      { id: 'lideres', titulo: 'Para las líderes de sede', ver: esLider(), html: `<ul>
          <li><b>Malla:</b> carga una vez el <b>horario fijo</b> de cada persona; la malla de cada semana se llena sola. Para un día distinto (un festivo, un cambio) toca la celda en «Semana». «↺ Volver al horario fijo» deshace el cambio.</li>
          <li><b>Turnos:</b> son las franjas de horario. Si cambias sus horas, cambian para todas las personas que lo tienen, también hacia atrás en los informes.</li>
          <li><b>Asistencia:</b> quién está trabajando hoy comparado con la malla. Toca «Actualizar» para ver lo último.</li>
          <li><b>Informes:</b> puntualidad del mes, llegadas tarde por día, quién llegó más tarde y detalle por persona. «Exportar a Excel» descarga la tabla.</li>
          <li><b>Comunicados:</b> publica avisos con imágenes y mira quién confirmó y quién falta.</li>
        </ul>` },
      { id: 'gerencia', titulo: 'Para la gerencia y la administración', ver: esGerencia(), html: `<ul>
          <li>En «Solicitudes» activas o apagas el módulo y decides quién revisa cada tipo. Apagarlo no borra nada.</li>
          <li>Las herramientas de Inicio, las tolerancias y la meta de puntualidad se cambian en la base de datos, sin programar.</li>
          ${esAdmin() ? '<li><b>Administración:</b> en «Equipo» creas cuentas de cualquier rol, asignas roles y desactivas cuentas. Asigna «Supervisor» a quien administrará cuentas y horarios sin darle poderes de gerencia.</li>' : ''}
        </ul>` },
      { id: 'faq', titulo: 'Preguntas frecuentes', ver: true, html: `<dl class="faq">
          <dt>¿Puedo marcar desde el celular?</dt><dd>${ip ? 'Solo si estás conectada a la red de la oficina. Desde datos móviles o desde otra red, la intranet no deja marcar.' : 'Sí, desde cualquier dispositivo. La hora la pone el servidor.'}</dd>
          <dt>Me equivoqué al marcar.</dt><dd>Avísale a la líder de tu sede para que lo revise.</dd>
          <dt>No veo los cambios nuevos.</dt><dd>Recarga la página con Ctrl+F5 (en el celular, cierra y abre la pestaña).</dd>
          <dt>Dice «No hay conexión con el servidor».</dt><dd>Prueba en una ventana de incógnito u otro navegador. Si sigue igual, puede que la red o un antivirus estén bloqueando la intranet.</dd>
        </dl>` },
    ].filter((s) => s.ver);
    return encabezado('Ayuda', 'Guía <em>de uso</em>', 'Lo que necesitas saber según tu rol.')
      + `<div class="guia">
          <nav class="guia-indice" aria-label="Secciones de la guía">${secciones.map((s) => `<button type="button" data-guia="${s.id}">${esc(s.titulo)}</button>`).join('')}</nav>
          <div class="guia-texto">${secciones.map((s) => `<section class="card" id="guia-${s.id}"><h2>${esc(s.titulo)}</h2>${s.html}</section>`).join('')}</div>
        </div>`;
  }

  // ---------- Navegación ----------
  const CARGAS = {
    inicio: cargarInicio, malla: cargarMalla, comunicados: cargarComunicados, asistencia: cargarAsistencia,
    informes: cargarInforme, solicitudes: cargarSolicitudes, equipo: recargarPersonas,
  };
  let navegacion = 0;
  async function ir(view) {
    if (!puedeVer(view)) view = 'inicio';
    const yo = ++navegacion;
    S.view = view;
    S.menu = false;
    S.errorVista = '';
    S.cargandoVista = true;
    render();
    let error = '';
    try {
      if (CARGAS[view]) await CARGAS[view]();
    } catch (e) {
      error = errorTexto(e);
    }
    if (yo !== navegacion) return; // otra pestaña se pidió mientras tanto
    S.errorVista = error;
    S.cargandoVista = false;
    render();
    window.scrollTo(0, 0);
    try { history.replaceState(null, '', '#' + view); } catch (e) { /* nada */ }
  }

  function abrirLightbox(titulo, items, i) {
    S.lb = { titulo, items, i };
    render();
  }

  // ---------- Eventos ----------
  const ACCIONES = '[data-view],[data-accion],[data-marcar],[data-semana],[data-mvista],[data-editar],[data-leer],[data-comf],[data-borrarcom],[data-lb],[data-lbmover],[data-quitarimg],[data-revisar],[data-cancelarsol],[data-lbsol],[data-quitarsop],[data-revquitar],[data-selinf],[data-orden],[data-restablecer],[data-activar],[data-copiar],[data-guia],[data-soltipo],[data-confirmar],[data-demo]';

  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest(ACCIONES);
    if (S.menu && !ev.target.closest('.menu')) {
      S.menu = false;
      if (!el) { render(); return; }
    }
    if (S.lb && ev.target.classList && ev.target.classList.contains('lightbox')) { S.lb = null; render(); return; }
    if (!el) return;
    const d = el.dataset;
    if (el.tagName === 'A' && d.view) ev.preventDefault();

    if (d.view) {
      const idCom = d.irCom;
      await ir(d.view);
      if (idCom) { const n = document.getElementById('com-' + idCom); if (n) n.scrollIntoView({ block: 'center' }); }
      return;
    }
    if (d.demo) { S.correoLogin = d.demo; S.error = ''; foco = 'input[name=clave]'; render(); return; }
    if (d.accion) {
      switch (d.accion) {
        case 'menu': S.menu = !S.menu; render(); return;
        case 'recargar': location.reload(); return;
        case 'salir': await salir(); return;
        case 'cambiarClave': S.menu = false; S.claveVoluntaria = true; S.error = ''; S.pantalla = 'clave'; foco = 'input[name=clave]'; render(); return;
        case 'cancelarClave': S.claveVoluntaria = false; S.error = ''; S.pantalla = 'app'; render(); return;
        case 'aceptarDatos': {
          let aceptado = false;
          await accion('datos', async () => {
            await q(sb.rpc('aceptar_datos'));
            S.perfil.acepto_datos = new Date().toISOString();
            aceptado = true;
          });
          if (aceptado) await entrarApp();
          return;
        }
        case 'recargarAsistencia': await accion('asis', cargarAsistencia); return;
        case 'exportar': exportarInforme(); return;
        case 'agregarTurno': await accion('turno', agregarTurno); return;
        case 'lbCerrar': S.lb = null; render(); return;
        case 'cerrarClave': S.equipo.claveNueva = null; render(); return;
        case 'moduloSol':
          await accion('modulo', async () => {
            const valor = { activo: !moduloSol() };
            await q(sb.from('configuracion').upsert({ clave: 'modulo_solicitudes', valor, actualizado: new Date().toISOString() }, { onConflict: 'clave' }));
            S.config.modulo_solicitudes = valor;
            toast(valor.activo ? 'Solicitudes activadas.' : 'Solicitudes apagadas.');
          });
          return;
        case 'revAgregar': {
          const sel = document.getElementById('rev-nuevo');
          if (!sel || !sel.value) return;
          await accion('rev', async () => {
            await q(sb.from('revisores').insert({ persona_id: sel.value, sede_id: null, tipos: TODOS_TIPOS.slice(), nivel: 'aprobar' }));
            await cargarSolicitudes();
            toast(`${nombreDe(sel.value)} ya puede revisar solicitudes.`);
          });
          return;
        }
        default: return;
      }
    }
    if (d.marcar) {
      const tipo = d.marcar;
      await accion('marcar', async () => {
        await q(sb.rpc('marcar', { p_tipo: tipo }));
        await cargarInicio();
        toast(`${PASOS.find((x) => x.tipo === tipo).nombre} marcada a las ${hhmm(horaEn(miTz()))}.`);
      });
      return;
    }
    if (d.semana) {
      const n = +d.semana;
      const nuevo = n === 0 ? lunesDe(fechaEn(miTz())) : sumarDias(S.malla.lunes, n);
      await accion('semana', async () => {
        const antes = S.malla.lunes;
        S.malla.lunes = nuevo;
        S.malla.edit = null;
        try { await cargarMalla(); } catch (e) { S.malla.lunes = antes; throw e; }
      });
      return;
    }
    if (d.mvista) { S.malla.vista = d.mvista; S.malla.edit = null; render(); return; }
    if (d.editar) { S.malla.edit = d.editar; render(); return; }
    if (d.leer) {
      const id = +d.leer;
      await accion('leer' + id, async () => {
        await q(sb.from('comunicado_lecturas').insert({ comunicado_id: id, persona_id: P().id }));
        S.com.lect.push({ comunicado_id: id, persona_id: P().id, leido_en: new Date().toISOString() });
        toast('Lectura confirmada.');
      });
      return;
    }
    if (d.comf) {
      if (d.comf === 'todos' || d.comf === 'pendientes') S.com.filtro = d.comf;
      else if (d.comf === 'cancelar') S.com.borrar = null;
      else if (d.comf.startsWith('borrar:')) S.com.borrar = +d.comf.slice(7);
      render();
      return;
    }
    if (d.borrarcom) {
      const id = +d.borrarcom;
      await accion('borrar', async () => {
        const imgs = S.com.imgs.filter((i) => i.comunicado_id === id).map((i) => i.ruta);
        if (imgs.length) await sb.storage.from('comunicados').remove(imgs);
        await q(sb.from('comunicados').delete().eq('id', id));
        S.com.borrar = null;
        await cargarComunicados();
        toast('Comunicado eliminado.');
      });
      return;
    }
    if (d.lb) {
      const [cid, i] = d.lb.split('|').map(Number);
      const c = S.com.lista.find((x) => x.id === cid);
      abrirLightbox(c ? c.titulo : 'Imágenes', S.com.imgs.filter((x) => x.comunicado_id === cid), i);
      return;
    }
    if (d.lbsol) {
      const [sid, i] = d.lbsol.split('|').map(Number);
      const items = S.sol.adj.filter((x) => x.solicitud_id === sid).map((a) => ({ ...a, tipo: a.tipo_mime }));
      abrirLightbox('Soportes', items, i);
      return;
    }
    if (d.lbmover) { const L = S.lb; L.i = (L.i + +d.lbmover + L.items.length) % L.items.length; render(); return; }
    if (d.quitarimg) { const [x] = S.com.archivos.splice(+d.quitarimg, 1); if (x) URL.revokeObjectURL(x.url); render(); return; }
    if (d.quitarsop) { S.sol.archivos.splice(+d.quitarsop, 1); render(); return; }
    if (d.soltipo) { S.sol.tipo = d.soltipo; render(); return; }
    if (d.cancelarsol) {
      const v = d.cancelarsol;
      if (v === 'no') { S.sol.cancelar = null; render(); return; }
      if (v.startsWith('pedir:')) { S.sol.cancelar = +v.slice(6); render(); return; }
      await accion('cancelar', async () => {
        const id = +v;
        const rutas = S.sol.adj.filter((a) => a.solicitud_id === id).map((a) => a.ruta);
        if (rutas.length) await sb.storage.from('soportes').remove(rutas);
        await q(sb.from('solicitudes').delete().eq('id', id));
        S.sol.cancelar = null;
        await cargarSolicitudes();
        toast('Solicitud cancelada.');
      });
      return;
    }
    if (d.revisar) {
      const [id, ap] = d.revisar.split('|');
      await accion('rev' + id, async () => {
        await q(sb.rpc('revisar_solicitud', { p_id: +id, p_aprobar: ap === '1', p_comentario: S.sol.coment[id] || null }));
        delete S.sol.coment[id];
        await cargarSolicitudes();
        toast(ap === '1' ? 'Solicitud aprobada.' : 'Solicitud rechazada.');
      });
      return;
    }
    if (d.revquitar) {
      await accion('rev', async () => {
        await q(sb.from('revisores').delete().eq('persona_id', d.revquitar));
        await cargarSolicitudes();
        toast('Acceso quitado.');
      });
      return;
    }
    if (d.selinf !== undefined) { S.inf.sel = d.selinf || null; render(); return; }
    if (d.orden) {
      const o = S.inf.orden;
      if (o.col === d.orden) o.asc = !o.asc; else { o.col = d.orden; o.asc = d.orden === 'nombre'; }
      render();
      return;
    }
    if (d.restablecer) { S.equipo.confirmar = { id: d.restablecer, accion: 'restablecer' }; render(); return; }
    if (d.activar) { const [id, a] = d.activar.split('|'); S.equipo.confirmar = { id, accion: a }; render(); return; }
    if (d.confirmar) {
      if (d.confirmar === 'no') { S.equipo.confirmar = null; render(); return; }
      await confirmarCuenta();
      return;
    }
    if (d.copiar) {
      const c = S.equipo.claveNueva;
      if (c) await copiarTexto(`${MARCA.textoClave}\n${location.origin}${location.pathname}\nUsuario: ${c.correo}\nContraseña temporal: ${c.clave}\nAl entrar, crea tu propia contraseña.`);
      return;
    }
    if (d.guia) { const n = document.getElementById('guia-' + d.guia); if (n) n.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });

  document.addEventListener('submit', async (ev) => {
    const f = ev.target.closest('form[data-form]');
    if (!f) return;
    ev.preventDefault();
    const tipo = f.dataset.form;
    if (tipo === 'login') {
      const correo = f.correo.value.trim().toLowerCase(), clave = f.clave.value;
      S.correoLogin = correo;
      if (!correo || !clave) { S.error = 'Escribe tu correo y tu contraseña.'; foco = correo ? 'input[name=clave]' : 'input[name=correo]'; render(); return; }
      S.error = '';
      S.ocupado = 'login';
      render();
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
        if (error) throw error;
        S.ocupado = '';
        await cargarUsuario(data.user);
      } catch (e) {
        S.ocupado = '';
        S.error = errorTexto(e);
        foco = 'input[name=clave]';
        render();
      }
      return;
    }
    if (tipo === 'clave') {
      const a = f.clave.value, b = f.clave2.value;
      if (a.length < 8) { S.error = 'La contraseña debe tener 8 caracteres o más.'; foco = 'input[name=clave]'; render(); return; }
      if (a !== b) { S.error = 'Las dos contraseñas no coinciden.'; foco = 'input[name=clave2]'; render(); return; }
      S.error = '';
      S.ocupado = 'clave';
      render();
      try {
        const { data, error } = await sb.auth.updateUser({ password: a, data: { debe_cambiar_contrasena: false } });
        if (error) throw error;
        S.usuario = (data && data.user) || S.usuario;
        S.ocupado = '';
        if (S.claveVoluntaria) { S.claveVoluntaria = false; S.pantalla = 'app'; render(); toast('Contraseña actualizada.'); return; }
        if (!S.perfil.acepto_datos) { S.pantalla = 'datos'; render(); return; }
        await entrarApp();
      } catch (e) {
        S.ocupado = '';
        S.error = errorTexto(e);
        render();
      }
      return;
    }
    if (tipo === 'com') { await publicarComunicado(f); return; }
    if (tipo === 'sol') { await enviarSolicitud(); return; }
    if (tipo === 'cuenta') { await crearCuenta(); }
  });

  // Borradores: lo escrito sobrevive a cada render
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset && el.dataset.buscar) {
      if (el.dataset.buscar === 'com') { S.com.q = el.value; const l = document.getElementById('lista-com'); if (l) l.innerHTML = listaComunicados(); }
      if (el.dataset.buscar === 'equipo') {
        S.equipo.filtro = el.value;
        const f = norm(el.value).trim();
        const l = document.getElementById('lista-equipo');
        if (l) l.innerHTML = filasEquipo(S.personas.filter((p) => !f || norm(p.nombre + ' ' + p.correo).includes(f)));
      }
      return;
    }
    if (el.dataset && el.dataset.coment) { S.sol.coment[el.dataset.coment] = el.value; return; }
    const form = el.closest && el.closest('form[data-borrador]');
    if (form && el.name) {
      const k = form.dataset.borrador;
      const b = k === 'com' ? S.com.borrador : k === 'sol' ? S.sol.borrador : S.equipo.borrador;
      b[el.name] = el.type === 'checkbox' ? el.checked : el.value;
      if (k === 'com' && el.name === 'titulo') { const h = el.parentElement.querySelector('.hint'); if (h) h.textContent = `${el.value.length}/140`; }
    }
  });

  document.addEventListener('change', async (ev) => {
    const el = ev.target, d = el.dataset || {};
    const form = el.closest && el.closest('form[data-borrador]');
    if (form && el.name && (el.tagName === 'SELECT' || el.type === 'checkbox')) {
      const k = form.dataset.borrador;
      const b = k === 'com' ? S.com.borrador : k === 'sol' ? S.sol.borrador : S.equipo.borrador;
      b[el.name] = el.type === 'checkbox' ? el.checked : el.value;
      if (k === 'com' && el.name === 'destino') render();
      return;
    }
    if (d.celda) { if (el.value) await guardarCelda(d.celda, el.value); return; }
    if (d.msede) { S.malla.sede = el.value; render(); return; }
    if (d.tsede) { S.turnoSede = +el.value; render(); return; }
    if (d.asede) { S.asisSede = el.value; render(); return; }
    if (d.inf) {
      S.inf[d.inf] = el.value;
      if (d.inf === 'mes') {
        S.inf.sel = null;
        S.inf.datos = null;
        render();
        try { await cargarInforme(); } catch (e) { S.errorVista = errorTexto(e); }
        render();
      } else render();
      return;
    }
    if (d.archivos === 'com') {
      [...el.files].forEach((file) => S.com.archivos.push({ file, url: URL.createObjectURL(file) }));
      render();
      return;
    }
    if (d.archivos === 'sol') { S.sol.archivos.push(...el.files); render(); return; }
    if (d.perfil) {
      const [id, campo] = d.perfil.split('|');
      const v = campo === 'rol' ? el.value : el.value ? +el.value : null;
      await accion('perfil', async () => {
        await q(sb.from('perfiles').update({ [campo]: v }).eq('id', id));
        await recargarPersonas();
        if (id === P().id) S.perfil = persona(id);
        toast('Cambio guardado.');
      });
      return;
    }
    if (d.rev) {
      const [pid, campo] = d.rev.split('|');
      const v = campo === 'sede_id' ? (el.value ? +el.value : null) : el.value;
      await accion('rev', async () => {
        await q(sb.from('revisores').update({ [campo]: v }).eq('persona_id', pid));
        await cargarSolicitudes();
        toast('Acceso actualizado.');
      });
      return;
    }
    if (d.revtipo) {
      const [pid, tipo] = d.revtipo.split('|');
      const r = S.revisores.find((x) => x.persona_id === pid);
      const tipos = el.checked ? [...new Set(r.tipos.concat(tipo))] : r.tipos.filter((t) => t !== tipo);
      if (!tipos.length) { el.checked = true; toast('Deja al menos un tipo, o quita el acceso.', 'warn'); return; }
      await accion('rev', async () => {
        await q(sb.from('revisores').update({ tipos }).eq('persona_id', pid));
        await cargarSolicitudes();
        toast('Acceso actualizado.');
      });
    }
  });

  // Celdas de la malla y campos de turnos: se resuelven al salir
  document.addEventListener('focusout', (ev) => {
    const el = ev.target, d = el.dataset || {};
    if (d.turno) {
      const [id, campo] = d.turno.split('|');
      guardarTurno(id, campo, el.value);
      return;
    }
    if (d.celda) {
      const id = d.celda;
      setTimeout(() => {
        if (S.malla.edit === id && !S.malla.guardando) { S.malla.edit = null; render(); }
      }, 150);
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (S.lb) { S.lb = null; render(); return; }
      if (S.menu) { S.menu = false; render(); const a = document.querySelector('.avatar'); if (a) a.focus(); return; }
      if (S.malla.edit) { S.malla.edit = null; render(); return; }
    }
    if (S.lb && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
      const L = S.lb;
      L.i = (L.i + (ev.key === 'ArrowLeft' ? -1 : 1) + L.items.length) % L.items.length;
      render();
    }
  });

  // Tooltip de la gráfica de informes
  document.addEventListener('mousemove', (ev) => {
    const tip = document.getElementById('tip');
    if (!tip) return;
    const r = ev.target.closest && ev.target.closest('[data-dia]');
    if (!r) { tip.hidden = true; return; }
    const dia = r.dataset.dia;
    const { porDia } = calcularInformeCache();
    const lista = porDia[dia] || [];
    tip.innerHTML = `<b>${esc(fechaLarga(dia))}</b>${lista.length ? lista.map((x) => `<span>${esc(x.nombre)} · ${x.min} min</span>`).join('') : '<span>Nadie llegó tarde</span>'}`;
    const box = tip.parentElement.getBoundingClientRect();
    tip.hidden = false;
    const x = Math.min(ev.clientX - box.left + 12, box.width - tip.offsetWidth - 4);
    tip.style.left = Math.max(4, x) + 'px';
    tip.style.top = Math.max(4, ev.clientY - box.top - tip.offsetHeight - 10) + 'px';
  });
  let cacheInf = { clave: '', valor: null };
  function calcularInformeCache() {
    const I = S.inf, k = [I.mes, I.sede, I.area, I.datos && I.datos.marcas.length].join('|');
    if (cacheInf.clave !== k) cacheInf = { clave: k, valor: calcularInforme() };
    return cacheInf.valor;
  }

  // ---------- Reloj y sesión ----------
  setInterval(() => {
    const c = document.getElementById('clock');
    if (c && S.perfil) c.textContent = segEn(miTz());
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisarVersion(); });
  if (sb) sb.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT' && S.pantalla !== 'login') reiniciar();
  });

  arrancar();
})();
