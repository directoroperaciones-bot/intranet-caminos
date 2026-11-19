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
  // El enlace de recuperación llega con los datos en el #: se leen antes de que supabase-js los consuma.
  const ENLACE = (function () {
    const h = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    return { recuperar: h.get('type') === 'recovery', error: h.get('error_code') || h.get('error') || '' };
  })();
  const sb = window.supabase && !SIN_CONFIGURAR ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { flowType: 'implicit' } }) : null;
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
    // Texto de autorización (Ley 1581 de 2012). Conviene que lo revise un asesor legal.
    datosPendiente: false,
    datos: [
      'En cumplimiento de la Ley 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y demás normas sobre protección de datos personales, autorizo de manera previa, expresa e informada a Caminos, agencia de viajes con domicilio en la Calle 79 # 16a-20, Oficina 507, Bogotá, como responsable del tratamiento, para recolectar, almacenar, usar, consultar, actualizar y suprimir los datos personales que entrego o que se generan con el uso de esta intranet.',
      'Datos que se tratan: nombre, correo corporativo, área, sede, rol, horario y turnos asignados, registros de entrada, almuerzo y salida (fecha, hora y dirección IP desde la que se marca), confirmaciones de lectura de comunicados, y solicitudes de vacaciones, permisos e incapacidades con sus soportes.',
      'Finalidades: administrar la jornada laboral, la asistencia y la puntualidad; programar horarios; enviar comunicados internos; tramitar vacaciones, permisos e incapacidades; generar informes para la gerencia, y cumplir las obligaciones laborales y legales de la agencia. Los datos no se usan con fines comerciales ni se venden a terceros.',
      'Datos sensibles: los soportes de incapacidad pueden contener información de salud, que la ley considera sensible. No estoy obligado(a) a entregarla ni a autorizar su tratamiento; si la entrego, solo la consultan la gerencia y las personas que ella designe para revisar incapacidades, y únicamente para tramitar la novedad.',
      'Almacenamiento: la información se guarda en servidores de Supabase, proveedor tecnológico ubicado en Estados Unidos, que actúa como encargado del tratamiento con acceso restringido y conexión cifrada. Autorizo esta transmisión internacional de datos para las finalidades descritas. Los datos se conservan mientras dure la relación laboral y durante el tiempo que exijan las normas laborales, contables y tributarias.',
      'Mis derechos: conocer, actualizar y rectificar mis datos; pedir prueba de esta autorización; saber qué uso se les ha dado; revocar la autorización o pedir la supresión cuando no exista un deber legal o contractual de conservarlos, y presentar quejas ante la Superintendencia de Industria y Comercio. Las consultas se responden en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles.',
      'Para ejercerlos puedo escribir a directoroperaciones@agenciacaminos.com.co o dirigirme a la gerencia de Caminos en la dirección indicada. Al tocar «Acepto» declaro que leí esta autorización y que la otorgo de forma libre; la intranet guarda la fecha en que la acepté.',
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
    lapiz: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    globo: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    iglesia: '<path d="M10 9h4"/><path d="M12 7v5"/><path d="M14 22v-4a2 2 0 0 0-4 0v4"/><path d="M18 22V5.618a1 1 0 0 0-.553-.894l-4.553-2.277a2 2 0 0 0-1.788 0L6.553 4.724A1 1 0 0 0 6 5.618V22"/><path d="m18 7 3.447 1.724a1 1 0 0 1 .553.894V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.618a1 1 0 0 1 .553-.894L6 7"/>',
    correo: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    tarjeta: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    escudo: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
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
    ofi: { ip: null, equipos: [], sede: null, quitar: null, nombre: '' },
    tc: { tarjetas: [], categorias: [], grupos: [], extractos: [], movs: [], regs: [], cruzados: new Map(), urls: {}, informe: null, envios: [], tarjeta: null, extracto: null, pestana: 'banco', filtro: 'todos', q: '', paso: 'gastos', mes: '', gastos: [], gastosCruces: new Map(), filtroG: 'todos', archivoUrl: null,
      abierto: null, borrador: {}, importar: { texto: '', filas: null, mapa: {}, cab: [] }, archivoRegistro: null, confirmar: null, borrar: null, vivo: false, actualizado: null },
    via: null, navUltima: {}, ajuste: null,
    pantalla: 'cargando', error: '', correoLogin: '', claveVoluntaria: false, ocupado: '', recuperacion: false, olvido: { enviado: false, correo: '' },
    usuario: null, perfil: null, sedes: [], areas: [], turnos: [], herramientas: [], personas: [], config: {}, revisores: [],
    view: 'inicio', menu: false, cargandoVista: false, errorVista: '',
    hoy: null,
    malla: { lunes: '', sede: 'todas', vista: 'semana', filas: [], base: [], rot: [], edit: null, guardando: false },
    turnoSede: null,
    asistencia: null, asisSede: 'todas',
    equipo: { claveNueva: null, filtro: '', confirmar: null, borrador: {} },
    inf: { rango: '', desde: '', hasta: '', sede: 'todas', area: 'todas', orden: { col: 'minTarde', asc: false }, sel: null, datos: null },
    com: { lista: [], imgs: [], lect: [], filtro: 'todos', q: '', borrador: { confirmar: true }, archivos: [], borrar: null },
    lb: null,
    sol: { lista: [], adj: [], tipo: 'vacaciones', borrador: {}, archivos: [], cancelar: null, coment: {} },
    grupos: { lista: [], vista: 'tablero', parroquia: '', mes: '', abierto: null, borrador: {}, borrar: null, clave: null },
    ges: { filas: [], estado: null, mes: '', f: {}, medida: 'valor', detalle: false, orden: { col: 'fecha', asc: false }, clave: null, vivo: false, cargado: null, cc: { datos: null, abierto: false, cliente: '', desde: '', hasta: '', quitadas: new Set(), confirmar: null } },
  };

  // ---------- Permisos de interfaz (solo muestran u ocultan) ----------
  const P = () => S.perfil || {};
  const esAdmin = () => !!P().es_admin;
  const esGerencia = () => P().rol === 'gerente'; // solo el cargo de gerente ve todo
  const esLider = () => esGerencia() || P().rol === 'directora';
  const lideraSede = (s) => esGerencia() || (P().rol === 'directora' && P().sede_id === s);
  const esSupervisor = () => P().rol === 'supervisor';
  const editaMalla = (s) => lideraSede(s) || esSupervisor();
  const gestionaCuentas = () => esAdmin() || esSupervisor();
  const puedeTocarCuenta = (p) => p.id !== P().id && (esAdmin() || (esSupervisor() && p.rol === 'colaborador' && !p.es_admin));
  const puedePublicar = () => esLider();
  const ROLES = { colaborador: 'Colaborador', supervisor: 'Supervisor', directora: 'Dirección de operaciones', gerente: 'Gerente' };
  const tol = () => {
    const t = S.config.tolerancias || {};
    const n = (v, d) => (v == null ? d : +v);
    return { entrada: n(t.entrada_min, 5), almuerzo: n(t.almuerzo_min, 5), salida: n(t.salida_min, 5), temprano: n(t.temprano_min, 30) };
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
  const validarIp = () => !!(S.config.validar_ip && S.config.validar_ip.activo);
  const validarEquipo = () => !!(S.config.validar_equipo && S.config.validar_equipo.activo);
  // Llave del computador autorizado: vive en este navegador (en la base solo queda su huella)
  const LLAVE_EQUIPO = 'caminos-intranet-equipo';
  function equipoLocal() {
    try { const v = JSON.parse(localStorage.getItem(LLAVE_EQUIPO) || 'null'); return v && v.llave ? v : null; } catch (e) { return null; }
  }
  function guardarEquipoLocal(v) {
    try {
      if (v) localStorage.setItem(LLAVE_EQUIPO, JSON.stringify(v)); else localStorage.removeItem(LLAVE_EQUIPO);
      return !v || (equipoLocal() || {}).llave === v.llave;
    } catch (e) { return false; }
  }
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
    if (/should be different/i.test(m)) return 'La contraseña nueva debe ser distinta de la anterior.';
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
    refrescarFichaGrupo();
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
      case 'olvido': return olvidoView();
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
      if (ENLACE.recuperar || ENLACE.error) limpiarEnlace();
      if (ENLACE.recuperar && data && data.session) { S.recuperacion = true; await cargarUsuario(data.session.user); return; }
      if (!data || !data.session) {
        if (ENLACE.error) { S.pantalla = 'olvido'; S.olvido = { enviado: false, correo: S.correoLogin || '' }; S.error = 'El enlace venció o ya se usó. Pide uno nuevo.'; render(); return; }
        S.pantalla = 'login'; render(); return;
      }
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
    if (!perfil || !perfil.activo) {
      // ¿Es una cuenta del portal de clientes? Entonces se le indica su portal.
      try { S.esCliente = !perfil && !!(await q(sb.rpc('mi_cuenta_cliente'))); } catch (e) { S.esCliente = false; }
      S.pantalla = 'sinperfil'; render(); return;
    }
    S.perfil = perfil;
    if (S.recuperacion) { S.pantalla = 'clave'; foco = 'input[name=clave]'; render(); return; }
    if (user.user_metadata && user.user_metadata.debe_cambiar_contrasena) { S.pantalla = 'clave'; foco = 'input[name=clave]'; render(); return; }
    if (!perfil.acepto_datos) { S.pantalla = 'datos'; render(); return; }
    await entrarApp();
  }

  async function entrarApp() {
    if (!S.via) S.via = viaEstado();
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
      if (S.view !== 'viaticos') await cargarViaticos().catch(() => {});
      render();
    } catch (e) { /* las insignias no son críticas */ }
  }

  async function salir() {
    try { await sb.auth.signOut(); } catch (e) { /* igual se limpia */ }
    reiniciar();
  }
  function limpiarEnlace() {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* nada */ }
  }
  function reiniciar() {
    soltarTarjeta();
    soltarGestion();
    S.ges = { filas: [], estado: null, mes: '', f: {}, medida: 'valor', detalle: false, orden: { col: 'fecha', asc: false }, clave: null, vivo: false, cargado: null, cc: { datos: null, abierto: false, cliente: '', desde: '', hasta: '', quitadas: new Set(), confirmar: null } };
    S.tc = Object.assign(S.tc, { tarjetas: [], extractos: [], movs: [], regs: [], gastos: [], tarjeta: null, extracto: null, abierto: null, borrador: {}, confirmar: null, borrar: null, vivo: false, paso: 'gastos', mes: '', filtroG: 'todos', archivoRegistro: null, archivoUrl: null, urls: {}, informe: null, envios: [] });
    Object.assign(S, {
      pantalla: 'login', error: '', recuperacion: false, olvido: { enviado: false, correo: '' }, usuario: null, perfil: null, view: 'inicio', menu: false, hoy: null, asistencia: null, lb: null,
      malla: { lunes: '', sede: 'todas', vista: 'semana', filas: [], base: [], rot: [], edit: null, guardando: false },
      com: { lista: [], imgs: [], lect: [], filtro: 'todos', q: '', borrador: { confirmar: true }, archivos: [], borrar: null },
      sol: { lista: [], adj: [], tipo: 'vacaciones', borrador: {}, archivos: [], cancelar: null, coment: {} },
      equipo: { claveNueva: null, filtro: '', confirmar: null, borrador: {} },
      inf: { rango: '', desde: '', hasta: '', sede: 'todas', area: 'todas', orden: { col: 'minTarde', asc: false }, sel: null, datos: null },
      via: viaEstado(), navUltima: {}, ajuste: null,
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
        <p class="hint">Personas y datos ficticios: nada de lo que hagas aquí se guarda, al recargar todo vuelve a empezar. Toca una cuenta para entrar directo con ese rol. Si prefieres escribir, la contraseña de todas es <b>${esc(CFG.demo.clave || '')}</b>.</p>
        <div class="demo-lista">${CFG.demo.cuentas.map((c) => `<button type="button" class="demo-cta" data-demo="${esc(c.correo)}"${S.ocupado ? ' disabled' : ''}><b>${esc(c.rol)}</b><span>${esc(c.nombre)} · Entrar</span></button>`).join('')}</div>
      </div>` : '';
    return marcoAcceso(`${demo}<form class="card login-card" data-form="login" novalidate>
        <span class="eyebrow">Ingresar</span>
        <h2>Entra a la intranet</h2>
        <label class="field"><span>Correo corporativo</span>
          <input name="correo" type="email" autocomplete="username" inputmode="email" placeholder="${esc(MARCA.correoEjemplo)}" value="${esc(S.correoLogin)}" required></label>
        <label class="field"><span>Contraseña</span>
          <input name="clave" type="password" autocomplete="current-password" required></label>
        ${S.error ? `<p class="err" role="alert">${ico('alerta')}${esc(S.error)}</p>` : ''}
        <button class="btn block" type="submit"${ocupado('login')}>${S.ocupado === 'login' ? 'Entrando…' : 'Entrar'}</button>
        <button class="btn txt block" type="button" data-accion="olvido">¿Olvidaste tu contraseña?</button>
        ${CFG.demo ? '' : '<p class="hint">¿Aún no tienes cuenta? Mira cómo funciona en la <a href="pruebas/demo.html">demostración</a>.</p>'}
      </form>`);
  }

  function olvidoView() {
    const O = S.olvido;
    if (O.enviado) {
      return marcoAcceso(`<div class="card login-card">
        <span class="eyebrow">Recuperar contraseña</span>
        <h2>Revisa tu correo</h2>
        <p class="hint">Si <b>${esc(O.correo)}</b> tiene una cuenta activa en la intranet, en unos minutos te llega un correo de ${esc(MARCA.nombre)} con un enlace para crear una contraseña nueva.</p>
        <p class="hint">El enlace sirve una sola vez y vence en 1 hora. Si no lo ves, revisa la carpeta de spam o de promociones.</p>
        ${CFG.demo ? '<button class="btn block" type="button" data-accion="abrirEnlaceDemo">Demostración: abrir el enlace del correo</button>' : ''}
        <button class="btn ${CFG.demo ? 'txt' : ''} block" type="button" data-accion="volverLogin">Volver a ingresar</button>
      </div>`);
    }
    return marcoAcceso(`<form class="card login-card" data-form="olvido" novalidate>
        <span class="eyebrow">Recuperar contraseña</span>
        <h2>¿Olvidaste tu contraseña?</h2>
        <p class="hint">Escribe tu correo corporativo y te enviamos un enlace seguro para crear una nueva.</p>
        <label class="field"><span>Correo corporativo</span>
          <input name="correo" type="email" autocomplete="username" inputmode="email" placeholder="${esc(MARCA.correoEjemplo)}" value="${esc(O.correo)}" required></label>
        ${S.error ? `<p class="err" role="alert">${ico('alerta')}${esc(S.error)}</p>` : ''}
        <button class="btn block" type="submit"${ocupado('olvido')}>${S.ocupado === 'olvido' ? 'Enviando…' : 'Enviarme el enlace'}</button>
        <button class="btn txt block" type="button" data-accion="volverLogin">Volver a ingresar</button>
      </form>`);
  }

  function claveView() {
    const voluntaria = S.claveVoluntaria, recuperacion = S.recuperacion;
    const saludo = `Hola, ${esc(primerNombre(P().nombre))}.`;
    return marcoAcceso(`<form class="card login-card" data-form="clave" novalidate>
        <span class="eyebrow">${recuperacion ? 'Recuperar contraseña' : voluntaria ? 'Tu cuenta' : 'Primer ingreso'}</span>
        <h2>${voluntaria ? 'Cambia tu contraseña' : recuperacion ? 'Crea una contraseña nueva' : 'Crea tu contraseña'}</h2>
        <p class="hint">${voluntaria ? 'Escribe la contraseña nueva dos veces.' : recuperacion ? `${saludo} Escribe tu contraseña nueva dos veces: 8 caracteres o más.` : `${saludo} La contraseña temporal solo sirve una vez: crea una propia de 8 caracteres o más.`}</p>
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
    if (S.esCliente) {
      return marcoAcceso(`<div class="card login-card">
        <span class="eyebrow">Portal de clientes</span>
        <h2>Esta cuenta es del portal de clientes</h2>
        <p>La intranet es solo para el equipo de ${esc(MARCA.nombre)}. Tus ventas están en el portal de clientes.</p>
        <a class="btn block" href="${CFG.demo ? 'pruebas/clientes-demo.html' : 'clientes/'}">${ico('flecha')}Ir al portal de clientes</a>
        <button class="btn txt block" type="button" data-accion="salir">Salir</button>
      </div>`);
    }
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
    { id: 'grupos', nombre: 'Grupos', ver: () => true },
    { id: 'malla', nombre: 'Malla', ver: () => true },
    { id: 'comunicados', nombre: 'Comunicados', ver: () => true, badge: () => sinConfirmar().length },
    { id: 'asistencia', nombre: 'Asistencia', ver: () => esLider() },
    { id: 'informes', nombre: 'Informes', ver: () => esLider() },
    { id: 'gestion', nombre: 'Gestión', ver: () => esGerencia() },
    { id: 'solicitudes', nombre: 'Solicitudes', ver: () => verSolicitudes(), badge: () => porRevisar().length },
    { id: 'equipo', nombre: 'Equipo', ver: () => gestionaCuentas() },
    { id: 'tarjeta', nombre: 'Tarjeta', ver: () => esGerencia() },
    { id: 'oficina', nombre: 'Oficina', ver: () => esGerencia() },
    { id: 'viaticos', nombre: 'Viáticos', ver: () => true, badge: () => viaticosPendientes() },
  ];
  // Menú agrupado: arriba los grupos; las pestañas del grupo activo van en una barra debajo
  const GRUPOS_NAV = [
    { id: 'inicio', nombre: 'Inicio', vistas: ['inicio'] },
    { id: 'comunicados', nombre: 'Comunicados', vistas: ['comunicados'] },
    { id: 'viajes', nombre: 'Viajes', vistas: ['grupos', 'viaticos'] },
    { id: 'personal', nombre: 'Personal', vistas: ['malla', 'asistencia', 'informes', 'solicitudes'] },
    { id: 'admin', nombre: 'Administración', vistas: ['gestion', 'tarjeta', 'oficina', 'equipo'] },
  ];
  function gruposNav() {
    return GRUPOS_NAV.map((g) => ({ ...g, tabs: g.vistas.map((v) => TABS.find((t) => t.id === v)).filter((t) => t && t.ver()) })).filter((g) => g.tabs.length);
  }
  const badgeTxt = (n) => (n ? `<span class="badge" aria-label="${n} pendientes">${n}</span>` : '');
  const puedeVer = (v) => v === 'guia' || TABS.some((t) => t.id === v && t.ver());

  function appView() {
    const grupos = gruposNav();
    const activo = grupos.find((g) => g.tabs.some((t) => t.id === S.view));
    const nTab = (t) => (t.badge ? t.badge() : 0);
    const pie = [MARCA.direccion, MARCA.web, MARCA.registro].filter(Boolean).map(esc).join(' · ');
    return `<header class="top"><div class="wrap top-in">
        <a class="brand" href="#inicio" data-view="inicio"><img src="${MARCA.logo}" alt="${esc(MARCA.nombre)}"><span>Intranet</span></a>
        ${CFG.demo ? '<span class="demo-tag" title="Datos de ejemplo: nada se guarda al recargar">Demostración</span>' : ''}
        <nav class="tabs" aria-label="Secciones">${grupos.map((g) => {
          const unico = g.tabs.length === 1;
          const ultima = S.navUltima[g.id];
          const destino = unico ? g.tabs[0].id : g.tabs.some((t) => t.id === ultima) ? ultima : g.tabs[0].id;
          const n = g.tabs.reduce((a, t) => a + nTab(t), 0);
          return `<button type="button" data-view="${destino}" data-vistas="${g.tabs.map((t) => t.id).join(' ')}"${activo === g ? ' aria-current="page"' : ''}>${unico ? g.tabs[0].nombre : g.nombre}${badgeTxt(n)}</button>`;
        }).join('')}</nav>
        <div class="menu">
          <button type="button" class="avatar" data-accion="menu" aria-haspopup="true" aria-expanded="${S.menu}" aria-label="Tu cuenta">${esc(initials(P().nombre))}</button>
          ${S.menu ? menuPop() : ''}
        </div>
      </div>
      ${activo && activo.tabs.length > 1 ? `<nav class="subtabs" aria-label="${esc(activo.nombre)}"><div class="wrap subtabs-in">${activo.tabs.map((t) => `<button type="button" data-view="${t.id}"${S.view === t.id ? ' aria-current="page"' : ''}>${t.nombre}${badgeTxt(nTab(t))}</button>`).join('')}</div></nav>` : ''}</header>
      <main class="wrap page" id="contenido">${S.cargandoVista ? cargandoBloque() : S.errorVista ? errorVistaView() : vistaActual()}</main>
      <footer class="foot-site"><div class="wrap"><span><b>${esc(MARCA.nombre)}</b> — ${esc(MARCA.lema)}</span><span>${pie}</span></div></footer>
      ${S.lb ? lightboxView() : ''}${S.ajuste ? ajusteView() : ''}${S.view === 'tarjeta' && S.tc.informe && tcExtracto() ? informeTcView() : ''}`;
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
      case 'grupos': return gruposView();
      case 'malla': return mallaView();
      case 'comunicados': return comunicadosView();
      case 'asistencia': return asistenciaView();
      case 'informes': return informesView();
      case 'viaticos': return viaticosView();
      case 'gestion': return gestionView();
      case 'solicitudes': return solicitudesView();
      case 'equipo': return equipoView();
      case 'tarjeta': return tarjetaView();
      case 'oficina': return oficinaView();
      case 'guia': return guiaView();
      default: return inicioView();
    }
  }

  const encabezado = (eyebrow, titulo, lead, extra) => `<div class="page-h"><div><span class="eyebrow">${eyebrow}</span><h1 class="display">${titulo}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div>${extra || ''}</div>`;

  // ---------- Inicio ----------
  async function cargarInicio() {
    const tz = miTz(), hoy = fechaEn(tz), lunes = lunesDe(hoy), domingo = sumarDias(lunes, 6), yo = P().id;
    const [semana, marcas, ausencias, misSol, ajustes] = await Promise.all([
      q(sb.rpc('malla_efectiva', { p_desde: lunes, p_hasta: domingo }).eq('persona_id', yo)),
      q(sb.from('marcas').select('*').eq('persona_id', yo).eq('fecha', hoy)),
      q(sb.rpc('ausencias_aprobadas', { p_desde: lunes, p_hasta: domingo })),
      q(sb.from('solicitudes').select('*').eq('persona_id', yo).order('creado', { ascending: false }).limit(30)),
      q(sb.from('ajustes_jornada').select('*').eq('persona_id', yo).eq('fecha', hoy)).catch(() => []), // si aún no existe la tabla, sigue
      cargarComunicados(),
    ]);
    S.hoy = { fecha: hoy, lunes, semana: semana || [], marcas: marcas || [], ausencias: (ausencias || []).filter((a) => a.persona_id === yo), misSol: misSol || [], ajuste: (ajustes || [])[0] || null };
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

  // Hora de salida que se espera: la del ajuste autorizado si lo hay, si no la del turno.
  const salidaEsperada = (t, aj) => (aj && aj.salida ? toMin(aj.salida) : t && t.salida ? toMin(t.salida) : null);
  // Minutos que entró antes de su turno (0 si no entró antes).
  const minAntesEntrada = (t, marcas, tz) => (t && t.entrada && marcas.entrada ? Math.max(0, toMin(t.entrada) - minDe(marcas.entrada.hora, tz)) : 0);

  // Evalúa un paso contra el turno: hora programada, hora real y etiqueta. aj = ajuste autorizado del día.
  function evaluar(tipo, t, marcas, tz, aj) {
    const m = marcas[tipo];
    const campo = { entrada: 'entrada', salida_almuerzo: 'salida_almuerzo', regreso_almuerzo: 'regreso_almuerzo', salida: 'salida' }[tipo];
    const prog = tipo === 'salida' ? salidaEsperada(t, aj) : t && t[campo] ? toMin(t[campo]) : null;
    const real = m ? minDe(m.hora, tz) : null;
    let chip = null;
    if (m && t && conHorario(t)) {
      if (tipo === 'entrada') {
        const d = real - prog;
        chip = d > tol().entrada ? { txt: `Tarde ${d} min`, cls: 'bad', alerta: true } : -d >= tol().temprano ? { txt: `${-d} min antes`, cls: aj ? 'info' : 'warn' } : { txt: 'A tiempo', cls: 'ok' };
      } else if (tipo === 'regreso_almuerzo' && marcas.salida_almuerzo) {
        const dur = real - minDe(marcas.salida_almuerzo.hora, tz);
        const permitido = conAlmuerzo(t) ? toMin(t.regreso_almuerzo) - toMin(t.salida_almuerzo) : 60;
        chip = dur > permitido + tol().almuerzo ? { txt: `Almuerzo ${dur} min`, cls: 'warn', alerta: true } : { txt: `Almuerzo ${dur} min`, cls: 'ok' };
      } else if (tipo === 'salida') {
        const d = real - prog;
        chip = d < 0 ? { txt: `Salió ${-d} min antes`, cls: 'warn', alerta: true } : d > tol().salida ? { txt: `+${d} min adicionales`, cls: 'info' } : { txt: 'A tiempo', cls: 'ok' };
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
    const aj = h.ajuste;
    const aus = ausenciaHoy();
    const sinAlm = t && conHorario(t) && !conAlmuerzo(t);
    const pasos = PASOS.filter((x) => !(sinAlm && (x.tipo === 'salida_almuerzo' || x.tipo === 'regreso_almuerzo')));
    const completa = !!marcas.salida;
    const sig = completa ? null : pasos.find((x) => !marcas[x.tipo]);
    const descanso = t && !conHorario(t);
    const sede = sedeDe(p.sede_id);
    const soloOficina = validarIp() || validarEquipo();
    const sinLlave = validarEquipo() && !equipoLocal();

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
    // Entrada temprana: pide (o muestra) la autorización para no afectar el informe
    const antes = conHorario(t) ? minAntesEntrada(t, marcas, tz) : 0;
    let avisoAjuste = '';
    if (aj) {
      avisoAjuste = `<div class="notice info">${ico('check')}<div><b>Horario ajustado hoy.</b><p>${aj.salida ? `Tu salida es a las ${esc(hhmm(aj.salida))}` : 'Sales a la hora de siempre'} · autorizó ${esc(nombreDe(aj.autorizo))} · «${esc(aj.motivo)}».</p>${marcas.salida ? '' : '<button type="button" class="btn txt sm" data-accion="abrirAjuste">Cambiar</button>'}</div></div>`;
    } else if (antes >= tol().temprano && !marcas.salida) {
      avisoAjuste = `<div class="notice warn">${ico('alerta')}<div><b>Entraste ${antes} min antes de tu turno.</b><p>Si te autorizaron a entrar y salir más temprano, regístralo para que tu salida no cuente como «salida antes».</p><button type="button" class="btn sm" data-accion="abrirAjuste">Registrar autorización</button></div></div>`;
    }

    const legs = pasos.map((x) => {
      const ev = evaluar(x.tipo, t, marcas, tz, aj);
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
      else if (sig && sinLlave) {
        boton = `<div class="notice warn">${ico('monitor')}<div><b>Este equipo no está autorizado para marcar.</b><p>Marca desde un computador de la oficina${esc(sede ? ' ' + sede.nombre : '')}.</p></div></div>`;
      } else if (sig) {
        boton = `<button type="button" class="btn mark-btn" data-marcar="${sig.tipo}"${ocupado('marcar')}>${S.ocupado === 'marcar' ? 'Marcando…' : esc(sig.boton)}</button>`;
        if (sig.tipo === 'salida_almuerzo') boton += `<button type="button" class="btn txt sm" data-marcar="salida"${ocupado('marcar')}>Hoy no almuerzo · marcar salida</button>`;
      }
      boton += `<p class="pass-pie">${ico('reloj')}${soloOficina ? `Solo desde ${validarEquipo() ? 'computadores autorizados de ' : ''}la oficina ${esc(sede ? sede.nombre : '')}` : 'La hora la pone el servidor'}</p>`;
    }

    return `<article class="pass" aria-label="Pase de jornada">
        <div class="stub">
          ${estrella('stub-star')}
          <div class="stub-top"><span class="eyebrow">Pase de jornada</span><span>${esc(fechaCorta(h.fecha))}</span></div>
          <div class="stub-name">${esc(p.nombre)}</div>
          ${t && conHorario(t)
            ? `<div class="route"><div><small>Entrada</small><b>${hhmm(t.entrada)}</b></div><span class="route-line">${ico('avion')}</span><div><small>Salida${aj && aj.salida ? ' · ajustada' : ''}</small><b>${hm(salidaEsperada(t, aj))}</b></div></div>`
            : `<div class="route vacia"><b>${t ? esc(t.nombre) : 'Sin turno'}</b></div>`}
          <dl class="stub-dl">
            <div><dt>Turno</dt><dd>${t ? esc(t.nombre) : '—'}</dd></div>
            <div><dt>Almuerzo</dt><dd>${t && conHorario(t) ? (conAlmuerzo(t) ? `${hhmm(t.salida_almuerzo)}–${hhmm(t.regreso_almuerzo)}` : 'Sin almuerzo') : '—'}</dd></div>
            <div><dt>Sede</dt><dd>${esc(sede ? sede.nombre : '—')}</dd></div>
          </dl>
          <div class="clock"><small>Hora en ${esc(sede ? sede.nombre : 'la sede')}</small><span id="clock">${segEn(tz)}</span></div>
        </div>
        <div class="pass-body">
          ${aviso}${avisoAjuste}
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
    const [filas, base, turnos, rot] = await Promise.all([
      mallaEfectiva(M.lunes, sumarDias(M.lunes, 5)),
      todas(() => sb.from('horario_base').select('*').order('persona_id').order('dia')),
      q(sb.from('turnos').select('*').order('sede_id').order('id')),
      q(sb.from('horario_rotacion').select('*')),
    ]);
    M.filas = filas;
    M.base = base;
    M.rot = rot || [];
    S.turnos = turnos;
  }

  // Rotación por semanas: semana del ciclo (1 = A, 2 = B…) que le toca a una persona en una fecha
  const LETRAS_SEMANA = ['A', 'B', 'C', 'D'];
  const rotacionDe = (pid) => (S.malla.rot || []).find((r) => r.persona_id === pid) || null;
  function semanaCiclo(pid, fecha) {
    const r = rotacionDe(pid);
    if (!r) return 1;
    const sem = Math.floor(diasEntre(r.desde, fecha) / 7);
    return ((sem % r.semanas) + r.semanas) % r.semanas + 1;
  }

  const inicioHorarios = () => ((S.config.inicio_horarios || {}).fecha || '9999-12-31');
  // Turno que daría el horario fijo ese día (para saber si un cambio es redundante)
  function turnoBase(p, fecha) {
    if (fecha < inicioHorarios()) return null;
    const filas = S.malla.base.filter((b) => b.persona_id === p.id);
    if (!filas.length) return null;
    const sem = semanaCiclo(p.id, fecha);
    const f = filas.find((b) => b.dia === diaSemana(fecha) && (b.semana || 1) === sem);
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

  const personaTd = (p, extra) => `<th scope="row" class="persona"><span class="avatar sm">${esc(initials(p.nombre))}</span><span><b>${esc(p.nombre)}</b>${variasSedes() ? `<small>${esc((sedeDe(p.sede_id) || {}).nombre || '')}</small>` : ''}${extra || ''}</span></th>`;

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
    const filas = porArea(personas).map((g) => `<tr class="grupo"><th colspan="7" scope="rowgroup">${esc(g.area)}</th></tr>` + g.personas.map((p) => `<tr>${personaTd(p, rotacionDe(p.id) ? `<small class="sem-rot">${ico('recargar')}Semana ${LETRAS_SEMANA[semanaCiclo(p.id, M.lunes) - 1]}</small>` : '')}${dias.map((d) => {
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
    M.base.forEach((b) => { idx[b.persona_id + '|' + (b.semana || 1) + '|' + b.dia] = b; });
    const usados = new Set();
    const hoy = fechaEn(miTz());
    const filaSemana = (p, sem, r) => {
      let extra = '';
      if (sem === 1) {
        const opciones = [[1, 'No rota'], [2, 'Rota cada semana (A y B)'], [3, 'Ciclo de 3 semanas'], [4, 'Ciclo de 4 semanas']];
        extra = `<span class="rot-ctl"><select data-rota="${p.id}" aria-label="Rotación de ${esc(p.nombre)}"${M.guardando ? ' disabled' : ''}>${opciones.map(([n, t]) => `<option value="${n}"${(r ? r.semanas : 1) === n ? ' selected' : ''}>${t}</option>`).join('')}</select>
          ${r ? `<label class="rot-desde"><span>Semana A desde el lunes</span><input type="date" value="${esc(r.desde)}" data-rotadesde="${p.id}" aria-label="Lunes de una semana A"></label><small>Esta semana le toca la <b>${LETRAS_SEMANA[semanaCiclo(p.id, hoy) - 1]}</b></small>` : ''}</span>`;
      }
      const etiqueta = r ? `<small class="sem-rot">${ico('recargar')}Semana ${LETRAS_SEMANA[sem - 1]}</small>` : '';
      return `<tr class="${r && sem > 1 ? 'rot-sig' : ''}">${personaTd(p, etiqueta + extra)}${[1, 2, 3, 4, 5, 6].map((d) => {
        const b = idx[p.id + '|' + sem + '|' + d];
        const tid = b ? b.turno_id : (turnoD(p.sede_id) || {}).id;
        if (tid) usados.add(tid);
        return celdaTurno('b', p, sem + '-' + d, tid, false);
      }).join('')}</tr>`;
    };
    const filas = porArea(personas).map((g) => `<tr class="grupo"><th colspan="7" scope="rowgroup">${esc(g.area)}</th></tr>` + g.personas.map((p) => {
      const r = rotacionDe(p.id);
      return Array.from({ length: r ? r.semanas : 1 }, (_, i) => filaSemana(p, i + 1, r)).join('');
    }).join('')).join('');
    return `<div class="tablewrap card flush"><table class="malla">
        <thead><tr><th scope="col">Persona</th>${DIAS.map((d) => `<th scope="col">${d}</th>`).join('')}</tr></thead>
        <tbody>${filas || '<tr><td colspan="7" class="vacio">No hay personas cuya malla puedas editar.</td></tr>'}</tbody>
      </table></div>
      ${leyendaTurnos(usados)}
      <p class="hint">Los días sin turno cuentan como Descanso. Las personas sin ningún día cargado (por ejemplo, la gerencia) no aparecen en la malla semanal.</p>
      <p class="hint">Si alguien se turna por semanas, elige «Rota cada semana» en su nombre: aparecen sus semanas A y B, y la malla alterna sola desde el lunes que indiques como semana A.</p>`;
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

  // Rotación: 1 = no rota; 2 a 4 = semanas del ciclo. Las semanas nuevas empiezan como copia de la A.
  async function cambiarRotacion(pid, semanas, desde) {
    const M = S.malla, r = rotacionDe(pid);
    M.guardando = true;
    render();
    try {
      if (semanas === 1) {
        if (r) await q(sb.from('horario_rotacion').delete().eq('persona_id', pid));
        await q(sb.from('horario_base').delete().eq('persona_id', pid).gt('semana', 1));
      } else {
        const inicio = lunesDe(desde || (r ? r.desde : fechaEn(miTz())));
        await q(sb.from('horario_rotacion').upsert({ persona_id: pid, semanas, desde: inicio }, { onConflict: 'persona_id' }));
        if (r && r.semanas > semanas) await q(sb.from('horario_base').delete().eq('persona_id', pid).gt('semana', semanas));
        const semA = M.base.filter((b) => b.persona_id === pid && (b.semana || 1) === 1);
        const nuevas = [];
        for (let s = 2; s <= semanas; s++) {
          if (M.base.some((b) => b.persona_id === pid && b.semana === s)) continue;
          semA.forEach((b) => nuevas.push({ persona_id: pid, semana: s, dia: b.dia, turno_id: b.turno_id }));
        }
        if (nuevas.length) await q(sb.from('horario_base').insert(nuevas));
      }
      await cargarMalla();
      toast(semanas === 1 ? 'Ya no rota: queda solo su horario fijo.' : desde ? 'Semana A actualizada.' : `Rotación de ${semanas} semanas. Ajusta su semana ${LETRAS_SEMANA.slice(1, semanas).join(' y ')}.`);
    } catch (e) {
      toast(errorTexto(e), 'bad');
    } finally {
      M.guardando = false;
      render();
    }
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
        const [sem, dia] = String(clave).includes('-') ? clave.split('-').map(Number) : [1, +clave];
        const d = turnoD(p.sede_id);
        if (d && String(d.id) === String(valor)) {
          await q(sb.from('horario_base').delete().eq('persona_id', pid).eq('semana', sem).eq('dia', dia));
        } else {
          await q(sb.from('horario_base').upsert({ persona_id: pid, semana: sem, dia, turno_id: +valor }, { onConflict: 'persona_id,semana,dia' }));
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
  // Ajustes de horario autorizados (entrada temprana). Si la tabla aún no existe, sigue sin ellos.
  const cargarAjustes = (desde, hasta) => todas(() => sb.from('ajustes_jornada').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha').order('persona_id')).catch(() => []);
  const ajusteDe = (lista, pid, fecha) => (lista || []).find((a) => a.persona_id === pid && a.fecha === fecha) || null;

  async function cargarAsistencia() {
    const sedes = S.sedes.filter((s) => lideraSede(s.id));
    const fechas = [...new Set(sedes.map((s) => fechaEn(s.zona_horaria)))].sort();
    if (!fechas.length) { S.asistencia = { malla: [], marcas: [], ausencias: [], ajustes: [], hora: new Date() }; return; }
    const desde = fechas[0], hasta = fechas[fechas.length - 1];
    const [malla, marcas, ausencias, ajustes] = await Promise.all([
      mallaEfectiva(desde, hasta),
      todas(() => sb.from('marcas').select('*').gte('fecha', desde).lte('fecha', hasta).order('id')),
      q(sb.rpc('ausencias_aprobadas', { p_desde: desde, p_hasta: hasta })),
      cargarAjustes(desde, hasta),
    ]);
    S.asistencia = { malla, marcas, ausencias, ajustes, hora: new Date() };
  }

  // Estado de una persona hoy, en este orden: ausencia, descanso, sin entrada, con marcas.
  function estadoPersona(p, t, marcas, aus, tz, aj) {
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
    const alerta = PASOS.some((x) => { const ev = evaluar(x.tipo, t, marcas, tz, aj); return ev.chip && ev.chip.alerta; });
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
      const aj = ajusteDe(A.ajustes, p.id, hoy);
      const st = estadoPersona(p, t, marcas, aus, tz, aj);
      cuenta[st.kpi]++;
      const celdas = PASOS.map((x) => {
        const ev = evaluar(x.tipo, t, marcas, tz, aj);
        if (ev.real != null) return `<td class="num"><b>${hm(ev.real)}</b>${ev.chip && ev.chip.alerta ? `<span class="chip ${ev.chip.cls} xs">${esc(ev.chip.txt)}</span>` : ''}</td>`;
        return `<td class="num prog">${ev.prog != null && !(x.tipo.includes('almuerzo') && !conAlmuerzo(t)) ? hm(ev.prog) : '—'}</td>`;
      }).join('');
      const chipAj = aj ? `<span class="chip info xs" title="${esc(`${aj.motivo} · autorizó ${nombreDe(aj.autorizo)}`)}">${aj.salida ? `Sale ${esc(hhmm(aj.salida))}` : 'Entrada temprana'} · autorizó ${esc(primerNombre(nombreDe(aj.autorizo)))}</span>` : '';
      return `<tr>${personaTd(p)}<td><span class="chipt ${colorTurno(t)}" title="${esc(t ? turnoEtq(t) : '')}">${esc(t ? chipTxt(t) : '—')}</span></td>${celdas}<td><span class="chip ${st.cls}">${esc(st.txt)}</span>${chipAj}</td></tr>`;
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

  // ---------- Viáticos y legalización de gastos de viaje ----------
  // El funcionario solicita (o la gerencia asigna); la gerencia fija el presupuesto y aprueba;
  // el funcionario registra gastos con soporte y envía; la gerencia revisa y cierra con el saldo.
  const VIA_ESTADOS = {
    solicitado: { txt: 'Por aprobar', cls: 'warn' },
    rechazado: { txt: 'Rechazado', cls: 'mute' },
    aprobado: { txt: 'Por legalizar', cls: 'info' },
    en_revision: { txt: 'Legalización en revisión', cls: 'warn' },
    devuelto: { txt: 'Devuelto para corregir', cls: 'bad' },
    cerrado: { txt: 'Legalizado', cls: 'ok' },
    anulado: { txt: 'Anulado', cls: 'mute' },
  };
  const VIA_CAT = { alimentacion: 'Alimentación', hospedaje: 'Hospedaje', transporte: 'Transporte', propinas: 'Propinas', entradas: 'Entradas y tiquetes', otros: 'Otros' };
  const VIA_ACTIVOS = ['solicitado', 'aprobado', 'en_revision', 'devuelto'];
  const viaEstado = () => ({ lista: [], gastos: [], grupos: [], cargado: false, filtro: 'activos', abierto: null, form: null, gasto: null, archivo: null, rev: {}, noAcep: null, noMotivo: '', confirmar: null });
  const pesos = (v) => COP.format(Math.round(Number(v) || 0)).replace(/\s/g, ' ');
  const viaGastos = (id) => S.via.gastos.filter((g) => g.viatico_id === id);
  const viaSuma = (gs) => gs.reduce((a, g) => a + Number(g.valor || 0), 0);
  const viaFechas = (v) => (v.salida === v.regreso ? fechaCorta(v.salida) : `${fechaCorta(v.salida)} – ${fechaCorta(v.regreso)}`);
  const viaGrupo = (v) => (v.grupo_id ? S.via.grupos.find((g) => g.id === v.grupo_id) : null);

  // Insignia: a la gerencia, lo que espera su decisión; a cada quien, lo que debe legalizar o corregir
  function viaticosPendientes() {
    if (!S.via || !S.perfil) return 0;
    const yo = P().id, hoy = fechaEn(miTz());
    let n = 0;
    S.via.lista.forEach((v) => {
      if (esGerencia() && v.persona_id !== yo && (v.estado === 'solicitado' || v.estado === 'en_revision')) n++;
      if (v.persona_id === yo && (v.estado === 'devuelto' || (v.estado === 'aprobado' && v.regreso < hoy))) n++;
    });
    return n;
  }

  async function cargarViaticos() {
    const [lista, gastos, grupos] = await Promise.all([
      todas(() => sb.from('viaticos').select('*').order('salida', { ascending: false }).order('id', { ascending: false })),
      todas(() => sb.from('viatico_gastos').select('*').order('fecha').order('id')),
      q(sb.from('grupos').select('id,nombre,destino,salida,regreso,estado').order('salida', { ascending: false }).limit(300)),
    ]);
    Object.assign(S.via, { lista, gastos, grupos, cargado: true });
    if (S.via.abierto) await firmarVia(S.via.abierto);
  }
  // URL firmadas de los soportes del viático abierto
  async function firmarVia(id) {
    const gs = viaGastos(id).filter((g) => g.soporte_ruta);
    if (!gs.length) return;
    const filas = gs.map((g) => ({ ruta: g.soporte_ruta, g }));
    await firmar('viaticos', filas);
    filas.forEach((f) => { f.g.url = f.url; });
  }
  async function abrirViatico(id) {
    const V = S.via, v = V.lista.find((x) => x.id === id);
    if (!v) return;
    Object.assign(V, { abierto: id, form: null, gasto: nuevoGastoVia(v), archivo: null, rev: { presupuesto: v.presupuesto || v.solicitado || '', comentario: '' }, noAcep: null, noMotivo: '', confirmar: null });
    render();
    window.scrollTo(0, 0);
    try { await firmarVia(id); } catch (e) { /* sin vista previa de soportes */ }
    render();
  }
  function nuevoGastoVia(v) {
    const hoy = fechaEn(miTz());
    const f = hoy < v.salida ? v.salida : hoy > v.regreso ? v.regreso : hoy;
    return { fecha: f, categoria: 'alimentacion', descripcion: '', valor: '' };
  }

  function viaKpis(ger) {
    const yo = P().id, L = ger ? S.via.lista : S.via.lista.filter((v) => v.persona_id === yo);
    const k = (b, t, s) => `<div class="via-kpi"><span>${t}</span><b>${b}</b>${s ? `<small>${s}</small>` : ''}</div>`;
    const enCurso = L.filter((v) => ['aprobado', 'en_revision', 'devuelto'].includes(v.estado));
    const anticipos = viaSuma(enCurso.map((v) => ({ valor: v.presupuesto })));
    if (ger) {
      const porAprobar = L.filter((v) => v.estado === 'solicitado' && v.persona_id !== yo).length;
      const porRevisar = L.filter((v) => v.estado === 'en_revision' && v.persona_id !== yo).length;
      const cerr = L.filter((v) => v.estado === 'cerrado');
      const aFavor = cerr.filter((v) => +v.saldo > 0).reduce((a, v) => a + +v.saldo, 0);
      const reemb = cerr.filter((v) => +v.saldo < 0).reduce((a, v) => a - +v.saldo, 0);
      return `<div class="via-kpis">${k(porAprobar, 'Solicitudes por aprobar')}${k(porRevisar, 'Legalizaciones por revisar')}${k(pesos(anticipos), 'Anticipos sin legalizar', plural(enCurso.length, 'viático', 'viáticos'))}${k(pesos(aFavor), 'Saldos a favor de Caminos', reemb ? `${pesos(reemb)} por reembolsar a funcionarios` : 'en viáticos legalizados')}</div>`;
    }
    const porLeg = L.filter((v) => v.estado === 'aprobado' || v.estado === 'devuelto').length;
    return `<div class="via-kpis">${k(L.filter((v) => v.estado === 'solicitado').length, 'Solicitudes en espera')}${k(porLeg, 'Por legalizar')}${k(pesos(anticipos), 'Anticipos recibidos', 'sin legalizar aún')}${k(L.filter((v) => v.estado === 'cerrado').length, 'Legalizados')}</div>`;
  }

  function viaticosView() {
    const V = S.via;
    if (!V.cargado) return cargandoBloque();
    if (V.abierto) {
      const v = V.lista.find((x) => x.id === V.abierto);
      if (v) return viaticoDetalle(v);
      V.abierto = null;
    }
    const ger = esGerencia(), yo = P().id;
    const acc = `<div class="via-acc-h"><button type="button" class="btn" data-viaform="solicitar">${ico('mas')}Solicitar viáticos</button>${ger ? `<button type="button" class="btn ghost" data-viaform="asignar">${ico('usuarioMas')}Asignar a un funcionario</button>` : ''}</div>`;
    const cab = encabezado('Viajes', 'Viáticos y <em>legalización</em>', ger
      ? 'Aprueba las solicitudes, asigna presupuestos y revisa las legalizaciones de gastos del equipo.'
      : 'Solicita viáticos para tus viajes de acompañamiento y, al volver, legaliza tus gastos con los soportes.', acc);
    const base = ger ? V.lista : V.lista.filter((v) => v.persona_id === yo);
    const FILTROS = [
      ['activos', 'En curso', (v) => VIA_ACTIVOS.includes(v.estado)],
      ...(ger ? [['pendientes', 'Esperan mi revisión', (v) => v.persona_id !== yo && (v.estado === 'solicitado' || v.estado === 'en_revision')]] : []),
      ['cerrados', 'Legalizados', (v) => v.estado === 'cerrado'],
      ['todos', 'Todos', () => true],
    ];
    const fil = FILTROS.find((f) => f[0] === V.filtro) || FILTROS[0];
    const lista = base.filter(fil[2]);
    const chips = `<div class="via-filtros" role="group" aria-label="Filtrar">${FILTROS.map(([id, txt, fn]) => `<button type="button" class="chipbtn" data-viafiltro="${id}" aria-pressed="${fil[0] === id}">${txt} <b>${base.filter(fn).length}</b></button>`).join('')}</div>`;
    const tarjetas = lista.map((v) => {
      const E = VIA_ESTADOS[v.estado], gastado = viaSuma(viaGastos(v.id)), g = viaGrupo(v);
      const pct = v.presupuesto ? Math.min(100, (gastado / v.presupuesto) * 100) : 0;
      return `<li><button type="button" class="via-card" data-via="${v.id}">
          <span class="via-card-h"><b>${esc(v.destino)}</b><span class="chip ${E.cls} xs">${E.txt}</span></span>
          <span class="via-meta">${ger ? `<b>${esc(nombreDe(v.persona_id))}</b> · ` : ''}${esc(viaFechas(v))}${g ? ` · ${esc(g.nombre)}` : ''}</span>
          <span class="via-monto"><span>${v.presupuesto ? `${pesos(gastado)} de ${pesos(v.presupuesto)}` : `Solicita ${v.solicitado ? pesos(v.solicitado) : 'sin monto'}`}</span>${v.estado === 'cerrado' && +v.saldo ? `<small>${+v.saldo > 0 ? 'Reintegra' : 'Se le reembolsa'} ${pesos(Math.abs(v.saldo))}</small>` : ''}</span>
          ${v.presupuesto ? `<span class="meter${gastado > v.presupuesto ? ' bad' : ''}"><span style="width:${pct}%"></span></span>` : ''}
        </button></li>`;
    }).join('');
    return cab + (V.form ? viaticoForm() : '') + viaKpis(ger) + chips
      + (tarjetas ? `<ul class="via-lista">${tarjetas}</ul>` : `<p class="vacio card">${fil[0] === 'activos' ? 'No hay viáticos en curso.' : 'No hay viáticos en esta vista.'}${!base.length ? ' Toca «Solicitar viáticos» para pedir los de tu próximo viaje.' : ''}</p>`);
  }

  function viaticoForm() {
    const F = S.via.form, asignar = F.modo === 'asignar';
    const personas = activas().filter((p) => p.id !== P().id);
    const grupos = S.via.grupos;
    return `<form class="card via-form" data-form="viatico">
        <div class="sec-h"><h2>${asignar ? 'Asignar viáticos a un funcionario' : 'Solicitar viáticos'}</h2><button type="button" class="btn txt sm" data-viaform="cerrar">${ico('x')}Cerrar</button></div>
        <p class="hint">${asignar ? 'Quedan aprobados de una vez con el presupuesto que pongas. El funcionario los ve en su pestaña Viáticos para legalizarlos.' : 'La gerencia revisa tu solicitud, asigna el presupuesto y la aprueba.'}</p>
        <div class="form-grid">
          ${asignar ? `<label class="field"><span>Funcionario</span><select data-viab="persona" required><option value="">Elige una persona</option>${personas.map((p) => `<option value="${p.id}"${F.persona === p.id ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>` : ''}
          <label class="field"><span>Grupo de viaje (opcional)</span><select data-viab="grupo"><option value="">Sin grupo</option>${grupos.map((g) => `<option value="${g.id}"${String(F.grupo) === String(g.id) ? ' selected' : ''}>${esc(g.nombre)}${g.salida ? ` · ${esc(fechaCorta(g.salida))}` : ''}</option>`).join('')}</select></label>
          <label class="field"><span>Destino</span><input data-viab="destino" value="${esc(F.destino)}" maxlength="120" required placeholder="Ej.: Cartagena"></label>
          <label class="field"><span>${asignar ? 'Presupuesto (COP)' : 'Monto que solicitas (COP)'}</span><input type="number" min="1" step="1" inputmode="numeric" data-viab="monto" value="${esc(F.monto)}"${asignar ? ' required' : ''} placeholder="Ej.: 800000"></label>
          <label class="field"><span>Salida</span><input type="date" data-viab="salida" value="${esc(F.salida)}" required></label>
          <label class="field"><span>Regreso</span><input type="date" data-viab="regreso" value="${esc(F.regreso)}" min="${esc(F.salida)}" required></label>
          <label class="field ancho"><span>Motivo y detalle</span><textarea data-viab="motivo" rows="2" maxlength="1000" placeholder="Ej.: acompañamiento del grupo Colegio San José, 42 pasajeros; incluye alimentación y transporte local">${esc(F.motivo)}</textarea></label>
        </div>
        <div class="via-botones"><button type="submit" class="btn"${ocupado('viatico')}>${S.ocupado === 'viatico' ? 'Guardando…' : asignar ? 'Asignar y aprobar' : 'Enviar solicitud'}</button></div>
      </form>`;
  }

  function viaticoDetalle(v) {
    const V = S.via, yo = P().id, ger = esGerencia(), mio = v.persona_id === yo, revisa = ger && !mio;
    const E = VIA_ESTADOS[v.estado], g = viaGrupo(v), gs = viaGastos(v.id);
    const registrado = viaSuma(gs), aceptado = viaSuma(gs.filter((x) => !x.no_aceptado));
    const saldo = (+v.presupuesto || 0) - aceptado;
    const editable = mio && (v.estado === 'aprobado' || v.estado === 'devuelto');
    const sinSoporte = gs.filter((x) => !x.soporte_ruta).length;
    const tile = (t, b, s, cls) => `<div class="via-kpi${cls ? ' ' + cls : ''}"><span>${t}</span><b>${b}</b>${s ? `<small>${s}</small>` : ''}</div>`;
    const saldoTxt = !v.presupuesto ? '—' : pesos(Math.abs(saldo));
    const saldoSub = !v.presupuesto ? '' : saldo > 0 ? 'a favor de Caminos (lo reintegra el funcionario)' : saldo < 0 ? 'a favor del funcionario (se le reembolsa)' : 'sin saldo';
    let partes = `<button type="button" class="btn txt sm via-volver" data-via="volver">${ico('izq')}Todos los viáticos</button>`;
    partes += encabezado(`Viático No. ${v.id}`, `${esc(v.destino)} <span class="chip ${E.cls}">${E.txt}</span>`,
      `${esc(nombreDe(v.persona_id))} · ${esc(viaFechas(v))}${g ? ` · grupo ${esc(g.nombre)}` : ''}${v.motivo ? `<br>${esc(v.motivo)}` : ''}`,
      gs.length || v.estado === 'cerrado' ? `<button type="button" class="btn ghost sm" data-viaaccion="imprimir">${ico('documento')}${v.estado === 'cerrado' ? 'Formato de legalización' : 'Vista previa del formato'}</button>` : '');
    partes += `<div class="via-kpis">${tile('Presupuesto', v.presupuesto ? pesos(v.presupuesto) : '—', v.solicitado ? `solicitó ${pesos(v.solicitado)}` : v.aprobado_por ? `asignó ${esc(primerNombre(nombreDe(v.aprobado_por)))}` : '')}${tile('Gastos registrados', pesos(registrado), plural(gs.length, 'gasto', 'gastos') + (sinSoporte ? ` · ${sinSoporte} sin soporte` : ''))}${tile(v.estado === 'cerrado' ? 'Legalizado' : 'Aceptado', pesos(aceptado), registrado !== aceptado ? `${pesos(registrado - aceptado)} no aceptado` : '')}${tile('Saldo', saldoTxt, saldoSub, saldo < 0 ? 'neg' : '')}</div>`;
    if (v.comentario) {
      const quien = v.revisado_por || v.aprobado_por;
      partes += `<div class="notice ${v.estado === 'devuelto' || v.estado === 'rechazado' ? 'bad' : 'info'} via-nota">${ico('megafono')}<div><b>${quien ? esc(nombreDe(quien)) : 'Gerencia'}${v.estado === 'devuelto' ? ' te pide corregir' : ''}:</b><p>${esc(v.comentario)}</p></div></div>`;
    }
    const R = V.rev;
    // Acciones según el estado y quién mira
    if (v.estado === 'solicitado' && revisa) {
      partes += `<section class="card via-caja"><h2>Aprobar solicitud</h2><p class="hint">${v.solicitado ? `Solicitó ${pesos(v.solicitado)}.` : 'No indicó monto.'} Asigna el presupuesto y aprueba, o rechaza con el motivo.</p>
          <div class="form-grid"><label class="field"><span>Presupuesto asignado (COP)</span><input type="number" min="1" step="1" inputmode="numeric" data-viar="presupuesto" value="${esc(R.presupuesto)}"></label>
          <label class="field"><span>Comentario (obligatorio para rechazar)</span><input data-viar="comentario" maxlength="1000" value="${esc(R.comentario)}"></label></div>
          <div class="via-botones"><button type="button" class="btn ghost" data-viaaccion="rechazar"${ocupado('via')}>Rechazar</button><button type="button" class="btn" data-viaaccion="aprobar"${ocupado('via')}>${ico('check')}Aprobar</button></div></section>`;
    } else if (v.estado === 'solicitado' && mio) {
      partes += `<div class="notice">${ico('reloj')}<div><b>Tu solicitud está esperando la aprobación de gerencia.</b><p>Cuando la aprueben verás el presupuesto y podrás registrar tus gastos.</p></div></div>`;
    }
    if (v.estado === 'en_revision' && mio) partes += `<div class="notice info">${ico('reloj')}<div><b>Enviaste la legalización${v.enviado ? ` el ${esc(fechaCorta(fechaEn(miTz(), new Date(v.enviado))))}` : ''}.</b><p>La gerencia la está revisando.</p></div></div>`;
    if (v.estado === 'en_revision' && revisa) {
      partes += `<section class="card via-caja"><h2>Revisar legalización</h2><p class="hint">Revisa cada gasto y su soporte. Si alguno no corresponde, toca «No aceptar» y escribe el motivo: no cuenta en lo legalizado.</p>
          <label class="field"><span>Comentario (obligatorio para devolver)</span><input data-viar="comentario" maxlength="1000" value="${esc(R.comentario)}"></label>
          <div class="via-botones"><button type="button" class="btn ghost" data-viaaccion="devolver"${ocupado('via')}>Devolver para corregir</button><button type="button" class="btn" data-viaaccion="aprobarleg"${ocupado('via')}>${ico('check')}Aprobar legalización · ${pesos(aceptado)}</button></div></section>`;
    }
    if (editable) {
      const G = V.gasto || nuevoGastoVia(v);
      const min = sumarDias(v.salida, -7), max = sumarDias(v.regreso, 7);
      partes += `<form class="card via-caja" data-form="viagasto"><h2>Registrar un gasto</h2>
          <div class="via-gasto-grid">
            <label class="field"><span>Fecha</span><input type="date" data-viag="fecha" value="${esc(G.fecha)}" min="${min}" max="${max}" required></label>
            <label class="field"><span>Categoría</span><select data-viag="categoria">${Object.entries(VIA_CAT).map(([k, t]) => `<option value="${k}"${G.categoria === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
            <label class="field via-desc"><span>Descripción</span><input data-viag="descripcion" value="${esc(G.descripcion)}" maxlength="300" required placeholder="Ej.: almuerzo del grupo en el hotel"></label>
            <label class="field"><span>Valor (COP)</span><input type="number" min="1" step="1" inputmode="numeric" data-viag="valor" value="${esc(G.valor)}" required></label>
            <label class="field ancho"><span>Soporte: foto de la factura o PDF</span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" data-viaarchivo="1"></label>
          </div>
          <div class="via-botones"><button type="submit" class="btn"${ocupado('viagasto')}>${S.ocupado === 'viagasto' ? 'Guardando…' : `${ico('mas')}Agregar gasto`}</button></div></form>`;
    }
    // Tabla de gastos
    const filas = gs.map((x) => {
      const quitar = editable ? (V.confirmar === 'gasto:' + x.id
        ? `<span class="confirmar">¿Quitar? <button type="button" class="btn danger sm" data-viaaccion="quitarsi:${x.id}"${ocupado('via')}>Sí</button><button type="button" class="btn txt sm" data-viaaccion="no">No</button></span>`
        : `<button type="button" class="btn txt sm" data-viaaccion="quitar:${x.id}" aria-label="Quitar gasto">${ico('basura')}</button>`) : '';
      let rev = '';
      if (v.estado === 'en_revision' && revisa) {
        rev = V.noAcep === x.id
          ? `<span class="via-noacep"><input data-vianomot="1" value="${esc(V.noMotivo)}" maxlength="300" placeholder="Motivo" aria-label="Motivo para no aceptar"><button type="button" class="btn danger sm" data-viaaccion="noaceptarsi:${x.id}"${ocupado('via')}>No aceptar</button><button type="button" class="btn txt sm" data-viaaccion="no">Cancelar</button></span>`
          : x.no_aceptado ? `<button type="button" class="btn txt sm" data-viaaccion="aceptar:${x.id}"${ocupado('via')}>Volver a aceptar</button>` : `<button type="button" class="btn txt sm" data-viaaccion="noaceptar:${x.id}">No aceptar</button>`;
      }
      const sop = x.soporte_ruta ? (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${ico('clip')}Ver</a>` : `${ico('clip')}Adjunto`) : '<span class="chip warn xs">Sin soporte</span>';
      return `<tr class="${x.no_aceptado ? 'via-no' : ''}"><td>${esc(fechaCorta(x.fecha))}</td><td>${VIA_CAT[x.categoria] || esc(x.categoria)}</td><td>${esc(x.descripcion)}${x.no_aceptado ? `<small class="via-motivo">No aceptado: ${esc(x.no_aceptado)}</small>` : ''}</td><td class="num">${pesos(x.valor)}</td><td>${sop}</td><td class="via-acc-g">${quitar}${rev}</td></tr>`;
    }).join('');
    const porCat = {};
    gs.filter((x) => !x.no_aceptado).forEach((x) => { porCat[x.categoria] = (porCat[x.categoria] || 0) + Number(x.valor); });
    partes += `<section class="via-gastos"><div class="sec-h"><h2>Gastos</h2>${Object.keys(porCat).length ? `<span class="hint">${Object.entries(porCat).map(([k, t]) => `${VIA_CAT[k]} ${pesos(t)}`).join(' · ')}</span>` : ''}</div>
        ${gs.length ? `<div class="tablewrap card flush"><table class="via-tabla"><thead><tr><th scope="col">Fecha</th><th scope="col">Categoría</th><th scope="col">Descripción</th><th scope="col" class="num">Valor</th><th scope="col">Soporte</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead>
          <tbody>${filas}</tbody><tfoot><tr><th scope="row" colspan="3">Total registrado</th><td class="num"><b>${pesos(registrado)}</b></td><td colspan="2"></td></tr></tfoot></table></div>`
        : `<p class="vacio card">${editable ? 'Aún no registras gastos. Agrega cada uno con su soporte.' : 'Sin gastos registrados.'}</p>`}</section>`;
    if (editable) {
      partes += `<div class="via-enviar card"><div><b>¿Terminaste?</b><p class="hint">Envía la legalización para que la gerencia la revise. Después ya no podrás cambiar los gastos, salvo que te la devuelvan.${sinSoporte ? ` Ojo: ${plural(sinSoporte, 'gasto no tiene', 'gastos no tienen')} soporte.` : ''}</p></div>
          <button type="button" class="btn" data-viaaccion="enviar"${gs.length ? '' : ' disabled'}${ocupado('via')}>Enviar legalización</button></div>`;
    }
    const puedeAnular = (mio && v.estado === 'solicitado') || (revisa && VIA_ACTIVOS.includes(v.estado));
    if (puedeAnular) {
      partes += V.confirmar === 'anular'
        ? `<p class="confirmar via-anular">¿Anular este viático? <button type="button" class="btn danger sm" data-viaaccion="anularsi"${ocupado('via')}>Sí, anular</button><button type="button" class="btn txt sm" data-viaaccion="no">No</button></p>`
        : `<p class="via-anular"><button type="button" class="btn txt sm" data-viaaccion="anular">${ico('x')}Anular viático</button></p>`;
    }
    return partes;
  }

  function imprimirLegalizacion(v) {
    if (!window.Legalizacion) return;
    const p = persona(v.persona_id) || {}, g = viaGrupo(v);
    window.Legalizacion.abrir({
      numero: v.id, funcionario: p.nombre || '', area: (areaDe(p.area_id) || {}).nombre || '', destino: v.destino, grupo: g ? g.nombre : '',
      salida: v.salida, regreso: v.regreso, motivo: v.motivo, presupuesto: v.presupuesto, estado: v.estado, estadoTxt: VIA_ESTADOS[v.estado].txt,
      aprobo: v.aprobado_por ? nombreDe(v.aprobado_por) : '', aprobado: v.aprobado, reviso: v.estado === 'cerrado' && v.revisado_por ? nombreDe(v.revisado_por) : '', revisado: v.revisado,
      gastos: viaGastos(v.id).map((x) => ({ fecha: x.fecha, categoria: x.categoria, descripcion: x.descripcion, valor: x.valor, soporte: !!x.soporte_ruta, no_aceptado: x.no_aceptado })),
    });
  }

  async function accionViatico(que) {
    const V = S.via, v = V.lista.find((x) => x.id === V.abierto);
    if (!v) return;
    const [op, arg] = String(que).split(':');
    const R = V.rev;
    const recargar = async (msg) => { V.confirmar = null; V.noAcep = null; V.noMotivo = ''; await cargarViaticos(); if (msg) toast(msg); };
    if (op === 'no') { V.confirmar = null; V.noAcep = null; render(); return; }
    if (op === 'imprimir') { imprimirLegalizacion(v); return; }
    if (op === 'anular') { V.confirmar = 'anular'; render(); return; }
    if (op === 'quitar') { V.confirmar = 'gasto:' + arg; render(); return; }
    if (op === 'noaceptar') { V.noAcep = +arg; V.noMotivo = ''; render(); const i = document.querySelector('[data-vianomot]'); if (i) i.focus(); return; }
    await accion('via', async () => {
      if (op === 'aprobar') {
        if (!(+R.presupuesto > 0)) throw new Error('Asigna el presupuesto.');
        await q(sb.rpc('aprobar_viatico', { p_id: v.id, p_presupuesto: +R.presupuesto, p_comentario: R.comentario || '' }));
        await recargar(`Viático aprobado por ${pesos(R.presupuesto)}.`);
      } else if (op === 'rechazar') {
        if (String(R.comentario || '').trim().length < 3) throw new Error('Escribe en el comentario el motivo del rechazo.');
        await q(sb.rpc('rechazar_viatico', { p_id: v.id, p_comentario: R.comentario }));
        await recargar('Solicitud rechazada.');
      } else if (op === 'enviar') {
        await q(sb.rpc('enviar_legalizacion', { p_id: v.id }));
        await recargar('Legalización enviada a gerencia.');
      } else if (op === 'aprobarleg') {
        const r = await q(sb.rpc('revisar_legalizacion', { p_id: v.id, p_aprobar: true, p_comentario: R.comentario || '' }));
        const s = +((r && r.saldo) || 0);
        await recargar(s > 0 ? `Legalización aprobada. ${nombreDe(v.persona_id)} reintegra ${pesos(s)}.` : s < 0 ? `Legalización aprobada. Caminos le reembolsa ${pesos(-s)}.` : 'Legalización aprobada, sin saldo.');
      } else if (op === 'devolver') {
        if (String(R.comentario || '').trim().length < 3) throw new Error('Escribe en el comentario qué debe corregir.');
        await q(sb.rpc('revisar_legalizacion', { p_id: v.id, p_aprobar: false, p_comentario: R.comentario }));
        await recargar('Legalización devuelta para corregir.');
      } else if (op === 'noaceptarsi') {
        if (String(V.noMotivo || '').trim().length < 3) throw new Error('Escribe el motivo.');
        await q(sb.rpc('no_aceptar_gasto', { p_gasto: +arg, p_motivo: V.noMotivo }));
        await recargar('Gasto marcado como no aceptado.');
      } else if (op === 'aceptar') {
        await q(sb.rpc('no_aceptar_gasto', { p_gasto: +arg, p_motivo: null }));
        await recargar('Gasto aceptado de nuevo.');
      } else if (op === 'quitarsi') {
        const x = V.gastos.find((y) => y.id === +arg);
        await q(sb.from('viatico_gastos').delete().eq('id', +arg));
        if (x && x.soporte_ruta) { try { await sb.storage.from('viaticos').remove([x.soporte_ruta]); } catch (e) { /* el archivo queda huérfano */ } }
        await recargar('Gasto quitado.');
      } else if (op === 'anularsi') {
        await q(sb.rpc('anular_viatico', { p_id: v.id, p_motivo: '' }));
        await recargar('Viático anulado.');
      }
    });
    if (V.abierto) { try { await firmarVia(V.abierto); } catch (e) { /* nada */ } render(); }
  }

  function abrirFormViatico(modo) {
    S.via.form = { modo, persona: '', grupo: '', destino: '', monto: '', salida: '', regreso: '', motivo: '' };
    S.via.abierto = null;
    render();
    const i = document.querySelector('.via-form select, .via-form input');
    if (i) i.focus();
  }

  async function guardarViatico() {
    const F = S.via.form;
    if (!F) return;
    const asignar = F.modo === 'asignar';
    if (asignar && !F.persona) { toast('Elige el funcionario.', 'bad'); return; }
    if (!String(F.destino || '').trim()) { toast('Escribe el destino.', 'bad'); return; }
    if (!F.salida || !F.regreso) { toast('Pon las fechas de salida y regreso.', 'bad'); return; }
    if (F.regreso < F.salida) { toast('El regreso no puede ser antes de la salida.', 'bad'); return; }
    if (asignar && !(+F.monto > 0)) { toast('Pon el presupuesto.', 'bad'); return; }
    await accion('viatico', async () => {
      const comun = { p_destino: F.destino.trim(), p_salida: F.salida, p_regreso: F.regreso, p_motivo: F.motivo || '', p_grupo: F.grupo ? +F.grupo : null };
      const r = asignar
        ? await q(sb.rpc('asignar_viatico', { p_persona: F.persona, p_presupuesto: +F.monto, ...comun }))
        : await q(sb.rpc('solicitar_viatico', { p_monto: +F.monto > 0 ? +F.monto : null, ...comun }));
      S.via.form = null;
      await cargarViaticos();
      toast(asignar ? `Viáticos asignados a ${nombreDe(F.persona)}.` : 'Solicitud enviada a gerencia.');
      if (r && r.id) { S.via.abierto = null; S.via.filtro = 'activos'; }
    });
  }

  async function guardarGastoVia() {
    const V = S.via, v = V.lista.find((x) => x.id === V.abierto), G = V.gasto;
    if (!v || !G) return;
    if (!G.fecha) { toast('Pon la fecha del gasto.', 'bad'); return; }
    if (!String(G.descripcion || '').trim()) { toast('Escribe la descripción.', 'bad'); return; }
    if (!(+G.valor > 0)) { toast('Pon el valor del gasto.', 'bad'); return; }
    await accion('viagasto', async () => {
      let ruta = null, nombre = null;
      if (V.archivo) {
        const { subidos } = await subirArchivos('viaticos', v.id, [V.archivo]);
        if (!subidos.length) throw new Error('No se pudo subir el soporte. Prueba con una foto o un PDF de menos de 10 MB.');
        ruta = subidos[0].ruta; nombre = subidos[0].nombre;
      }
      await q(sb.from('viatico_gastos').insert({ viatico_id: v.id, fecha: G.fecha, categoria: G.categoria, descripcion: G.descripcion.trim(), valor: Math.round(+G.valor), soporte_ruta: ruta, soporte_nombre: nombre }));
      V.gasto = { ...nuevoGastoVia(v), fecha: G.fecha, categoria: G.categoria };
      V.archivo = null;
      await cargarViaticos();
      toast(ruta ? 'Gasto agregado con su soporte.' : 'Gasto agregado (sin soporte).');
    });
    try { await firmarVia(v.id); } catch (e) { /* nada */ }
    render();
  }

  // ---------- Entrada temprana autorizada ----------
  const autorizadores = () => S.personas.filter((p) => p.activo && p.id !== P().id && (['gerente', 'directora', 'supervisor'].includes(p.rol) || p.es_admin))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  function turnoHoy() {
    const h = S.hoy, fila = h && h.semana.find((x) => x.fecha === h.fecha);
    return fila ? turno(fila.turno_id) : null;
  }
  function abrirAjuste() {
    const h = S.hoy, aj = h && h.ajuste, t = turnoHoy();
    if (!t || !conHorario(t)) return;
    const marcas = {};
    h.marcas.forEach((m) => { marcas[m.tipo] = m; });
    const antes = minAntesEntrada(t, marcas, miTz());
    const corrida = toMin(t.salida) - antes;
    let opcion = 'corre', salida = hm(corrida).padStart(5, '0');
    if (aj) {
      if (!aj.salida) opcion = 'igual';
      else if (toMin(aj.salida) !== corrida) { opcion = 'otra'; salida = hhmm(aj.salida).padStart(5, '0'); }
    }
    S.ajuste = { antes, corrida, opcion, salida, motivo: aj ? aj.motivo : '', autorizo: aj ? aj.autorizo : '' };
    render();
    const c = document.querySelector('.modal textarea');
    if (c) c.focus();
  }
  function ajusteView() {
    const A = S.ajuste, t = turnoHoy();
    if (!t) return '';
    const op = (v, txt) => `<label class="aj-op"><input type="radio" name="opcion" value="${v}" data-aj="opcion"${A.opcion === v ? ' checked' : ''}><span>${txt}</span></label>`;
    return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="aj-t">
        <form class="modal-caja" data-form="ajuste">
          <span class="eyebrow">Entrada temprana</span>
          <h2 id="aj-t">Entraste ${A.antes} min antes de tu turno</h2>
          <p class="hint">Si te dieron permiso, regístralo: así tu salida no cuenta como «salida antes» en el informe. Queda a la vista de tu líder y de quien autorizó.</p>
          <label class="field"><span>¿Por qué entraste más temprano?</span><textarea name="motivo" rows="2" maxlength="300" required data-aj="motivo" placeholder="Ej.: inventario, salida de un grupo, permiso para salir temprano">${esc(A.motivo)}</textarea></label>
          <fieldset class="aj-ops"><legend>¿Cambia tu hora de salida?</legend>
            ${op('corre', `Sí, salgo ${A.antes} min más temprano: a las <b>${hm(A.corrida)}</b>`)}
            ${op('otra', `Sí, a otra hora: <input type="time" name="salida" value="${esc(A.salida)}" data-aj="salida" aria-label="Nueva hora de salida">`)}
            ${op('igual', `No, salgo a la hora de siempre (${hhmm(t.salida)})`)}
          </fieldset>
          <label class="field"><span>¿Quién lo autorizó?</span><select name="autorizo" required data-aj="autorizo"><option value="">Elige una persona</option>${autorizadores().map((p) => `<option value="${p.id}"${A.autorizo === p.id ? ' selected' : ''}>${esc(p.nombre)} · ${esc(ROLES[p.rol] || '')}</option>`).join('')}</select></label>
          <div class="modal-acc">
            <button type="button" class="btn ghost" data-accion="cerrarAjuste">Ahora no</button>
            <button type="submit" class="btn"${ocupado('ajuste')}>${S.ocupado === 'ajuste' ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>`;
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
        <p class="hint">Quienes lideran una sede no revisan solicitudes por defecto. Asigna aquí a quien las revisa (por ejemplo, contabilidad).</p>
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

  // ---------- Informes de asistencia por periodo (panel de gerencia) ----------
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

  // Rango del informe: atajos (últimos días, trimestres, año, meses) o fechas libres.
  const MAX_DIAS_INFORME = 366;
  function rangosInforme() {
    const hoy = fechaEn(miTz()), ayer = sumarDias(hoy, -1);
    const y = +hoy.slice(0, 4), t = Math.floor((+hoy.slice(5, 7) - 1) / 3);
    const trim = (yy, tt) => { const m = `${yy}-${String(tt * 3 + 1).padStart(2, '0')}`; return [m + '-01', ultimoDia(`${yy}-${String(tt * 3 + 3).padStart(2, '0')}`)]; };
    const tAnt = t === 0 ? trim(y - 1, 3) : trim(y, t - 1);
    const fijos = [
      { id: 'd7', nombre: 'Últimos 7 días', desde: sumarDias(ayer, -6), hasta: ayer },
      { id: 'd30', nombre: 'Últimos 30 días', desde: sumarDias(ayer, -29), hasta: ayer },
      { id: 'd90', nombre: 'Últimos 90 días', desde: sumarDias(ayer, -89), hasta: ayer },
      { id: 'trim', nombre: 'Este trimestre', desde: trim(y, t)[0], hasta: trim(y, t)[1] },
      { id: 'trimant', nombre: 'Trimestre anterior', desde: tAnt[0], hasta: tAnt[1] },
      { id: 'anio', nombre: `Este año (${y})`, desde: `${y}-01-01`, hasta: `${y}-12-31` },
      { id: 'anioant', nombre: `Año ${y - 1}`, desde: `${y - 1}-01-01`, hasta: `${y - 1}-12-31` },
    ];
    const meses = mesesDisponibles().map((m) => ({ id: 'm:' + m, nombre: mesLargo(m), desde: m + '-01', hasta: ultimoDia(m) }));
    return { fijos, meses, todos: fijos.concat(meses) };
  }
  function ponerRango(I, id) {
    const r = rangosInforme().todos.find((x) => x.id === id);
    if (r) { I.rango = r.id; I.desde = r.desde; I.hasta = r.hasta; }
  }
  // Nombre legible del periodo: «noviembre 2026», «año 2025» o «3 nov al 21 dic 2026».
  function etiquetaRango(desde, hasta) {
    if (desde.slice(0, 7) === hasta.slice(0, 7) && desde.endsWith('-01') && hasta === ultimoDia(hasta.slice(0, 7))) return nombreMes(desde.slice(0, 7));
    if (desde.slice(0, 4) === hasta.slice(0, 4) && desde.endsWith('-01-01') && hasta.endsWith('-12-31')) return 'año ' + desde.slice(0, 4);
    if (desde === hasta) return `${fechaCorta(desde)} ${desde.slice(0, 4)}`;
    return desde.slice(0, 4) === hasta.slice(0, 4)
      ? `${fechaCorta(desde)} al ${fechaCorta(hasta)} ${hasta.slice(0, 4)}`
      : `${fechaCorta(desde)} ${desde.slice(0, 4)} al ${fechaCorta(hasta)} ${hasta.slice(0, 4)}`;
  }

  async function cargarInforme() {
    const I = S.inf;
    if (!I.desde || !I.hasta) {
      const ms = mesesDisponibles();
      ponerRango(I, 'm:' + (+fechaEn(miTz()).slice(8, 10) <= 5 ? ms[1] : ms[0]));
    }
    if (P().rol === 'directora' && !esGerencia()) I.sede = P().sede_id;
    const { desde, hasta } = I;
    const [malla, marcas, ausencias, ajustes, coms] = await Promise.all([
      mallaEfectiva(desde, hasta),
      todas(() => sb.from('marcas').select('*').gte('fecha', desde).lte('fecha', hasta).order('id')),
      q(sb.rpc('ausencias_aprobadas', { p_desde: desde, p_hasta: hasta })),
      cargarAjustes(desde, hasta),
      q(sb.from('comunicados').select('*').gte('creado', sumarDias(desde, -1) + 'T00:00:00').lte('creado', sumarDias(hasta, 2) + 'T00:00:00').order('creado')),
    ]);
    const enRango = coms.filter((c) => { const f = fechaEn(miTz(), new Date(c.creado)); return f >= desde && f <= hasta; });
    const lect = enRango.length ? await todas(() => sb.from('comunicado_lecturas').select('*').in('comunicado_id', enRango.map((c) => c.id)).order('comunicado_id')) : [];
    if (S.inf !== I || I.desde !== desde || I.hasta !== hasta) return; // llegó tarde: ya se pidió otro periodo
    I.datos = { desde, hasta, malla, marcas, ausencias, ajustes, coms: enRango, lect };
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
      const r = { p, jornadas: 0, tardes: 0, minTarde: 0, almLargos: 0, salidasAntes: 0, minAntes: 0, extraMin: 0, diasExtra: 0, ajustes: 0, sinMarcar: 0, conPermiso: 0, comSin: 0, dias: [], registro: [] };
      D.malla.filter((f) => f.persona_id === p.id && f.fecha < hoy).forEach((f) => {
        const t = turno(f.turno_id);
        if (!conHorario(t)) return;
        // Una línea por jornada para el detalle exportable
        const aj = ajusteDe(D.ajustes, p.id, f.fecha);
        const esperada = salidaEsperada(t, aj);
        const reg = { fecha: f.fecha, turno: t.nombre, entProg: hhmm(t.entrada), ent: '', tarde: 0, alm: '', salProg: hm(esperada), sal: '', difSal: '', adicional: '', ajuste: '', novedad: [] };
        r.registro.push(reg);
        const aus = D.ausencias.find((a) => a.persona_id === p.id && a.desde <= f.fecha && a.hasta >= f.fecha);
        if (aus) { r.conPermiso++; r.dias.push({ fecha: f.fecha, txt: TIPOS[aus.tipo].estado, cls: 'info' }); reg.novedad.push(TIPOS[aus.tipo].estado); return; }
        const m = (tipo) => marcas[p.id + '|' + f.fecha + '|' + tipo];
        const ent = m('entrada');
        if (!ent) { r.sinMarcar++; r.dias.push({ fecha: f.fecha, txt: 'Sin marcar', cls: 'bad' }); reg.novedad.push('Sin marcar entrada'); return; }
        r.jornadas++;
        reg.ent = horaDe(ent.hora, tz);
        const tarde = minDe(ent.hora, tz) - toMin(t.entrada);
        if (aj) {
          r.ajustes++;
          reg.ajuste = `${aj.salida ? `Salida a las ${hhmm(aj.salida)}` : 'Misma salida'} · ${aj.motivo} · autorizó ${nombreDe(aj.autorizo)}`;
          r.dias.push({ fecha: f.fecha, txt: aj.salida ? `Salida ajustada a ${hhmm(aj.salida)}` : 'Entrada temprana autorizada', cls: 'info' });
        }
        if (-tarde >= tl.temprano) reg.novedad.push(`Entró ${-tarde} min antes${aj ? ' (autorizado)' : ''}`);
        if (tarde > tl.entrada) {
          r.tardes++; r.minTarde += tarde; reg.tarde = tarde; reg.novedad.push(`Tarde ${tarde} min`);
          r.dias.push({ fecha: f.fecha, txt: `Tarde ${tarde} min`, cls: 'bad' });
          (porDia[f.fecha] = porDia[f.fecha] || []).push({ nombre: p.nombre, min: tarde });
        }
        const alm = m('salida_almuerzo'), reg2 = m('regreso_almuerzo');
        if (alm && reg2 && conAlmuerzo(t)) {
          const dur = minDe(reg2.hora, tz) - minDe(alm.hora, tz);
          reg.alm = dur;
          if (dur > toMin(t.regreso_almuerzo) - toMin(t.salida_almuerzo) + tl.almuerzo) { r.almLargos++; r.dias.push({ fecha: f.fecha, txt: `Almuerzo ${dur} min`, cls: 'warn' }); reg.novedad.push(`Almuerzo ${dur} min`); }
        }
        // La salida se mide igual que la entrada, contra la hora esperada (la del ajuste autorizado si lo hay)
        const sal = m('salida');
        if (sal) {
          const d = minDe(sal.hora, tz) - esperada;
          reg.sal = horaDe(sal.hora, tz); reg.difSal = d;
          if (d < 0) { r.salidasAntes++; r.minAntes += -d; r.dias.push({ fecha: f.fecha, txt: `Salió ${-d} min antes`, cls: 'warn' }); reg.novedad.push(`Salió ${-d} min antes`); }
          if (d > tl.salida) { r.extraMin += d; r.diasExtra++; reg.adicional = d; r.dias.push({ fecha: f.fecha, txt: `Se quedó ${d} min más`, cls: 'info' }); reg.novedad.push(`Se quedó ${d} min más`); }
        } else reg.novedad.push('Sin marcar salida');
      });
      r.comSin = D.coms.filter((c) => c.requiere_confirmacion && destinatarios(c).some((x) => x.id === p.id) && !D.lect.some((l) => l.comunicado_id === c.id && l.persona_id === p.id)).length;
      r.puntualidad = r.jornadas ? ((r.jornadas - r.tardes) / r.jornadas) * 100 : null;
      r.dias.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
      return r;
    }).filter((r) => r.jornadas || r.sinMarcar || r.conPermiso);
    const tot = filas.reduce((a, r) => {
      ['jornadas', 'tardes', 'minTarde', 'almLargos', 'salidasAntes', 'minAntes', 'extraMin', 'diasExtra', 'ajustes', 'sinMarcar', 'conPermiso'].forEach((k) => { a[k] += r[k]; });
      return a;
    }, { jornadas: 0, tardes: 0, minTarde: 0, almLargos: 0, salidasAntes: 0, minAntes: 0, extraMin: 0, diasExtra: 0, ajustes: 0, sinMarcar: 0, conPermiso: 0 });
    tot.puntualidad = tot.jornadas ? ((tot.jornadas - tot.tardes) / tot.jornadas) * 100 : null;
    return { filas, tot, porDia };
  }

  const pct1 = (v) => (v == null ? '—' : `${v.toFixed(1).replace('.', ',')} %`);

  // Tramos de la gráfica según el largo del periodo: por día (hasta 2 meses), por semana (hasta ~6 meses) o por mes.
  function tramosInforme(desde, hasta) {
    const n = diasEntre(desde, hasta) + 1;
    const out = [];
    if (n <= 62) {
      let prevMes = '';
      for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
        const marca = d === desde || diaSemana(d) === 1;
        out.push({ desde: d, hasta: d, txt: marca ? (d.slice(0, 7) !== prevMes ? fechaCorta(d) : String(+d.slice(8, 10))) : '' });
        if (marca) prevMes = d.slice(0, 7);
      }
      return { por: 'día', tramos: out, hint: 'Etiquetas: el primer día y cada lunes.' };
    }
    if (n <= 190) {
      const cada = n <= 120 ? 2 : 3;
      for (let d = lunesDe(desde), i = 0; d <= hasta; d = sumarDias(d, 7), i++) {
        const a = d < desde ? desde : d, z = sumarDias(d, 6) > hasta ? hasta : sumarDias(d, 6);
        out.push({ desde: a, hasta: z, txt: i % cada === 0 ? fechaCorta(a) : '' });
      }
      return { por: 'semana', tramos: out, hint: 'Cada barra es una semana (de lunes a domingo).' };
    }
    for (let m = desde.slice(0, 7); m <= hasta.slice(0, 7); m = sumarDias(ultimoDia(m), 1).slice(0, 7)) {
      const a = m + '-01' < desde ? desde : m + '-01', z = ultimoDia(m) > hasta ? hasta : ultimoDia(m);
      out.push({ desde: a, hasta: z, txt: MESES[+m.slice(5, 7) - 1].slice(0, 3) });
    }
    return { por: 'mes', tramos: out, hint: 'Cada barra es un mes.' };
  }
  function tardesEn(porDia, desde, hasta) {
    let n = 0;
    Object.keys(porDia).forEach((d) => { if (d >= desde && d <= hasta) n += porDia[d].length; });
    return n;
  }

  function graficaDias(porDia) {
    const I = S.inf, G = tramosInforme(I.desde, I.hasta), tr = G.tramos;
    const vals = tr.map((x) => tardesEn(porDia, x.desde, x.hasta));
    const max = Math.max(0, ...vals);
    const paso = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : max <= 125 ? 25 : 50;
    const tope = Math.max(paso, Math.ceil(max / paso) * paso);
    const W = 720, H = 220, L = 32, R = 8, T = 12, B = 30;
    const bw = (W - L - R) / tr.length;
    const y = (v) => T + (H - T - B) * (1 - v / tope);
    let svg = '';
    for (let v = 0; v <= tope; v += paso) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="g"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="t">${v}</text>`;
    tr.forEach((x0, i) => {
      const v = vals[i], x = L + i * bw, rango = `data-dia="${x0.desde}" data-hasta="${x0.hasta}"`;
      if (v) svg += `<rect x="${x + bw * 0.18}" y="${y(v)}" width="${bw * 0.64}" height="${y(0) - y(v)}" rx="2" class="b" ${rango}/>`;
      svg += `<rect x="${x}" y="${T}" width="${bw}" height="${H - T - B}" class="hit" ${rango}/>`;
      if (x0.txt) svg += `<text x="${x + bw / 2}" y="${H - 10}" text-anchor="middle" class="t">${esc(x0.txt)}</text>`;
    });
    return `<div class="chartbox"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Llegadas tarde por ${G.por}, ${esc(etiquetaRango(I.desde, I.hasta))}, máximo ${max}">${svg}</svg><div class="tip" id="tip" hidden></div></div>
      <p class="hint">${G.hint} Pasa el cursor sobre una barra para ver quién llegó tarde.</p>`;
  }

  function opcionesRango(sel) {
    const R = rangosInforme(), o = (r) => `<option value="${r.id}"${r.id === sel ? ' selected' : ''}>${esc(r.nombre)}</option>`;
    return `${sel === 'libre' ? '<option value="libre" selected>Fechas personalizadas</option>' : ''}<optgroup label="Rápidos">${R.fijos.map(o).join('')}</optgroup><optgroup label="Meses">${R.meses.map(o).join('')}</optgroup>`;
  }

  function informesView() {
    const I = S.inf;
    if (!I.datos) return cargandoBloque();
    const { filas, tot, porDia } = calcularInforme();
    const m = meta();
    const sedes = S.sedes.filter((s) => lideraSede(s.id));
    const directora = P().rol === 'directora' && !esGerencia();
    const filtros = `<div class="filters">
        <label class="field inline"><span>Periodo</span><select data-inf="rango">${opcionesRango(I.rango)}</select></label>
        <span class="inf-fechas"><label class="field inline"><span>Desde</span><input type="date" data-inf="desde" value="${esc(I.desde)}" max="${esc(I.hasta)}"></label>
        <label class="field inline"><span>Hasta</span><input type="date" data-inf="hasta" value="${esc(I.hasta)}" min="${esc(I.desde)}"></label></span>
        ${variasSedes() ? `<label class="field inline"><span>Sede</span><select data-inf="sede"${directora ? ' disabled' : ''}>${directora ? '' : '<option value="todas">Todas</option>'}${sedes.map((s) => `<option value="${s.id}"${String(I.sede) === String(s.id) ? ' selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select></label>` : ''}
        <label class="field inline"><span>Área</span><select data-inf="area"><option value="todas">Todas</option>${S.areas.map((a) => `<option value="${a.id}"${String(I.area) === String(a.id) ? ' selected' : ''}>${esc(a.nombre)}</option>`).join('')}</select></label>
        <button type="button" class="btn ghost sm" data-accion="exportar">${ico('descargar')}Exportar resumen</button>
        <button type="button" class="btn ghost sm" data-accion="exportarDetalle">${ico('descargar')}Detalle por día</button>
      </div>`;
    const nDias = diasEntre(I.desde, I.hasta) + 1;
    const hoyInf = fechaEn(miTz());
    const enCurso = I.hasta >= hoyInf ? ` Periodo en curso: cuenta hasta ayer (${esc(fechaCorta(sumarDias(hoyInf, -1)))}).` : '';
    const titulo = /^(\d|año)/.test(etiquetaRango(I.desde, I.hasta)) ? `Informe del <em>${esc(etiquetaRango(I.desde, I.hasta))}</em>` : `Informe de <em>${esc(etiquetaRango(I.desde, I.hasta))}</em>`;
    const cab = encabezado('Panel de gerencia', titulo, `${plural(nDias, 'día', 'días')} (${esc(fechaCorta(I.desde))} – ${esc(fechaCorta(I.hasta))}). Solo cuentan días cerrados con turno con horario.${enCurso} Tolerancias: ${tol().entrada} min en la entrada, ${tol().almuerzo} en el almuerzo y ${tol().salida} en la salida (después de eso cuenta como tiempo adicional).`, filtros);
    if (!filas.length) return cab + `<p class="vacio card">No hay jornadas cerradas para estos filtros.</p>`;
    const nivel = tot.puntualidad == null ? 'mute' : tot.puntualidad >= m ? 'ok' : tot.puntualidad >= m - 10 ? 'warn' : 'bad';
    const k = (n, txt, sub) => `<div class="kpi"><b>${n}</b><span>${txt}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const kpis = `<div class="kpis six">
        <div class="kpi hero ${nivel}"><span>Puntualidad</span><b>${pct1(tot.puntualidad)}</b>
          <div class="meter ${nivel}" role="img" aria-label="Meta ${m} %"><span style="width:${Math.min(100, tot.puntualidad || 0)}%"></span><i style="left:${m}%"></i></div>
          <small>Meta ${m} % · ${plural(tot.jornadas, 'jornada', 'jornadas')}</small></div>
        ${k(tot.tardes, 'Llegadas tarde', `${tot.minTarde} min en total`)}
        ${k(tot.almLargos, 'Almuerzos largos')}
        ${k(tot.salidasAntes, 'Salidas antes', `${tot.minAntes} min en total`)}
        ${k(tot.sinMarcar, 'Jornadas sin marcar')}
        ${k(tot.conPermiso, 'Ausencias con permiso')}
        ${k(hm(tot.extraMin), 'Tiempo adicional', `${plural(tot.diasExtra, 'jornada', 'jornadas')} · después de la salida`)}
      </div>`;
    const rank = filas.filter((r) => r.minTarde > 0).sort((a, b) => b.minTarde - a.minTarde).slice(0, 8);
    const maxR = rank.length ? rank[0].minTarde : 1;
    const sel = I.sel && filas.find((r) => r.p.id === I.sel);
    const ranking = `<section class="card"><div class="sec-h"><h2>¿Quién llegó más tarde?</h2></div>
        ${rank.length ? `<ol class="rank">${rank.map((r) => `<li><button type="button" data-selinf="${r.p.id}" aria-pressed="${I.sel === r.p.id}"><span class="rank-n">${esc(r.p.nombre)}</span><span class="rank-bar"><span style="width:${(r.minTarde / maxR) * 100}%"></span></span><span class="rank-v">${r.minTarde} min · ${r.tardes}×</span></button></li>`).join('')}</ol>` : '<p class="vacio">Nadie llegó tarde en este periodo.</p>'}
        ${sel ? `<div class="detail"><div class="sec-h"><h3>${esc(sel.p.nombre)}</h3><button type="button" class="btn txt sm" data-selinf="">${ico('x')}Cerrar</button></div>
            <p class="hint">${plural(sel.jornadas, 'jornada', 'jornadas')} · puntualidad ${pct1(sel.puntualidad)} · ${sel.tardes} tardes (${sel.minTarde} min) · ${hm(sel.extraMin)} adicional · ${sel.sinMarcar} sin marcar · ${sel.conPermiso} con permiso${sel.ajustes ? ` · ${plural(sel.ajustes, 'horario ajustado', 'horarios ajustados')}` : ''}</p>
            ${sel.dias.length ? `<ul class="chips-dia">${sel.dias.map((d) => `<li><small>${esc(fechaCorta(d.fecha))}</small><span class="chip ${d.cls} xs">${esc(d.txt)}</span></li>`).join('')}</ul>` : '<p class="vacio">Sin novedades en este periodo.</p>'}</div>` : '<p class="hint">Toca un nombre para ver el detalle por día.</p>'}
      </section>`;
    const cols = [['nombre', 'Persona'], ['jornadas', 'Jornadas'], ['tardes', 'Tardes'], ['minTarde', 'Min. tarde'], ['almLargos', 'Alm. largos'], ['salidasAntes', 'Salidas antes'], ['extraMin', 'Adicional'], ['sinMarcar', 'Sin marcar'], ['conPermiso', 'Permiso'], ['comSin', 'Sin confirmar'], ['puntualidad', 'Puntualidad']];
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
    const listaAj = (I.datos.ajustes || []).filter((a) => personas2(persona(a.persona_id) || {}) && a.fecha >= I.desde && a.fecha <= I.hasta)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
    const ajustesSec = listaAj.length ? `<section class="card"><div class="sec-h"><h2>Horarios ajustados</h2><span class="hint">Entradas tempranas con permiso: la salida se mide contra la hora autorizada</span></div>
        <div class="tablewrap"><table class="rep aj-tabla"><thead><tr><th scope="col">Fecha</th><th scope="col">Persona</th><th scope="col">Salida</th><th scope="col">Autorizó</th><th scope="col">Motivo</th></tr></thead>
        <tbody>${listaAj.map((a) => `<tr><td>${esc(fechaCorta(a.fecha))}</td><th scope="row">${esc(nombreDe(a.persona_id))}</th><td>${a.salida ? esc(hhmm(a.salida)) : 'La de siempre'}</td><td>${esc(nombreDe(a.autorizo))}</td><td>${esc(a.motivo)}</td></tr>`).join('')}</tbody></table></div></section>` : '';
    function personas2(p) { return lideraSede(p.sede_id) && (I.sede === 'todas' || String(p.sede_id) === String(I.sede)) && (I.area === 'todas' || String(p.area_id) === String(I.area)); }
    return cab + kpis
      + `<div class="grid-rep">
          <section class="card"><div class="sec-h"><h2>Llegadas tarde por ${tramosInforme(I.desde, I.hasta).por}</h2></div>${graficaDias(porDia)}</section>
          ${ranking}
        </div>`
      + tabla + ajustesSec + conf;
  }

  // Exporta el informe a CSV para Excel. tipo: 'resumen' (una fila por persona) o 'detalle' (una fila por jornada).
  function exportarInforme(tipo) {
    if (CFG.sinDescargas) { toast('En esta vista previa no se descargan archivos. En la intranet publicada, este botón baja el CSV para Excel.', 'warn'); return; }
    const { filas } = calcularInforme();
    // Textos que empiezan con = + - @ se anteponen con ' para que Excel no los tome como fórmula
    const celda = (v) => { let s = String(v == null ? '' : v); if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = "'" + s; return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const base = (r) => [r.p.nombre, r.p.correo, (sedeDe(r.p.sede_id) || {}).nombre || '', (areaDe(r.p.area_id) || {}).nombre || ''];
    let cab, datos;
    if (tipo === 'detalle') {
      cab = ['Fecha', 'Día', 'Persona', 'Correo', 'Sede', 'Área', 'Turno', 'Entrada programada', 'Entrada marcada', 'Minutos tarde', 'Almuerzo (min)', 'Salida esperada', 'Salida marcada', 'Diferencia salida (min)', 'Tiempo adicional (min)', 'Horario ajustado', 'Novedades'];
      datos = [];
      filas.forEach((r) => r.registro.forEach((g) => datos.push([g.fecha, DIAS_LARGOS[diaSemana(g.fecha) - 1], ...base(r), g.turno, g.entProg, g.ent, g.tarde || '', g.alm, g.salProg, g.sal, g.difSal, g.adicional, g.ajuste, g.novedad.join(' · ') || 'Al día'])));
      datos.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[2].localeCompare(y[2], 'es')));
    } else {
      cab = ['Persona', 'Correo', 'Sede', 'Área', 'Jornadas', 'Llegadas tarde', 'Minutos tarde', 'Promedio tarde (min)', 'Almuerzos largos', 'Salidas antes', 'Minutos salida antes', 'Jornadas con tiempo adicional', 'Tiempo adicional (min)', 'Horarios ajustados', 'Sin marcar', 'Con permiso', 'Comunicados sin confirmar', 'Puntualidad %'];
      datos = filas.map((r) => [
        ...base(r),
        r.jornadas, r.tardes, r.minTarde, r.tardes ? (r.minTarde / r.tardes).toFixed(1).replace('.', ',') : '0',
        r.almLargos, r.salidasAntes, r.minAntes, r.diasExtra, r.extraMin, r.ajustes, r.sinMarcar, r.conPermiso, r.comSin,
        r.puntualidad == null ? '' : r.puntualidad.toFixed(1).replace('.', ','),
      ]);
    }
    const I = S.inf;
    const lineas = [`Periodo;${celda(etiquetaRango(I.desde, I.hasta))};Desde;${I.desde};Hasta;${I.hasta}`, '', cab.join(';')].concat(datos.map((f) => f.map(celda).join(';')));
    const sede = I.sede !== 'todas' ? '-' + nombreArchivo((sedeDe(+I.sede) || {}).nombre || '') : '';
    const blob = new Blob(['\ufeff' + lineas.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `asistencia-${tipo === 'detalle' ? 'detalle-' : ''}${I.desde}_a_${I.hasta}${sede}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Archivo descargado. Ábrelo con Excel.');
  }


  // ---------- Informes de gestión (ventas del gestor de reservas) ----------
  // Las ventas llegan resumidas desde la hoja de AppSheet (informes/Codigo.gs).
  // Todo el tablero sale de las mismas filas filtradas: cambiar un filtro, o
  // tocar una barra, una columna o un estado, cambia todas las gráficas.
  // Cada gráfica ignora su propio filtro para seguir mostrando las demás
  // opciones (la elegida queda resaltada), como en Power BI.
  const GES_ESTADOS = [
    { id: 'Cotizado', color: '#2A78D6' },
    { id: 'Confirmada', color: '#1BAF7A' },
    { id: 'Facturado', color: '#6250D6' },
    { id: 'Cancelada', color: '#EB6834' },
  ];
  const GES_EFECTIVAS = ['Confirmada', 'Facturado'];
  const GES_VIAJE = { Nacional: '#2A78D6', Internacional: '#EDA100' };
  const GES_DIM = { asesora: 'Asesora', estado: 'Estado', tipo_venta: 'Tipo de venta', tipo_viaje: 'Tipo de viaje', destino: 'Destino', plan: 'Plan', seguimiento: 'Seguimiento' };
  const GES_MEDIDAS = { valor: 'Valor', cantidad: 'Ventas', utilidad: 'Utilidad' };
  const SIN_DATO = 'Sin dato';
  const gesEfectiva = (r) => GES_EFECTIVAS.includes(r.estado);
  const gesMes = (r) => r.fecha.slice(0, 7);
  const gesVal = (r, k) => r[k] || SIN_DATO;
  const colorEstado = (e) => (GES_ESTADOS.find((x) => x.id === e) || { color: '#8A8F9C' }).color;
  const mesSig = (m) => { let [y, n] = m.split('-').map(Number); n++; if (n > 12) { n = 1; y++; } return `${y}-${String(n).padStart(2, '0')}`; };
  const mesAnt = (m) => { let [y, n] = m.split('-').map(Number); n--; if (n < 1) { n = 12; y--; } return `${y}-${String(n).padStart(2, '0')}`; };
  const mesCorto = (m) => { const t = MESES[+m.slice(5, 7) - 1]; return t.charAt(0).toUpperCase() + t.slice(1, 3); };
  const mesLargo = (m) => { const t = nombreMes(m); return t.charAt(0).toUpperCase() + t.slice(1); };
  const num1 = (x) => x.toLocaleString('es-CO', { maximumFractionDigits: x >= 100 ? 0 : 1 });
  function plataCorta(v) {
    const a = Math.abs(v), s = v < 0 ? '−' : '';
    if (a >= 1e9) return `${s}$${num1(a / 1e9)} mil M`;
    if (a >= 1e6) return `${s}$${num1(a / 1e6)} M`;
    if (a >= 1e4) return `${s}$${Math.round(a / 1e3).toLocaleString('es-CO')} mil`;
    return s + plata(a);
  }
  const pctTxt = (x, dec) => (x == null || !isFinite(x) ? '—' : `${(x * 100).toLocaleString('es-CO', { maximumFractionDigits: dec == null ? 1 : dec })} %`);
  const gesMed = (lista) => {
    const m = S.ges.medida;
    if (m === 'cantidad') return lista.length;
    if (m === 'utilidad') return lista.reduce((s, r) => s + (gesEfectiva(r) ? r.valor - r.costo : 0), 0);
    return lista.reduce((s, r) => s + r.valor, 0);
  };
  const gesFmt = (v) => (S.ges.medida === 'cantidad' ? v.toLocaleString('es-CO') : plataCorta(v));
  const gesNombreMedida = () => ({ valor: 'valor vendido', cantidad: 'número de ventas', utilidad: 'utilidad realizada' })[S.ges.medida];

  async function cargarGestion() {
    const [filas, estado] = await Promise.all([
      q(sb.from('ventas_informe').select('*').order('fecha', { ascending: true })),
      q(sb.from('ventas_estado').select('*')),
    ]);
    S.ges.filas = (filas || []).map((f) => Object.assign({}, f, {
      valor: +f.valor || 0, costo: +f.costo || 0, cobrado: +f.cobrado || 0, pagado_prov: +f.pagado_prov || 0, pasajeros: +f.pasajeros || 0,
      servicios: Array.isArray(f.servicios) ? f.servicios : [], proveedores: Array.isArray(f.proveedores) ? f.proveedores : [],
    }));
    S.ges.estado = (estado || [])[0] || null;
    S.ges.cargado = new Date();
    try { await cargarCuentasCobro(); } catch (e) { S.ges.cc.datos = null; }
    if (S.ges.mes && !gesMeses().includes(S.ges.mes)) S.ges.mes = '';
    suscribirGestion();
  }

  // Tiempo real: cuando el script termina una sincronización, la pantalla se recarga sola
  let canalGes = null, gesEspera = null;
  function suscribirGestion() {
    if (canalGes || !sb.channel) return;
    canalGes = sb.channel('informes-gestion');
    canalGes.on('postgres_changes', { event: '*', schema: 'public', table: 'ventas_estado' }, () => {
      clearTimeout(gesEspera);
      gesEspera = setTimeout(recargarGestion, 600);
    });
    canalGes.on('postgres_changes', { event: '*', schema: 'public', table: 'cuentas_cobro' }, () => {
      clearTimeout(gesEspera);
      gesEspera = setTimeout(recargarGestion, 600);
    });
    canalGes.subscribe((estado) => {
      S.ges.vivo = estado === 'SUBSCRIBED';
      const v = document.getElementById('ges-vivo');
      if (v) v.outerHTML = vivoGes();
    });
  }
  function soltarGestion() {
    if (canalGes && sb && sb.removeChannel) sb.removeChannel(canalGes);
    canalGes = null;
    clearTimeout(gesEspera);
  }
  async function recargarGestion() {
    if (S.view !== 'gestion' || S.cargandoVista) return;
    if (S.ocupado) { gesEspera = setTimeout(recargarGestion, 500); return; }
    try { await cargarGestion(); } catch (e) { return; }
    if (S.view === 'gestion') render();
  }
  function haceTxt(ts) {
    const min = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${plural(min, 'minuto', 'minutos')}`;
    const h = Math.round(min / 60);
    if (h < 48) return `hace ${plural(h, 'hora', 'horas')}`;
    return `hace ${plural(Math.round(h / 24), 'día', 'días')}`;
  }
  const gesViejo = () => { const e = S.ges.estado; return !!(e && e.sincronizado && Date.now() - new Date(e.sincronizado).getTime() > 26 * 3600000); };
  // Hay una actualización pedida con el botón que todavía no llega (máximo 15 minutos)
  const gesActualizando = () => {
    const e = S.ges.estado;
    if (!e || !e.solicitado) return false;
    const pedido = new Date(e.solicitado).getTime();
    return Date.now() - pedido < 15 * 60000 && (!e.sincronizado || new Date(e.sincronizado).getTime() < pedido);
  };
  function vivoGes() {
    const e = S.ges.estado, sinc = e && e.sincronizado;
    if (gesActualizando()) {
      return `<span id="ges-vivo" class="vivo on trabajando" title="El agente de Claude está leyendo el gestor de reservas. Tarda unos minutos; la pantalla se recarga sola al terminar.">Actualizando desde el gestor de reservas…</span>`;
    }
    const txt = sinc ? `Gestor de reservas · ${haceTxt(sinc)}` : 'Aún sin sincronizar';
    const t = sinc ? `Última sincronización: ${fechaHora(sinc, miTz())}. Se actualiza sola todos los días desde el gestor de reservas.` : 'Aún no llegan datos del gestor de reservas.';
    return `<span id="ges-vivo" class="vivo${S.ges.vivo && !gesViejo() ? ' on' : ''}" title="${esc(t)}">${esc(txt)}</span>`;
  }
  setInterval(() => {
    const v = document.getElementById('ges-vivo');
    if (v) v.outerHTML = vivoGes();
    // Mientras el agente trabaja, se revisa cada 30 s por si el aviso en vivo no llega
    if (S.view === 'gestion' && gesActualizando()) recargarGestion();
  }, 30000);

  // ---------- Cálculos ----------
  // Filas que pasan todos los filtros menos «excepto» (la dimensión de la gráfica que las pide)
  function gesFiltrar(excepto) {
    const G = S.ges, F = G.f;
    return G.filas.filter((r) => (excepto === 'mes' || !G.mes || gesMes(r) === G.mes)
      && Object.keys(F).every((k) => k === excepto || !F[k] || gesVal(r, k) === F[k]));
  }
  function gesMeses() {
    const ms = S.ges.filas.map(gesMes).sort();
    const out = [];
    if (!ms.length) return out;
    for (let m = ms[0]; m <= ms[ms.length - 1] && out.length < 120; m = mesSig(m)) out.push(m);
    return out;
  }
  function gesKpi(rows) {
    const k = { n: rows.length, valor: 0, nEf: 0, valorEf: 0, util: 0, costoEf: 0, cobrado: 0, pax: 0, nCanc: 0, valorCanc: 0, nCot: 0, pagadoProv: 0 };
    rows.forEach((r) => {
      k.valor += r.valor;
      if (gesEfectiva(r)) { k.nEf++; k.valorEf += r.valor; k.util += r.valor - r.costo; k.costoEf += r.costo; k.cobrado += r.cobrado; k.pax += r.pasajeros; k.pagadoProv += r.pagado_prov; }
      if (r.estado === 'Cancelada') { k.nCanc++; k.valorCanc += r.valor; }
      if (r.estado === 'Cotizado') k.nCot++;
    });
    k.margen = k.valorEf ? k.util / k.valorEf : null;
    k.conv = k.n ? k.nEf / k.n : null;
    k.ticket = k.nEf ? k.valorEf / k.nEf : null;
    k.porCobrar = Math.max(0, k.valorEf - k.cobrado);
    k.porPagar = Math.max(0, k.costoEf - k.pagadoProv);
    return k;
  }
  function gesAgrupar(rows, campo) {
    const m = new Map();
    rows.forEach((r) => {
      const k = gesVal(r, campo);
      if (!m.has(k)) m.set(k, { k, filas: [] });
      m.get(k).filas.push(r);
    });
    return [...m.values()].map((g) => Object.assign(g, { v: gesMed(g.filas), kpi: gesKpi(g.filas) }));
  }

  // ---------- Piezas del tablero ----------
  const gesTip = (lineas) => esc(lineas.filter((x) => x != null && x !== '').join('\n'));
  const gesTarjeta = (titulo, sub, cuerpo, cls, extra) => `<section class="gcard${cls ? ' ' + cls : ''}"><header><div><h2>${titulo}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${extra || ''}</header>${cuerpo}</section>`;
  const gesVacio = (txt) => `<p class="gvacio">${esc(txt || 'Sin ventas con estos filtros.')}</p>`;

  // Indicador: valor grande, comparación con el mes anterior y la tendencia de los meses
  function gesIndicador(o) {
    const G = S.ges, meses = gesMeses(), serie = meses.map((m) => o.de(gesKpi(gesFiltrar('mes').filter((r) => gesMes(r) === m))));
    let delta = '';
    if (G.mes && meses.indexOf(G.mes) > 0) {
      const ant = serie[meses.indexOf(G.mes) - 1], act = serie[meses.indexOf(G.mes)];
      if (ant != null && act != null) {
        const d = o.puntos ? (act - ant) * 100 : ant ? (act - ant) / Math.abs(ant) * 100 : null;
        if (d != null && isFinite(d)) {
          const sube = d > 0.05, baja = d < -0.05;
          delta = `<small class="gk-delta ${sube ? 'up' : baja ? 'down' : 'flat'}">${sube ? '▲' : baja ? '▼' : '='} ${Math.abs(d).toLocaleString('es-CO', { maximumFractionDigits: 1 })}${o.puntos ? ' pts' : ' %'} <span>vs ${mesCorto(mesAnt(G.mes)).toLowerCase()}</span></small>`;
        }
      }
    }
    let chispa = '';
    const vals = serie.map((v) => v || 0);
    if (vals.length > 1) {
      const max = Math.max(...vals), min = Math.min(0, ...vals), w = 120, h = 30, rango = (max - min) || 1;
      const pts = vals.map((v, i) => [i / (vals.length - 1) * w, h - 3 - ((v - min) / rango) * (h - 6)]);
      const i = G.mes ? meses.indexOf(G.mes) : vals.length - 1;
      chispa = `<div class="gk-chispa"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
          ${i >= 0 ? `<i style="left:${(pts[i][0] / w * 100).toFixed(1)}%;top:${(pts[i][1] / h * 100).toFixed(1)}%"></i>` : ''}</div>`;
    }
    const tip = gesTip([o.titulo, ...meses.map((m, j) => `${mesLargo(m)}: ${serie[j] == null ? '—' : o.fmt(serie[j])}`)]);
    return `<div class="gk${o.hero ? ' hero' : ''}" data-tip="${tip}"><span class="gk-t">${o.titulo}</span><b>${o.valor}</b><small class="gk-s">${o.sub}</small>${delta}${chispa}</div>`;
  }

  // Columnas apiladas por estado, una por mes (tocar una columna filtra ese mes)
  function gesColumnas() {
    const G = S.ges, rows = gesFiltrar('mes'), meses = gesMeses();
    const estados = GES_ESTADOS.map((e) => e.id).concat([...new Set(rows.map((r) => r.estado))].filter((e) => !GES_ESTADOS.some((x) => x.id === e)));
    const datos = meses.map((m) => {
      const rs = rows.filter((r) => gesMes(r) === m);
      const seg = estados.map((e) => ({ e, v: Math.max(0, gesMed(rs.filter((r) => r.estado === e))) })).filter((s) => s.v > 0);
      return { m, seg, total: seg.reduce((s, x) => s + x.v, 0), n: rs.length };
    });
    const max = Math.max(...datos.map((d) => d.total), 0);
    if (!max) return gesVacio();
    const paso = pasoBonito(max / 4), tope = Math.ceil(max / paso) * paso;
    const lineas = [];
    for (let v = 0; v <= tope + 1e-9; v += paso) lineas.push(v);
    const presentes = estados.filter((e) => datos.some((d) => d.seg.some((s) => s.e === e)));
    return `<div class="gcol" role="group" aria-label="Ventas por mes">
        <div class="gcol-ejes" aria-hidden="true">${lineas.map((v) => `<span style="bottom:${(v / tope * 100).toFixed(2)}%"><em>${gesFmt(v)}</em></span>`).join('')}</div>
        <div class="gcol-plot">${datos.map((d) => {
          const on = G.mes === d.m, off = G.mes && !on;
          const tip = gesTip([mesLargo(d.m), `${plural(d.n, 'venta registrada', 'ventas registradas')}`, ...d.seg.map((s) => `${s.e}: ${gesFmt(s.v)}`), d.seg.length > 1 ? `Total: ${gesFmt(d.total)}` : '']);
          return `<button type="button" class="gcol-m${off ? ' off' : ''}" data-gmesf="${d.m}" aria-pressed="${on}" data-tip="${tip}">
              <span class="gcol-area"><span class="gcol-pila" style="height:${(d.total / tope * 100).toFixed(2)}%">${d.seg.map((s) => `<i style="flex-grow:${s.v};background:${colorEstado(s.e)}"></i>`).join('')}</span>
              ${d.total ? `<em class="gcol-v" style="bottom:${(d.total / tope * 100).toFixed(2)}%">${gesFmt(d.total)}</em>` : ''}</span>
              <span class="gcol-l">${mesCorto(d.m)}${meses.length > 12 || meses[0].slice(0, 4) !== meses[meses.length - 1].slice(0, 4) ? ` <small>${d.m.slice(2, 4)}</small>` : ''}</span>
            </button>`;
        }).join('')}</div>
      </div>
      <div class="gleyenda">${presentes.map((e) => `<button type="button" data-gfiltro="estado" data-gvalor="${esc(e)}" aria-pressed="${G.f.estado === e}"${G.f.estado && G.f.estado !== e ? ' class="off"' : ''}><i style="background:${colorEstado(e)}"></i>${esc(e)}</button>`).join('')}</div>`;
  }
  function pasoBonito(x) {
    if (x <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  // Dona de estados con la leyenda al lado (tocar un estado filtra)
  function gesDona() {
    const G = S.ges, rows = gesFiltrar('estado');
    const grupos = gesAgrupar(rows, 'estado').map((g) => Object.assign(g, { v: Math.max(0, g.v) }));
    const orden = (e) => { const i = GES_ESTADOS.findIndex((x) => x.id === e); return i < 0 ? 99 : i; };
    grupos.sort((a, b) => orden(a.k) - orden(b.k));
    const total = grupos.reduce((s, g) => s + g.v, 0);
    if (!total) return gesVacio();
    const R = 70, C = 2 * Math.PI * R, conDatos = grupos.filter((g) => g.v > 0), hueco = conDatos.length > 1 ? 2 : 0;
    let ac = 0;
    const arcos = conDatos.map((g) => {
      const largo = g.v / total * C, on = G.f.estado === g.k, off = G.f.estado && !on;
      const a = `<circle cx="90" cy="90" r="${R}" fill="none" stroke="${colorEstado(g.k)}" stroke-width="${on ? 26 : 22}" stroke-dasharray="${Math.max(0, largo - hueco).toFixed(2)} ${(C - largo + hueco).toFixed(2)}" stroke-dashoffset="${(-ac).toFixed(2)}" class="${off ? 'off' : ''}" data-gfiltro="estado" data-gvalor="${esc(g.k)}" data-tip="${gesTip([g.k, `${pctTxt(g.v / total)} del ${gesNombreMedida()}`, gesFmt(g.v), plural(g.filas.length, 'venta', 'ventas')])}"/>`;
      ac += largo;
      return a;
    }).join('');
    const sel = G.f.estado && grupos.find((g) => g.k === G.f.estado);
    return `<div class="gdona">
        <div class="gdona-g"><svg viewBox="0 0 180 180" role="img" aria-label="Ventas por estado"><g transform="rotate(-90 90 90)">${arcos}</g></svg>
          <div class="gdona-c"><b>${gesFmt(sel ? sel.v : total)}</b><span>${esc(sel ? sel.k : { valor: 'valor total', cantidad: 'ventas', utilidad: 'utilidad' }[G.medida])}</span></div></div>
        <ul class="gdona-l">${grupos.map((g) => {
          const on = G.f.estado === g.k;
          return `<li><button type="button" data-gfiltro="estado" data-gvalor="${esc(g.k)}" aria-pressed="${on}"${G.f.estado && !on ? ' class="off"' : ''}>
              <i style="background:${colorEstado(g.k)}"></i><span>${esc(g.k)}</span><b>${pctTxt(g.v / total, 0)}</b><small>${gesFmt(g.v)} · ${g.filas.length}</small></button></li>`;
        }).join('')}</ul>
      </div>`;
  }

  // Barras horizontales de una dimensión (tocar una barra filtra)
  function gesBarras(dim, o) {
    o = o || {};
    const G = S.ges, max = o.max || 8;
    let grupos = gesAgrupar(o.filas || gesFiltrar(dim), dim).filter((g) => g.v !== 0 || G.medida === 'cantidad');
    grupos.sort((a, b) => b.v - a.v || a.k.localeCompare(b.k));
    if (G.f[dim] && !grupos.some((g) => g.k === G.f[dim])) grupos.unshift({ k: G.f[dim], v: 0, filas: [], kpi: gesKpi([]) });
    if (grupos.length > max) {
      const resto = grupos.slice(max - 1).filter((g) => g.k !== G.f[dim]);
      const fijo = grupos.slice(0, max - 1).concat(grupos.slice(max - 1).filter((g) => g.k === G.f[dim]));
      const filas = [].concat(...resto.map((g) => g.filas));
      grupos = fijo.concat([{ k: `Otros (${resto.length})`, otros: true, v: resto.reduce((s, g) => s + g.v, 0), filas, kpi: gesKpi(filas) }]);
    }
    if (!grupos.length) return gesVacio();
    const tope = Math.max(...grupos.map((g) => Math.abs(g.v)), 1);
    return `<ul class="gbar">${grupos.map((g) => {
      const on = G.f[dim] === g.k, off = G.f[dim] && !on;
      const tip = gesTip([g.k, `${plural(g.filas.length, 'venta', 'ventas')} · ${g.kpi.nEf} efectivas`, `Valor: ${plata(g.kpi.valor)}`, `Utilidad realizada: ${plata(g.kpi.util)}`, g.kpi.conv != null ? `Conversión: ${pctTxt(g.kpi.conv)}` : '']);
      const barra = `<span class="gbar-t"><i style="width:${(Math.max(0, g.v) / tope * 100).toFixed(1)}%;background:${o.color || 'var(--coral)'}"></i></span>`;
      const cuerpo = `<span class="gbar-l">${esc(g.k)}</span>${barra}<b>${gesFmt(g.v)}</b>`;
      return `<li${off ? ' class="off"' : ''}>${g.otros ? `<div class="gbar-r" data-tip="${tip}">${cuerpo}</div>` : `<button type="button" class="gbar-r" data-gfiltro="${dim}" data-gvalor="${esc(g.k)}" aria-pressed="${on}" data-tip="${tip}">${cuerpo}</button>`}</li>`;
    }).join('')}</ul>`;
  }

  // Barra partida en dos o más partes, con su leyenda
  function gesPartida(partes, total, dim) {
    const G = S.ges;
    if (!total) return gesVacio('Sin datos.');
    return `<div class="gpart">${partes.filter((p) => p.v > 0).map((p) => `<i style="flex-grow:${p.v};background:${p.color}"${dim && G.f[dim] && G.f[dim] !== p.k ? ' class="off"' : ''} data-tip="${gesTip([p.k, p.fmt || plata(p.v), pctTxt(p.v / total)])}"></i>`).join('')}</div>
      <ul class="gpart-l">${partes.map((p) => {
        const dentro = `<i style="background:${p.color}"></i><span>${esc(p.k)}</span><b>${p.fmt || plataCorta(p.v)}</b><small>${pctTxt(p.v / total, 0)}</small>`;
        return `<li>${dim ? `<button type="button" data-gfiltro="${dim}" data-gvalor="${esc(p.k)}" aria-pressed="${G.f[dim] === p.k}"${G.f[dim] && G.f[dim] !== p.k ? ' class="off"' : ''}>${dentro}</button>` : `<div>${dentro}</div>`}</li>`;
      }).join('')}</ul>`;
  }

  // Desempeño por asesora
  function gesAsesoras() {
    const G = S.ges, grupos = gesAgrupar(gesFiltrar('asesora'), 'asesora').sort((a, b) => b.kpi.valorEf - a.kpi.valorEf || b.kpi.valor - a.kpi.valor);
    if (!grupos.length) return gesVacio();
    const tope = Math.max(...grupos.map((g) => g.kpi.valor), 1);
    return `<div class="gases">${grupos.map((g) => {
      const k = g.kpi, on = G.f.asesora === g.k, off = G.f.asesora && !on;
      return `<button type="button" class="gases-r${off ? ' off' : ''}" data-gfiltro="asesora" data-gvalor="${esc(g.k)}" aria-pressed="${on}">
          <span class="gases-who"><span class="gases-av">${esc(initials(g.k))}</span><span><b>${esc(g.k)}</b><small>${plural(k.n, 'venta', 'ventas')} · ${k.nEf} efectivas</small></span></span>
          <span class="gases-bar" data-tip="${gesTip([g.k, `Registrado: ${plata(k.valor)}`, `Efectivo (confirmado y facturado): ${plata(k.valorEf)}`])}"><i class="tot" style="width:${(k.valor / tope * 100).toFixed(1)}%"></i><i class="ef" style="width:${(k.valorEf / tope * 100).toFixed(1)}%"></i></span>
          <span class="gases-n"><small>Registrado</small><b>${plataCorta(k.valor)}</b></span>
          <span class="gases-n"><small>Efectivo</small><b>${plataCorta(k.valorEf)}</b></span>
          <span class="gases-n"><small>Utilidad</small><b>${plataCorta(k.util)}</b></span>
          <span class="gases-n"><small>Conversión</small><b>${pctTxt(k.conv, 0)}</b></span>
        </button>`;
    }).join('')}</div>
    <div class="gleyenda estatica"><span><i class="tot"></i>Registrado</span><span><i class="ef"></i>Efectivo (confirmado y facturado)</span></div>`;
  }

  // Servicios vendidos (de las ventas efectivas): valor y margen por tipo
  function gesServicios(rows) {
    const m = new Map();
    rows.filter(gesEfectiva).forEach((r) => r.servicios.forEach((s) => {
      const k = s.tipo || 'Otros', g = m.get(k) || { k, valor: 0, costo: 0 };
      g.valor += +s.valor || 0; g.costo += +s.costo || 0;
      m.set(k, g);
    }));
    const lista = [...m.values()].filter((g) => g.valor > 0).sort((a, b) => b.valor - a.valor);
    if (!lista.length) return gesVacio('Sin servicios en ventas efectivas.');
    const tope = lista[0].valor;
    return `<ul class="gbar">${lista.map((g) => `<li><div class="gbar-r" data-tip="${gesTip([g.k, `Vendido: ${plata(g.valor)}`, `Costo: ${plata(g.costo)}`, `Utilidad: ${plata(g.valor - g.costo)}`, `Margen: ${pctTxt(g.valor ? (g.valor - g.costo) / g.valor : null)}`])}">
        <span class="gbar-l">${esc(g.k)}</span><span class="gbar-t"><i style="width:${(g.valor / tope * 100).toFixed(1)}%;background:var(--carbon)"></i></span><b>${plataCorta(g.valor)}</b><small class="gbar-x">${pctTxt(g.valor ? (g.valor - g.costo) / g.valor : null, 0)}</small></div></li>`).join('')}</ul>
      <p class="gnota">Barra: valor vendido · a la derecha, margen de cada servicio.</p>`;
  }

  // Proveedores con más compras (ventas efectivas)
  function gesProveedores(rows) {
    const m = new Map();
    rows.filter(gesEfectiva).forEach((r) => r.proveedores.forEach((p) => m.set(p.nombre, (m.get(p.nombre) || 0) + (+p.costo || 0))));
    const lista = [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (!lista.length) return gesVacio('Sin proveedores en ventas efectivas.');
    const tope = lista[0][1];
    return `<ul class="gbar">${lista.map(([k, v]) => `<li><div class="gbar-r" data-tip="${gesTip([k, `Compras: ${plata(v)}`])}"><span class="gbar-l">${esc(k)}</span><span class="gbar-t"><i style="width:${(v / tope * 100).toFixed(1)}%;background:var(--pizarra)"></i></span><b>${plataCorta(v)}</b></div></li>`).join('')}</ul>`;
  }

  // Motivos de pérdida y estado del seguimiento (ventas no cerradas)
  function gesMotivos() {
    const G = S.ges, rows = gesFiltrar('seguimiento').filter((r) => !gesEfectiva(r));
    const con = rows.filter((r) => r.seguimiento);
    const sinSeg = rows.filter((r) => !r.seguimiento && r.estado === 'Cotizado').length;
    const m = new Map();
    con.forEach((r) => m.set(r.seguimiento, (m.get(r.seguimiento) || 0) + 1));
    const lista = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
    if (!lista.length) return gesVacio('Sin seguimientos registrados en las ventas no cerradas.');
    const tope = lista[0][1];
    return `<ul class="gbar">${lista.map(([k, v]) => {
      const on = G.f.seguimiento === k, off = G.f.seguimiento && !on;
      return `<li${off ? ' class="off"' : ''}><button type="button" class="gbar-r" data-gfiltro="seguimiento" data-gvalor="${esc(k)}" aria-pressed="${on}" data-tip="${gesTip([k, plural(v, 'venta', 'ventas')])}"><span class="gbar-l">${esc(k)}</span><span class="gbar-t"><i style="width:${(v / tope * 100).toFixed(1)}%;background:#EB6834"></i></span><b>${v}</b></button></li>`;
    }).join('')}</ul>
    ${sinSeg ? `<p class="gnota">${plural(sinSeg, 'cotización sin seguimiento registrado', 'cotizaciones sin seguimiento registrado')}.</p>` : ''}`;
  }

  // Próximas salidas de las ventas efectivas
  function gesSalidas() {
    const hoy = fechaEn(miTz());
    const lista = gesFiltrar().filter((r) => gesEfectiva(r) && r.salida && r.salida >= hoy).sort((a, b) => a.salida.localeCompare(b.salida) || b.valor - a.valor);
    if (!lista.length) return gesVacio('No hay salidas próximas en las ventas de este filtro.');
    const dias = (f) => Math.round((new Date(f + 'T12:00:00Z') - new Date(hoy + 'T12:00:00Z')) / 86400000);
    return `<ol class="gsal">${lista.slice(0, 8).map((r) => {
      const d = dias(r.salida), saldo = Math.max(0, r.valor - r.cobrado), urge = saldo > 0 && d <= 15;
      return `<li>
          <span class="gsal-f"><b>${+r.salida.slice(8, 10)}</b><small>${mesCorto(r.salida.slice(0, 7))}</small></span>
          <span class="gsal-d"><b>${esc(r.destino || SIN_DATO)}</b><small>${esc([r.plan, r.asesora, plural(r.pasajeros, 'pasajero', 'pasajeros')].filter(Boolean).join(' · '))}</small></span>
          <span class="gsal-c">${d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `En ${d} días`}</span>
          <span class="gsal-v"><b>${plataCorta(r.valor)}</b><small class="${urge ? 'bad' : saldo ? 'warn' : 'ok'}">${saldo ? `${urge ? ico('alerta') : ''}Saldo ${plataCorta(saldo)}` : `${ico('check')}Pagado`}</small></span>
        </li>`;
    }).join('')}</ol>${lista.length > 8 ? `<p class="gnota">Y ${plural(lista.length - 8, 'salida más', 'salidas más')} (ver el detalle).</p>` : ''}`;
  }

  // Detalle: la tabla de ventas filtradas (sin datos personales)
  const GES_COLS = [
    ['fecha', 'Fecha'], ['asesora', 'Asesora'], ['destino', 'Destino'], ['tipo_venta', 'Tipo'], ['estado', 'Estado'],
    ['salida', 'Salida'], ['pasajeros', 'Pax'], ['valor', 'Valor'], ['utilidad', 'Utilidad'], ['cobrado', 'Cobrado'],
  ];
  function gesOrdenadas() {
    const { col, asc } = S.ges.orden, v = (r) => (col === 'utilidad' ? r.valor - r.costo : r[col] == null ? '' : r[col]);
    return gesFiltrar().slice().sort((a, b) => {
      const x = v(a), y = v(b), c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return asc ? c : -c;
    });
  }
  function gesDetalle() {
    const G = S.ges, filas = gesOrdenadas();
    if (!G.detalle) return '';
    const num = ['pasajeros', 'valor', 'utilidad', 'cobrado'];
    return `<div class="tablewrap"><table class="gtabla"><thead><tr>${GES_COLS.map(([k, n]) => `<th${num.includes(k) ? ' class="num"' : ''}><button type="button" data-gorden="${k}">${n}${G.orden.col === k ? (G.orden.asc ? ' ↑' : ' ↓') : ''}</button></th>`).join('')}</tr></thead>
      <tbody>${filas.slice(0, 500).map((r) => `<tr>
        <td>${fechaCorta(r.fecha)}</td><td>${esc(r.asesora)}</td><td>${esc(r.destino)}${r.plan ? `<small>${esc(r.plan)}</small>` : ''}</td><td>${esc(r.tipo_venta)}</td>
        <td><span class="gest"><i style="background:${colorEstado(r.estado)}"></i>${esc(r.estado)}</span></td><td>${r.salida ? fechaCorta(r.salida) : '—'}</td>
        <td class="num">${r.pasajeros}</td><td class="num">${plata(r.valor)}</td><td class="num">${gesEfectiva(r) ? plata(r.valor - r.costo) : '—'}</td><td class="num">${plata(r.cobrado)}</td></tr>`).join('')}</tbody></table></div>
      ${filas.length > 500 ? `<p class="gnota">Se muestran 500 de ${filas.length}. «Exportar a Excel» baja todas.</p>` : ''}`;
  }
  function exportarGestion() {
    if (CFG.sinDescargas) { toast('En esta vista previa no se descargan archivos. En la intranet publicada, este botón baja el CSV para Excel.', 'warn'); return; }
    const celda = (v) => { let s = String(v == null ? '' : v); if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = "'" + s; return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const n = (x) => String(Math.round(x));
    const cab = ['ID venta', 'Fecha registro', 'Asesora', 'Estado', 'Tipo de venta', 'Tipo de viaje', 'Destino', 'Plan', 'Salida', 'Regreso', 'Pasajeros', 'Valor', 'Costo proveedores', 'Utilidad', 'Cobrado', 'Saldo por cobrar', 'Pagado a proveedores', 'Seguimiento'];
    const lineas = [cab.join(';')].concat(gesOrdenadas().map((r) => [
      r.id, r.fecha, r.asesora, r.estado, r.tipo_venta, r.tipo_viaje, r.destino, r.plan, r.salida || '', r.regreso || '', r.pasajeros,
      n(r.valor), n(r.costo), n(r.valor - r.costo), n(r.cobrado), n(gesEfectiva(r) ? Math.max(0, r.valor - r.cobrado) : 0), n(r.pagado_prov), r.seguimiento,
    ].map(celda).join(';')));
    const blob = new Blob(['﻿' + lineas.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ventas-${S.ges.mes || 'todo'}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Archivo descargado. Ábrelo con Excel.');
  }

  // ---------- Cuentas de cobro de los aliados ----------
  // El aliado le cobra a Caminos la comisión de varias ventas en un solo documento.
  // Reglas en la base (generar_cuenta_cobro): facturadas, con número de factura,
  // modalidad Retorno, dentro del periodo y cada venta una sola vez.
  async function cargarCuentasCobro() {
    const [clientes, ventas, cuentas, cobradas] = await Promise.all([
      q(sb.from('clientes_ext').select('*').order('nombre')),
      todas(() => sb.from('ventas_cliente').select('id, cliente_id, estado, destino, plan, codigo, factura, fecha_factura, modalidad, comision')),
      q(sb.from('cuentas_cobro').select('*').order('creada', { ascending: false })),
      todas(() => sb.from('cuentas_cobro_ventas').select('venta_id, cuenta_id')),
    ]);
    S.ges.cc.datos = { clientes: clientes || [], ventas: (ventas || []).map((v) => Object.assign({}, v, { comision: +v.comision || 0 })), cuentas: cuentas || [], cobradas: new Set((cobradas || []).map((x) => x.venta_id)) };
  }
  function mesAnteriorRango() {
    const h = fechaEn(miTz()), d = new Date(Date.UTC(+h.slice(0, 4), +h.slice(5, 7) - 2, 1)), m = d.toISOString().slice(0, 7);
    return { desde: m + '-01', hasta: ultimoDia(m) };
  }
  function gesCuentasCobro() {
    const C = S.ges.cc, D = C.datos;
    if (!D) return '';
    const cliente = (id) => D.clientes.find((c) => c.id === id) || { id, nombre: id };
    const CC = window.CuentaCobro;
    let form = '';
    if (C.abierto) {
      const aliados = D.clientes.filter((c) => /freelance|aliad/i.test(c.tipo) || D.ventas.some((v) => v.cliente_id === c.id && v.factura));
      const c = C.cliente ? cliente(C.cliente) : null;
      const el = c ? CC.elegibles(D.ventas, c, C.desde, C.hasta, D.cobradas) : null;
      const sel = el ? el.ok.filter((v) => !C.quitadas.has(v.id)) : [];
      const total = sel.reduce((s2, v) => s2 + v.comision, 0);
      const falta = c ? CC.faltantes(c) : [];
      const r = el ? el.razones : null;
      const notas = r ? [r.sinComision && `${plural(r.sinComision, 'venta sin comisión calculada', 'ventas sin comisión calculada')}`, r.descuento && `${plural(r.descuento, 'venta no está', 'ventas no están')} en modalidad Retorno`, r.sinFactura && `${plural(r.sinFactura, 'venta facturada sin número de factura', 'ventas facturadas sin número de factura')}`, r.cobradas && `${plural(r.cobradas, 'venta ya cobrada', 'ventas ya cobradas')}`, r.fueraPeriodo && `${plural(r.fueraPeriodo, 'venta facturada fuera del periodo', 'ventas facturadas fuera del periodo')}`].filter(Boolean) : [];
      form = `<div class="cc-form">
        <div class="form-grid">
          <label class="field"><span>Aliado</span><select data-ccsel="cliente"><option value="">Elige el aliado…</option>${aliados.map((a) => `<option value="${esc(a.id)}"${C.cliente === a.id ? ' selected' : ''}>${esc(a.nombre || a.contacto)}</option>`).join('')}</select></label>
          <label class="field"><span>Desde (fecha de factura)</span><input type="date" data-ccsel="desde" value="${esc(C.desde)}"></label>
          <label class="field"><span>Hasta (fecha de corte)</span><input type="date" data-ccsel="hasta" value="${esc(C.hasta)}" max="${fechaEn(miTz())}"></label>
        </div>
        ${c && falta.length ? `<div class="notice warn">${ico('alerta')}<span>En AppSheet a este aliado le falta: <b>${esc(falta.join(', '))}</b>. ${falta.includes('% de comisión') || falta.includes('modalidad «Retorno»') ? 'Sin eso no hay ventas para cobrar.' : 'El documento sale con esos datos en blanco.'} Complétalo en la hoja CLIENTES y toca «Actualizar».</span></div>` : ''}
        ${c ? (el.ok.length ? `<div class="tablewrap"><table class="cc-ventas"><thead><tr><th></th><th>Reserva</th><th>Factura</th><th>Fecha factura</th><th>Destino</th><th class="num">Comisión</th></tr></thead><tbody>
            ${el.ok.map((v) => `<tr><td><input type="checkbox" data-ccventa="${esc(v.id)}"${C.quitadas.has(v.id) ? '' : ' checked'} aria-label="Incluir ${esc(v.codigo || v.id)}"></td><td><b>${esc(v.codigo || v.id)}</b></td><td>${esc(v.factura)}</td><td>${esc(fechaCorta(v.fecha_factura))}</td><td>${esc([v.destino, v.plan].filter(Boolean).join(' · '))}</td><td class="num">${plata(v.comision)}</td></tr>`).join('')}
            </tbody></table></div>` : `<p class="hint">No hay ventas para cobrar de este aliado en el periodo.</p>`) : '<p class="hint">Elige el aliado y el periodo: aparecen sus ventas facturadas, en modalidad Retorno y aún sin cobrar.</p>'}
        ${notas.length ? `<p class="hint">No entran: ${esc(notas.join(' · '))}.</p>` : ''}
        <div class="acc"><button type="button" class="btn" data-cc="generar"${!sel.length || S.ocupado ? ' disabled' : ''}>${ico('documento')}Generar cuenta de cobro${sel.length ? ` · ${plural(sel.length, 'venta', 'ventas')} · ${plata(total)}` : ''}</button><button type="button" class="btn txt" data-cc="cerrar">Cancelar</button></div>
      </div>`;
    }
    const filas = D.cuentas.map((k) => {
      const e = CC.ESTADOS[k.estado] || { nombre: k.estado, cls: 'mute' }, conf = C.confirmar && C.confirmar.id === k.id ? C.confirmar.estado : null;
      const acc = conf ? `<span class="hint">${conf === 'anulada' ? '¿Anularla? Sus ventas quedan libres.' : conf === 'pagada' ? '¿Marcar como pagada?' : '¿Marcar como enviada?'}</span><button type="button" class="btn sm" data-ccestado="${conf}" data-ccid="${k.id}"${ocupado('cc')}>Sí</button><button type="button" class="btn txt sm" data-cc="no">No</button>`
        : `<button type="button" class="btn ghost sm" data-ccpdf="${k.id}">${ico('descargar')}PDF</button>
           ${k.estado === 'generada' ? `<button type="button" class="btn txt sm" data-ccpedir="enviada" data-ccid="${k.id}">Enviada</button>` : ''}
           ${k.estado === 'generada' || k.estado === 'enviada' ? `<button type="button" class="btn txt sm" data-ccpedir="pagada" data-ccid="${k.id}">Pagada</button><button type="button" class="btn txt sm" data-ccpedir="anulada" data-ccid="${k.id}">Anular</button>` : ''}`;
      return `<tr><td><b>${esc(k.numero)}</b><small class="hint">${k.origen === 'aliado' ? 'Generada por el aliado' : 'Generada por Caminos'} · ${esc(fechaCorta(k.creada.slice(0, 10)))}</small></td>
        <td>${esc(cliente(k.cliente_id).nombre || k.cliente_id)}</td><td>${esc(CC.periodo(k.desde, k.hasta))}</td><td class="num">${k.ventas}</td><td class="num">${plata(k.total)}</td>
        <td><span class="chip ${e.cls} xs">${esc(e.nombre)}</span></td><td><div class="acc">${acc}</div></td></tr>`;
    }).join('');
    const pendiente = D.cuentas.filter((k) => k.estado === 'generada' || k.estado === 'enviada').reduce((s2, k) => s2 + (+k.total || 0), 0);
    return gesTarjeta('Cuentas de cobro de aliados', `La comisión de varias ventas en un solo documento${pendiente ? ` · por pagar ${plata(pendiente)}` : ''}`,
      form + (D.cuentas.length ? `<div class="tablewrap"><table class="cc-lista"><thead><tr><th>Número</th><th>Aliado</th><th>Periodo</th><th class="num">Ventas</th><th class="num">Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${filas}</tbody></table></div>` : (C.abierto ? '' : '<p class="gvacio">Aún no hay cuentas de cobro. Los aliados también pueden generarlas desde su portal.</p>')),
      'gcc', C.abierto ? '' : `<div class="acc"><button type="button" class="btn sm" data-cc="nueva">${ico('mas')}Nueva cuenta de cobro</button></div>`);
  }
  async function generarCuentaCobro() {
    const C = S.ges.cc, D = C.datos, c = D.clientes.find((x) => x.id === C.cliente);
    const ids = window.CuentaCobro.elegibles(D.ventas, c, C.desde, C.hasta, D.cobradas).ok.filter((v) => !C.quitadas.has(v.id)).map((v) => v.id);
    await accion('cc', async () => {
      const r = await q(sb.rpc('generar_cuenta_cobro', { p_cliente: C.cliente, p_desde: C.desde, p_hasta: C.hasta, p_ventas: ids }));
      await cargarCuentasCobro();
      Object.assign(C, { abierto: false, cliente: '', quitadas: new Set() });
      toast(`Cuenta de cobro ${r.numero} generada. Toca «PDF» para descargarla.`);
    });
  }

  // Conexión con el gestor de reservas (solo administración)
  function gesConexion() {
    const G = S.ges, e = G.estado || {};
    if (!esAdmin()) return '';
    const clave = G.clave ? `<div class="clave" aria-live="polite">
        <p class="hint">Pégala en el script de Google como propiedad <b>CLAVE_VENTAS</b> (paso 3 de <b>informes/LEEME.md</b>). Se muestra <b>una sola vez</b>; la clave anterior dejó de servir.</p>
        <dl><div><dt>Clave</dt><dd class="mono">${esc(G.clave)}</dd></div></dl>
        <div class="acc"><button type="button" class="btn" data-copiar="ventas">${ico('copiar')}Copiar</button><button type="button" class="btn ghost" data-accion="gesClaveCerrar">Listo</button></div>
      </div>` : '';
    // Con el botón conectado, el panel queda recogido en una sola línea
    const abierto = G.conAbierta || !!G.clave || !e.boton_listo;
    if (!abierto) {
      return `<section class="gcon-mini"><button type="button" data-accion="gesConexion" aria-expanded="false">
          ${ico('llave')}<span><b>Conexión con el gestor de reservas</b> · ${ico('check')}Conectada${e.sincronizado ? ` · última sincronización ${esc(haceTxt(e.sincronizado))}` : ''}</span><em>Ver detalles</em></button></section>`;
    }
    return `<section class="gcard gcon"><header><div><h2>Conexión con el gestor de reservas</h2>
        <p>Una tarea automática de Claude <b>solo lee</b> la hoja de AppSheet todos los días a las 6 a. m., y cada vez que alguien toca «Actualizar», y manda aquí un resumen por venta, sin datos de clientes ni pasajeros. Nunca modifica la hoja.</p></div>${e.boton_listo && !G.clave ? '<button type="button" class="btn txt sm" data-accion="gesConexion" aria-expanded="true">Ocultar</button>' : ''}</header>
        <dl class="gcon-d">
          <div><dt>Última sincronización</dt><dd>${e.sincronizado ? `${esc(fechaHora(e.sincronizado, miTz()))} · ${esc(haceTxt(e.sincronizado))}` : 'Nunca'}</dd></div>
          <div><dt>Ventas recibidas</dt><dd>${(e.filas || 0).toLocaleString('es-CO')}</dd></div>
          <div><dt>Botón «Actualizar»</dt><dd>${e.boton_listo ? `${ico('check')} Conectado a la tarea de Claude` : 'Sin conectar (solo recarga)'}</dd></div>
        </dl>
        <div class="gcon-boton">
          <h3>Conectar el botón «Actualizar» con la tarea de Claude</h3>
          <p class="hint">En <b>claude.ai/code/routines</b>, abre la tarea «Actualizar informes de gestión» → <b>Editar</b> → en <b>Trigger</b> toca <b>+</b> → <b>API</b> → <b>Generate token</b>. Copia aquí la <b>Fire URL</b> y el <b>token</b> (se ve una sola vez). El token se guarda cifrado y nadie lo puede ver desde la intranet.</p>
          <form class="gcon-f" data-form="gesTarea" autocomplete="off">
            <label><span>Fire URL</span><input name="url" type="url" required placeholder="https://api.anthropic.com/v1/claude_code/routines/trig_…/fire" spellcheck="false"></label>
            <label><span>Token</span><input name="token" type="password" required placeholder="sk-ant-oat01-…" spellcheck="false" autocomplete="new-password"></label>
            <div class="acc"><button type="submit" class="btn sm"${ocupado('gesTarea')}>${ico('llave')}${e.boton_listo ? 'Cambiar la conexión' : 'Conectar el botón'}</button>${e.boton_listo ? `<button type="button" class="btn txt sm" data-accion="gesTareaQuitar"${ocupado('gesTarea')}>Desconectar</button>` : ''}</div>
          </form>
        </div>
        <div class="gcon-script"><h3>Opcional: script de Google (datos cada 10 minutos)</h3>
          <p class="hint">Clave del script: ${e.clave_creada ? `creada el ${esc(fechaHora(e.clave_creada, miTz()))}` : 'sin crear'}.</p>
          ${clave || `<div class="acc"><button type="button" class="btn ghost sm" data-accion="gesClave"${ocupado('gesClave')}>${ico('llave')}${e.clave_creada ? 'Cambiar la clave del script' : 'Crear la clave del script'}</button></div>`}
        </div>
      </section>`;
  }

  // Botón «Actualizar»: si está conectado, despierta la tarea de Claude; si no, recarga lo guardado
  let gesRevision = null;
  async function actualizarGestion() {
    await accion('gesActualizar', async () => {
      await cargarGestion();
      if (!S.ges.estado || !S.ges.estado.boton_listo) {
        toast(esAdmin() ? 'Datos recargados. Para traer datos nuevos de AppSheet con este botón, conéctalo abajo en «Conexión con el gestor de reservas».' : 'Datos recargados.');
        return;
      }
      const r = await q(sb.rpc('pedir_actualizacion_ventas'));
      await cargarGestion();
      if (r && r.estado === 'pedido') {
        toast('Listo: el agente de Claude está leyendo el gestor de reservas. En unos minutos se actualiza solo.');
        clearTimeout(gesRevision);
        gesRevision = setTimeout(revisarPedidoGestion, 8000);
      } else {
        toast('Ya hay una actualización en camino; en unos minutos se ve aquí.', 'warn');
      }
    });
  }
  // Unos segundos después, se confirma que la tarea aceptó el pedido
  async function revisarPedidoGestion() {
    if (S.view !== 'gestion') return;
    let r = null;
    try { r = await q(sb.rpc('estado_pedido_ventas')); } catch (e) { return; }
    if (!r || r.estado === 'esperando') { gesRevision = setTimeout(revisarPedidoGestion, 6000); return; }
    if (r.estado === 'rechazado') {
      const motivo = r.codigo === 401 ? 'el token ya no sirve: hay que conectar el botón de nuevo'
        : r.codigo === 429 ? 'se pidieron demasiadas actualizaciones en la última hora'
        : r.codigo === 400 ? 'la tarea está en pausa en claude.ai'
        : `respondió ${r.codigo || 'sin conexión'}`;
      toast(`La tarea de Claude no aceptó el pedido: ${motivo}.`, 'bad');
    }
  }

  function gestionView() {
    const G = S.ges, meses = gesMeses();
    const cab = encabezado('Panel de gerencia', 'Informes de <em>gestión</em>',
      `Ventas del gestor de reservas${G.mes ? ` registradas en <b>${esc(nombreMes(G.mes))}</b>` : ', todos los meses'}. Toca cualquier barra, columna o estado para filtrar todo el tablero.`,
      `<div class="ges-h">${vivoGes()}<button type="button" class="btn ghost sm" data-accion="gesActualizar"${ocupado('gesActualizar')}${gesActualizando() ? ' disabled' : ''} title="${G.estado && G.estado.boton_listo ? 'Pide al agente de Claude que lea ahora el gestor de reservas' : 'Vuelve a cargar los datos guardados'}">${ico('recargar')}${gesActualizando() ? 'Actualizando…' : 'Actualizar'}</button></div>`);
    if (!G.filas.length) {
      return `${cab}<div class="notice">${ico('grafica')}<div><b>Aún no llegan ventas del gestor de reservas.</b><p>${esAdmin() ? 'Crea la clave del script abajo y sigue los pasos de <b>informes/LEEME.md</b>. En cuanto el script corra, el tablero se llena solo.' : 'La administración debe conectar el script del gestor de reservas.'}</p></div></div>${gesConexion()}`;
    }
    // Filtros (todos sincronizados)
    const opciones = (dim) => [...new Set(gesFiltrar(dim).map((r) => gesVal(r, dim)).concat(G.f[dim] ? [G.f[dim]] : []))].sort((a, b) => a.localeCompare(b));
    const sel = (dim) => `<label class="gsel"><span>${GES_DIM[dim]}</span><select data-gsel="${dim}"><option value="">Todos</option>${opciones(dim).map((o) => `<option value="${esc(o)}"${G.f[dim] === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    const chips = Object.keys(G.f).filter((k) => G.f[k]).map((k) => `<button type="button" class="gchip" data-gquitar="${k}" aria-label="Quitar filtro ${esc(GES_DIM[k])}">${esc(GES_DIM[k])}: <b>${esc(G.f[k])}</b>${ico('x')}</button>`);
    if (G.mes) chips.unshift(`<button type="button" class="gchip" data-gmesf="" aria-label="Quitar filtro de mes">Mes: <b>${esc(mesLargo(G.mes))}</b>${ico('x')}</button>`);
    const variosAnios = meses.length && meses[0].slice(0, 4) !== meses[meses.length - 1].slice(0, 4);
    const barra = `<div class="gfiltros">
        <div class="gmeses" role="group" aria-label="Mes">
          <button type="button" data-gmesf="" aria-pressed="${!G.mes}">Todo</button>
          ${meses.map((m) => `<button type="button" data-gmesf="${m}" aria-pressed="${G.mes === m}">${mesCorto(m)}${variosAnios ? ` ${m.slice(2, 4)}` : ''}</button>`).join('')}
        </div>
        <div class="gsels">${sel('asesora')}${sel('estado')}${sel('tipo_venta')}${sel('tipo_viaje')}
          <div class="gsel"><span>Medir por</span><div class="seg" role="group" aria-label="Medida">${Object.keys(GES_MEDIDAS).map((m) => `<button type="button" data-gmedida="${m}" aria-pressed="${G.medida === m}">${GES_MEDIDAS[m]}</button>`).join('')}</div></div>
        </div>
      </div>
      ${chips.length ? `<div class="gchips" aria-label="Filtros activos"><span class="gchips-t">${ico('grafica')}Viendo</span>${chips.join('')}<button type="button" class="btn txt sm" data-accion="gesLimpiar">Quitar filtros</button></div>` : ''}`;

    const rows = gesFiltrar(), k = gesKpi(rows);
    const aviso = gesViejo() ? `<div class="notice warn">${ico('alerta')}<span>La última sincronización con el gestor de reservas fue ${esc(haceTxt(G.estado.sincronizado))}. Los datos pueden estar desactualizados: revisa el script de Google.</span></div>` : '';
    const indicadores = `<div class="gkpis">
        ${gesIndicador({ titulo: 'Ventas registradas', hero: true, valor: plataCorta(k.valor), sub: `${plata(k.valor)} · ${plural(k.n, 'venta', 'ventas')}`, de: (x) => x.valor, fmt: plata })}
        ${gesIndicador({ titulo: 'Ventas efectivas', valor: plataCorta(k.valorEf), sub: `${plural(k.nEf, 'confirmada o facturada', 'confirmadas o facturadas')}`, de: (x) => x.valorEf, fmt: plata })}
        ${gesIndicador({ titulo: 'Utilidad realizada', valor: plataCorta(k.util), sub: `Margen ${pctTxt(k.margen)}`, de: (x) => x.util, fmt: plata })}
        ${gesIndicador({ titulo: 'Conversión', valor: pctTxt(k.conv), sub: `${k.nEf} de ${plural(k.n, 'venta', 'ventas')} se concretaron`, de: (x) => x.conv, fmt: (v) => pctTxt(v), puntos: true })}
        ${gesIndicador({ titulo: 'Ticket promedio', valor: k.ticket == null ? '—' : plataCorta(k.ticket), sub: 'Por venta efectiva', de: (x) => x.ticket, fmt: plata })}
        ${gesIndicador({ titulo: 'Pasajeros', valor: k.pax.toLocaleString('es-CO'), sub: 'En ventas efectivas', de: (x) => x.pax, fmt: (v) => String(v) })}
      </div>`;

    const filasViaje = gesFiltrar('tipo_viaje');
    const viajes = gesAgrupar(filasViaje, 'tipo_viaje').map((g) => ({ k: g.k, v: Math.max(0, g.v), color: GES_VIAJE[g.k] || '#8A8F9C', fmt: gesFmt(Math.max(0, g.v)) })).sort((a, b) => b.v - a.v);
    const cartera = gesPartida([
      { k: 'Cobrado', v: k.cobrado, color: 'var(--carbon)' },
      { k: 'Por cobrar', v: k.porCobrar, color: 'var(--amarillo)' },
    ], k.cobrado + k.porCobrar);
    const prov = gesPartida([
      { k: 'Pagado a proveedores', v: k.pagadoProv, color: 'var(--pizarra)' },
      { k: 'Por pagar', v: k.porPagar, color: 'var(--hairline-2)' },
    ], k.pagadoProv + k.porPagar);

    const medida = GES_MEDIDAS[G.medida].toLowerCase();
    return `${cab}${aviso}<div class="gestion">${barra}${indicadores}
        <div class="gfila g-2-1">
          ${gesTarjeta('Evolución mensual', `${GES_MEDIDAS[G.medida]} por mes y estado · toca un mes para ver solo ese mes`, gesColumnas())}
          ${gesTarjeta('Estados', `Participación en el ${gesNombreMedida()}`, gesDona())}
        </div>
        <div class="gfila g-2-1">
          ${gesTarjeta('Desempeño por asesora', 'Valor registrado frente a lo efectivamente vendido', gesAsesoras())}
          ${gesTarjeta('Cartera y proveedores', 'Ventas efectivas: cobro a clientes y pago a proveedores', `
              <div class="gsub"><h3>Clientes <small>${plataCorta(k.valorEf)}</small></h3>${cartera}</div>
              <div class="gsub"><h3>Proveedores <small>${plataCorta(k.costoEf)}</small></h3>${prov}</div>`)}
        </div>
        <div class="gfila g-3">
          ${gesTarjeta('Tipo de venta', `Por ${medida}`, gesBarras('tipo_venta'))}
          ${gesTarjeta('Destinos principales', `Por ${medida}`, gesBarras('destino', { max: 8 }))}
          ${gesTarjeta('Nacional e internacional', `Por ${medida}`, gesPartida(viajes, viajes.reduce((s, x) => s + x.v, 0), 'tipo_viaje') + `<div class="gsub"><h3>Planes y peregrinaciones</h3>${gesBarras('plan', { max: 5, color: 'var(--carbon)', filas: gesFiltrar('plan').filter((r) => r.plan) })}</div>`)}
        </div>
        <div class="gfila g-3">
          ${gesTarjeta('Servicios vendidos', 'Ventas efectivas, por tipo de servicio', gesServicios(rows))}
          ${gesTarjeta('Proveedores principales', 'Compras en ventas efectivas', gesProveedores(rows))}
          ${gesTarjeta('Ventas no cerradas: seguimiento', `${plural(k.nCanc, 'cancelada', 'canceladas')} · ${plural(k.nCot, 'en cotización', 'en cotización')}`, gesMotivos())}
        </div>
        <div class="gfila">
          ${gesTarjeta('Próximas salidas', 'Ventas efectivas con fecha de viaje desde hoy, con su saldo por cobrar', gesSalidas())}
        </div>
        ${gesCuentasCobro()}
        ${gesTarjeta('Detalle de ventas', `${plural(rows.length, 'venta', 'ventas')} con los filtros actuales`, gesDetalle(), 'gdet',
          `<div class="acc"><button type="button" class="btn ghost sm" data-accion="gesDetalle">${ico('hoja')}${G.detalle ? 'Ocultar detalle' : 'Ver detalle'}</button><button type="button" class="btn ghost sm" data-accion="gesExportar">${ico('descargar')}Exportar a Excel</button></div>`)}
        ${gesConexion()}
      </div>
      <div id="gtip" class="gtip" role="tooltip" hidden></div>`;
  }

  // Tooltip de las gráficas de gestión
  document.addEventListener('mousemove', (ev) => {
    const tip = document.getElementById('gtip');
    if (!tip) return;
    const el = ev.target.closest && ev.target.closest('[data-tip]');
    if (!el || !el.closest('.gestion')) { tip.hidden = true; return; }
    const lineas = el.getAttribute('data-tip').split('\n');
    const html = `<b>${esc(lineas[0])}</b>${lineas.slice(1).map((l) => `<span>${esc(l)}</span>`).join('')}`;
    if (tip.innerHTML !== html) tip.innerHTML = html;
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = ev.clientX + 14, y = ev.clientY - h - 12;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - 14;
    if (y < 8) y = ev.clientY + 18;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = y + 'px';
  });

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

  async function funcionCuentas(body, nombre) {
    const { data, error } = await sb.functions.invoke(nombre || 'crear-usuario', { body });
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
    if (esAdmin()) await cargarClientesExt();
  }

  // ---------- Clientes de la extranet (administración) ----------
  // Los clientes salen de la hoja CLIENTES de AppSheet (los trae la tarea diaria).
  // La cuenta usa el correo de AppSheet; la contraseña temporal se ve una sola vez.
  async function cargarClientesExt() {
    const [clientes, cuentas, ventas] = await Promise.all([
      q(sb.from('clientes_ext').select('*').order('nombre')),
      q(sb.from('cuentas_cliente').select('*')),
      todas(() => sb.from('ventas_cliente').select('id, cliente_id')),
    ]);
    S.cx = { clientes: clientes || [], cuentas: cuentas || [], ventas: ventas || [] };
  }
  const urlPortal = () => location.origin + location.pathname.replace(/[^/]*$/, '').replace(/pruebas\/$/, '') + (CFG.demo ? 'pruebas/clientes-demo.html' : 'clientes/');
  function clientesView() {
    const X = S.cx || { clientes: [], cuentas: [], ventas: [] }, E = S.equipo;
    const cuenta = (id) => X.cuentas.find((c) => c.cliente_id === id);
    const nVentas = (id) => X.ventas.filter((v) => v.cliente_id === id).length;
    const clave = E.claveCliente ? `<section class="clave card" aria-live="polite">
        <span class="eyebrow">${E.claveCliente.nueva ? 'Acceso creado' : 'Contraseña nueva'}</span>
        <h2>${esc(E.claveCliente.nombre)}</h2>
        <p class="hint">Esta contraseña temporal se muestra <b>una sola vez</b>. Envíasela por un canal privado; al entrar, creará la suya.</p>
        <dl><div><dt>Portal</dt><dd>${esc(urlPortal())}</dd></div><div><dt>Usuario</dt><dd>${esc(E.claveCliente.correo)}</dd></div><div><dt>Contraseña temporal</dt><dd class="mono">${esc(E.claveCliente.clave)}</dd></div></dl>
        <div class="acc"><button type="button" class="btn" data-copiar="cliente">${ico('copiar')}Copiar mensaje</button><button type="button" class="btn ghost" data-accion="cerrarClaveCliente">Listo</button></div>
      </section>` : '';
    const f = norm(E.filtroCx || '').trim();
    const lista = X.clientes.filter((c) => !f || norm(c.nombre + ' ' + c.contacto + ' ' + c.correo + ' ' + c.tipo).includes(f));
    const fila = (c) => {
      const k = cuenta(c.id), conf = E.confirmarCx && E.confirmarCx.id === c.id ? E.confirmarCx.accion : null;
      const estado = !k ? '<span class="chip mute xs">Sin acceso</span>' : k.activo ? `<span class="chip ok xs">Activo</span>${k.ultimo_ingreso ? `<small class="hint">Entró ${esc(fechaHora(k.ultimo_ingreso, miTz()))}</small>` : '<small class="hint">Aún no ha entrado</small>'}` : '<span class="chip bad xs">Desactivado</span>';
      let acc;
      if (conf) {
        acc = `<span class="hint">${conf === 'restablecer' ? '¿Dar una contraseña nueva?' : conf === 'desactivar' ? '¿Quitarle el acceso?' : '¿Devolverle el acceso?'}</span>
          <button type="button" class="btn sm" data-cx="${esc(conf)}" data-cxid="${esc(c.id)}"${ocupado('cx')}>Sí</button><button type="button" class="btn txt sm" data-cx="no">No</button>`;
      } else if (!k) {
        acc = c.correo ? `<button type="button" class="btn sm" data-cx="crear" data-cxid="${esc(c.id)}"${ocupado('cx')}>${ico('usuarioMas')}Crear acceso</button>` : '<span class="hint">Falta el correo en AppSheet</span>';
      } else {
        acc = `<button type="button" class="btn ghost sm" data-cxpedir="restablecer" data-cxid="${esc(c.id)}">${ico('llave')}Nueva contraseña</button>
          ${k.activo ? `<button type="button" class="btn txt sm" data-cxpedir="desactivar" data-cxid="${esc(c.id)}">Desactivar</button>` : `<button type="button" class="btn txt sm" data-cxpedir="reactivar" data-cxid="${esc(c.id)}">Reactivar</button>`}`;
      }
      return `<tr>
        <td><b>${esc(c.nombre || c.contacto || c.id)}</b>${c.contacto && c.contacto !== c.nombre ? `<small class="hint">${esc(c.contacto)}</small>` : ''}</td>
        <td>${esc(c.tipo === 'Freelance' ? 'Aliado (freelance)' : c.tipo ? c.tipo.charAt(0) + c.tipo.slice(1).toLowerCase() : '—')}</td>
        <td>${c.correo ? esc(c.correo) : '<span class="chip warn xs">Sin correo</span>'}</td>
        <td class="num">${nVentas(c.id)}</td>
        <td><div class="cx-estado">${estado}</div></td>
        <td><div class="acc">${acc}</div></td></tr>`;
    };
    return `${clave}<section class="card cx-adm-intro"><p>Los clientes salen de la hoja <b>CLIENTES</b> de AppSheet (se actualiza con los informes, todos los días a las 6 a. m. o con «Actualizar» en Gestión). Cada cliente entra a <a href="${esc(urlPortal())}" target="_blank" rel="noopener">${esc(urlPortal())}</a> con el correo que tiene en AppSheet y ve <b>solo sus ventas</b>: estado, fechas, viajeros, servicios, valor, pagos, saldo y su comisión. Nunca ve costos, utilidad ni proveedores.</p></section>
      <section><div class="toolbar"><label class="search">${ico('buscar')}<input type="search" data-buscar="clientes" value="${esc(E.filtroCx || '')}" placeholder="Buscar cliente" aria-label="Buscar clientes"></label><span class="hint">${plural(X.clientes.length, 'cliente', 'clientes')} · ${plural(X.cuentas.filter((k) => k.activo).length, 'con acceso', 'con acceso')}</span></div>
        <div class="tablewrap card flush"><table class="perm equipo"><thead><tr><th scope="col">Cliente</th><th scope="col">Tipo</th><th scope="col">Correo en AppSheet</th><th scope="col" class="num">Ventas</th><th scope="col">Acceso</th><th scope="col">Acciones</th></tr></thead>
          <tbody>${lista.length ? lista.map(fila).join('') : `<tr><td colspan="6" class="hint">${X.clientes.length ? 'Ningún cliente coincide con la búsqueda.' : 'Aún no llegan clientes de AppSheet. Toca «Actualizar» en Gestión.'}</td></tr>`}</tbody></table></div></section>`;
  }
  async function accionCliente(que, id) {
    const X = S.cx, c = X.clientes.find((x) => x.id === id);
    await accion('cx', async () => {
      if (que === 'crear' || que === 'restablecer') {
        const clave = claveTemporal();
        const r = await funcionCuentas({ accion: que, cliente_id: id, contrasena: clave }, 'crear-cliente');
        S.equipo.claveCliente = { nombre: c.contacto || c.nombre, correo: (r && r.correo) || c.correo, clave, nueva: que === 'crear' };
        toast(que === 'crear' ? 'Acceso creado.' : 'Contraseña nueva lista.');
      } else {
        await funcionCuentas({ accion: que, cliente_id: id }, 'crear-cliente');
        toast(que === 'desactivar' ? 'Acceso desactivado.' : 'Acceso reactivado.');
      }
      S.equipo.confirmarCx = null;
      await cargarClientesExt();
    });
  }

  function equipoView() {
    const E = S.equipo, b = E.borrador;
    const pest = esAdmin() ? `<div class="seg eq-pest" role="group" aria-label="Cuentas">${[['equipo', 'Equipo'], ['clientes', 'Clientes (extranet)']].map(([k, n]) => `<button type="button" data-eqpest="${k}" aria-pressed="${(E.pest || 'equipo') === k}">${n}</button>`).join('')}</div>` : '';
    if (esAdmin() && E.pest === 'clientes') {
      return encabezado('Cuentas', 'Clientes de la <em>extranet</em>', 'Da acceso a los clientes de AppSheet para que vean sus ventas en el portal de clientes.', pest) + clientesView();
    }
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
              ${esAdmin() ? '' : '<small class="hint">Las cuentas de supervisión, dirección y gerencia las crea la administración.</small>'}</label>
          </div>
          <button class="btn" type="submit"${ocupado('crear')}>${ico('usuarioMas')}${S.ocupado === 'crear' ? 'Creando…' : 'Crear cuenta'}</button>
        </form>
      </section>`;
    const f = norm(E.filtro).trim();
    const lista = S.personas.filter((p) => !f || norm(p.nombre + ' ' + p.correo).includes(f));
    return encabezado('Cuentas', '<em>Equipo</em>', 'Crea cuentas, cambia sede, área o rol, da una contraseña nueva o desactiva a quien ya no trabaja aquí. Desactivar no borra su historial.', pest)
      + clave + crear
      + `<section><div class="toolbar"><label class="search">${ico('buscar')}<input type="search" data-buscar="equipo" value="${esc(E.filtro)}" placeholder="Buscar por nombre o correo" aria-label="Buscar personas"></label><span class="hint">${plural(activas().length, 'cuenta activa', 'cuentas activas')}</span></div>
        <div class="tablewrap card flush"><table class="perm equipo"><thead><tr><th scope="col">Persona</th>${variasSedes() ? '<th scope="col">Sede</th>' : ''}<th scope="col">Área</th><th scope="col">Rol</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
          <tbody id="lista-equipo">${filasEquipo(lista)}</tbody></table></div></section>`;
  }

  // ---------- Tarjeta: conciliación de la tarjeta de crédito (gerencia) ----------
  const TC_TIPOS = { compra: 'Compra', pago: 'Pago', interes: 'Intereses', cuota_manejo: 'Cuota de manejo', comision: 'Comisión', avance: 'Avance', ajuste: 'Ajuste' };
  const TC_ESTADOS = {
    pendiente: { nombre: 'Por conciliar', cls: 'warn', icono: 'reloj' },
    conciliado: { nombre: 'Conciliado', cls: 'ok', icono: 'check' },
    no_reconocido: { nombre: 'No reconocido', cls: 'bad', icono: 'alerta' },
    personal: { nombre: 'Personal', cls: 'info', icono: 'usuarios' },
  };
  const TC_FINANCIEROS = ['interes', 'cuota_manejo', 'comision'];
  const TC_FRANQUICIAS = ['Visa', 'Mastercard', 'American Express', 'Diners Club', 'Otra'];
  const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const plata = (v) => COP.format(Math.round(Number(v) || 0)).replace(/\s/g, '\u00a0');
  const tcExtracto = () => S.tc.extractos.find((e) => e.id === S.tc.extracto) || null;
  const tcTarjeta = () => S.tc.tarjetas.find((t) => t.id === S.tc.tarjeta) || null;
  const tcCerrado = () => (tcExtracto() || {}).estado === 'cerrado';
  const tcCategoria = (id) => S.tc.categorias.find((c) => c.id === id);
  const tcCatId = (nombre) => (S.tc.categorias.find((c) => c.nombre === nombre) || {}).id || null;
  const tcRegistro = (id) => S.tc.regs.find((r) => r.id === id);
  const tcGrupo = (id) => S.tc.grupos.find((g) => g.id === id);
  // Una compra o un avance necesitan categoría; los pagos y cargos del banco, no
  const tcNecesitaCategoria = (m) => m.tipo === 'compra' || m.tipo === 'avance' || m.tipo === 'ajuste';
  const tcNecesitaSoporte = (m) => (m.tipo === 'compra' || m.tipo === 'avance') && m.estado !== 'no_reconocido';
  const tcTieneSoporte = (m) => !!(m.soporte_ruta || (m.registro_id && (tcRegistro(m.registro_id) || {}).soporte_ruta));
  const periodoTexto = (e) => `${fechaCorta(e.desde)} – ${fechaCorta(e.hasta)} ${e.hasta.slice(0, 4)}`;

  async function cargarTarjeta() {
    const T = S.tc;
    const [tarjetas, categorias, grupos] = await Promise.all([
      q(sb.from('tc_tarjetas').select('*').order('id')),
      q(sb.from('tc_categorias').select('*').order('orden')),
      q(sb.from('grupos').select('id,nombre,estado').order('id')),
    ]);
    T.tarjetas = tarjetas || [];
    T.categorias = (categorias || []).filter((c) => c.activa !== false);
    T.grupos = grupos || [];
    if (!tcTarjeta()) T.tarjeta = (T.tarjetas.find((t) => t.activa) || T.tarjetas[0] || {}).id || null;
    T.extractos = T.tarjeta ? await q(sb.from('tc_extractos').select('*').eq('tarjeta_id', T.tarjeta).order('hasta', { ascending: false })) : [];
    if (!tcExtracto()) T.extracto = (T.extractos[0] || {}).id || null;
    await cargarDatosExtracto();
    await cargarGastos();
    suscribirTarjeta();
  }

  async function cargarDatosExtracto() {
    const T = S.tc, e = tcExtracto();
    if (!e) { T.movs = []; T.regs = []; T.cruzados = new Set(); T.envios = []; return; }
    const ids = T.extractos.map((x) => x.id);
    const [movs, regs, cruces] = await Promise.all([
      todas(() => sb.from('tc_movimientos').select('*').eq('extracto_id', e.id).order('fecha').order('id')),
      todas(() => sb.from('tc_registros').select('*').eq('tarjeta_id', T.tarjeta).gte('fecha', sumarDias(e.desde, -45)).lte('fecha', sumarDias(e.hasta, 31)).order('fecha').order('id')),
      todas(() => sb.from('tc_movimientos').select('id,extracto_id,registro_id').in('extracto_id', ids)),
    ]);
    T.movs = movs;
    // Registros de este periodo: los cruzados aquí, y los libres hasta el corte
    T.cruzados = new Map(cruces.filter((c) => c.registro_id).map((c) => [c.registro_id, c.extracto_id]));
    T.regs = regs.filter((r) => T.cruzados.get(r.id) === e.id || (!T.cruzados.has(r.id) && r.fecha >= sumarDias(e.desde, -45)));
    const conSoporte = movs.concat(T.regs).filter((x) => x.soporte_ruta).map((x) => ({ ruta: x.soporte_ruta }));
    await firmar('conciliacion', conSoporte);
    conSoporte.forEach((f) => { T.urls[f.ruta] = f.url; });
    await cargarEnviosTc();
    T.actualizado = new Date();
  }

  // Tiempo real: si otra persona (o la misma en otro equipo) cambia algo, se vuelve a cargar
  let canalTc = null, tcEspera = null;
  function suscribirTarjeta() {
    if (canalTc || !sb.channel) return;
    canalTc = sb.channel('conciliacion-tarjeta');
    ['tc_movimientos', 'tc_registros', 'tc_extractos'].forEach((t) => canalTc.on('postgres_changes', { event: '*', schema: 'public', table: t }, avisoCambioTc));
    canalTc.subscribe((estado) => {
      S.tc.vivo = estado === 'SUBSCRIBED';
      const v = document.getElementById('tc-vivo');
      if (v) v.outerHTML = vivoTc();
    });
  }
  function soltarTarjeta() {
    if (canalTc && sb && sb.removeChannel) sb.removeChannel(canalTc);
    canalTc = null;
    clearTimeout(tcEspera);
  }
  function avisoCambioTc() {
    clearTimeout(tcEspera);
    tcEspera = setTimeout(async () => {
      if (S.view !== 'tarjeta' || S.cargandoVista) return;
      if (S.ocupado) { avisoCambioTc(); return; }
      try { await cargarDatosExtracto(); await cargarGastos(); } catch (e) { return; }
      pintarTcCuandoSePueda();
    }, 450);
  }
  // Si la persona está escribiendo o acaba de tocar un botón, se espera: redibujar
  // en ese momento le quitaría el foco o se comería el clic.
  function pintarTcCuandoSePueda() {
    if (S.view !== 'tarjeta') return;
    const a = document.activeElement;
    if (S.ocupado || (a && a.closest && a.closest('#contenido') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'file')) {
      const reintentar = () => setTimeout(pintarTcCuandoSePueda, 350);
      if (S.ocupado) reintentar(); else a.addEventListener('blur', reintentar, { once: true });
      return;
    }
    render();
  }
  const vivoTc = () => `<span id="tc-vivo" class="vivo${S.tc.vivo ? ' on' : ''}" title="${S.tc.vivo ? 'Los cambios se ven al instante, también los que haga otra persona' : 'Sin conexión en vivo: los datos se actualizan al recargar'}">${S.tc.vivo ? 'En vivo' : 'Sin conexión en vivo'}${S.tc.actualizado ? ` · ${hhmm(horaEn(miTz(), S.tc.actualizado))}` : ''}</span>`;

  // Sugerencias: cargo del banco ↔ registro de la agencia con el mismo valor y fecha cercana (±5 días)
  function sugerenciasTc() {
    const T = S.tc, sug = new Map(), usados = new Set(T.movs.filter((m) => m.registro_id).map((m) => m.registro_id));
    const libres = T.regs.filter((r) => !usados.has(r.id) && !T.cruzados.has(r.id));
    const pares = [];
    T.movs.filter((m) => m.estado === 'pendiente').forEach((m) => {
      if (m.tipo === 'pago') { sug.set(m.id, { tipo: 'pago' }); return; }
      if (TC_FINANCIEROS.includes(m.tipo)) { sug.set(m.id, { tipo: 'banco' }); return; }
      libres.forEach((r) => {
        const d = Math.abs(diasEntre(r.fecha, m.fecha));
        if (Math.round(Number(r.valor)) === Math.round(Number(m.valor)) && d <= 5) pares.push({ m, r, d });
      });
    });
    pares.sort((a, b) => a.d - b.d);
    const tomados = new Set();
    pares.forEach(({ m, r }) => { if (!sug.has(m.id) && !tomados.has(r.id)) { sug.set(m.id, { tipo: 'registro', registro: r }); tomados.add(r.id); } });
    return sug;
  }

  function calcularTc() {
    const T = S.tc, e = tcExtracto() || {}, movs = T.movs;
    const suma = (arr) => arr.reduce((t, m) => t + Number(m.valor), 0);
    const pend = movs.filter((m) => m.estado === 'pendiente');
    const noRec = movs.filter((m) => m.estado === 'no_reconocido');
    const pers = movs.filter((m) => m.estado === 'personal');
    const sinSop = movs.filter((m) => tcNecesitaSoporte(m) && !tcTieneSoporte(m));
    const fin = movs.filter((m) => TC_FINANCIEROS.includes(m.tipo));
    const calculado = Number(e.saldo_anterior || 0) + suma(movs);
    const diferencia = e.saldo_nuevo == null ? null : Math.round((Number(e.saldo_nuevo) - calculado) * 100) / 100;
    const resueltos = movs.length - pend.length;
    return {
      total: movs.length, resueltos, avance: movs.length ? Math.round((resueltos / movs.length) * 100) : 0,
      pend: pend.length, valorPend: pend.reduce((t, m) => t + Math.abs(Number(m.valor)), 0),
      noRec: noRec.length, valorNoRec: suma(noRec), pers: pers.length, valorPers: suma(pers),
      sinSop: sinSop.length, valorSinSop: suma(sinSop), financieros: suma(fin),
      cargos: suma(movs.filter((m) => Number(m.valor) > 0)), abonos: -suma(movs.filter((m) => Number(m.valor) < 0)),
      calculado, diferencia, diasPago: e.fecha_pago ? diasEntre(fechaEn(miTz()), e.fecha_pago) : null,
    };
  }

  function tarjetaView() {
    const T = S.tc;
    if (!T.tarjetas.length) {
      return encabezado('Gerencia', 'Tarjeta de <em>crédito</em>', 'Sube cada gasto con su factura y, cuando llegue el extracto, concílialo.')
        + `<section class="card tc-vacio"><span class="eyebrow">Antes de empezar</span><h2>Agrega la tarjeta de la empresa</h2>
          <p class="hint">Solo se guardan los últimos 4 dígitos: nunca el número completo, la fecha de vencimiento ni el código de seguridad.</p>${formTarjetaTc()}</section>`;
    }
    const e = tcExtracto(), t = tcTarjeta(), enGastos = T.paso === 'gastos';
    const selTarjeta = T.tarjetas.length > 1 ? `<label class="field"><span>Tarjeta</span><select data-tcsel="tarjeta">${T.tarjetas.map((x) => `<option value="${x.id}"${x.id === T.tarjeta ? ' selected' : ''}>${esc(x.nombre)} ···${esc(x.ultimos4)}</option>`).join('')}</select></label>` : '';
    const selExtracto = T.extractos.length ? `<label class="field"><span>Extracto</span><select data-tcsel="extracto">${T.extractos.map((x) => `<option value="${x.id}"${x.id === T.extracto ? ' selected' : ''}>${esc(periodoTexto(x))}${x.estado === 'cerrado' ? ' · cerrado' : ''}</option>`).join('')}</select></label>` : '';
    const barra = `<div class="tc-barra">
        <div class="tc-id">${ico('tarjeta')}<div><b>${esc(t.nombre)} ···${esc(t.ultimos4)}</b><small>${esc([t.banco, t.franquicia].filter(Boolean).join(' · '))}${t.cupo ? ` · cupo ${plata(t.cupo)}` : ''}</small></div></div>
        ${selTarjeta}${enGastos ? '' : selExtracto}
        <div class="tc-barra-acc">${vivoTc()}
          ${enGastos ? '' : `<button type="button" class="btn ghost sm" data-accion="tcAbrir" data-panel="extracto"${T.abierto === 'extracto' ? ' disabled' : ''}>${ico('mas')}Nuevo extracto</button>`}
          <button type="button" class="btn txt sm" data-accion="tcAbrir" data-panel="tarjeta">${ico('tarjeta')}Otra tarjeta</button>
        </div>
      </div>`;
    const panelArriba = !enGastos && (T.abierto === 'extracto' || T.abierto === 'editarExtracto') ? `<section class="card tc-panel">${formExtractoTc(T.abierto === 'editarExtracto' ? e : null)}</section>`
      : T.abierto === 'tarjeta' ? `<section class="card tc-panel"><span class="eyebrow">Nueva tarjeta</span><h2>Agregar otra tarjeta</h2>${formTarjetaTc()}</section>` : '';
    const cabeza = encabezado('Gerencia', 'Tarjeta de <em>crédito</em>', 'Paso 1: sube cada gasto con su factura apenas lo hagas. Paso 2: cuando llegue el extracto, cárgalo y concilia.') + pasosTc() + barra;
    if (enGastos) return cabeza + panelArriba + gastosTc();
    if (!e) {
      return cabeza + (panelArriba || `<section class="card tc-vacio"><span class="eyebrow">Paso 2</span><h2>Crea el primer extracto</h2><p class="hint">Copia los datos de la primera página del extracto del banco: fechas del periodo, fecha límite de pago y saldos.</p>${formExtractoTc(null)}</section>`);
    }
    const c = calcularTc(), sug = sugerenciasTc(), cerrado = tcCerrado();
    const nSug = [...sug.values()].length;

    const resumen = `<section class="card tc-extracto">
        <div class="tc-ext-dl">
          <div><span>Periodo</span><b>${esc(periodoTexto(e))}</b></div>
          <div><span>Total a pagar</span><b>${e.saldo_nuevo == null ? '—' : plata(e.saldo_nuevo)}</b></div>
          <div><span>Pago mínimo</span><b>${e.pago_minimo == null ? '—' : plata(e.pago_minimo)}</b></div>
          <div><span>Fecha límite de pago</span><b>${e.fecha_pago ? esc(fechaCorta(e.fecha_pago)) : '—'}</b>${c.diasPago != null && !cerrado ? `<span class="chip ${c.diasPago < 0 ? 'bad' : c.diasPago <= 5 ? 'warn' : 'mute'} xs">${c.diasPago < 0 ? `Venció hace ${plural(-c.diasPago, 'día', 'días')}` : c.diasPago === 0 ? 'Vence hoy' : `Faltan ${plural(c.diasPago, 'día', 'días')}`}</span>` : ''}</div>
        </div>
        <div class="tc-ext-estado">${cerrado ? `<span class="chip ok">${ico('check')}Cerrada${e.cerrado_por ? ` por ${esc(primerNombre(nombreDe(e.cerrado_por)))}` : ''}${e.cerrado_en ? ` · ${esc(fechaCorta(fechaEn(miTz(), new Date(e.cerrado_en))))}` : ''}</span>` : `<span class="chip warn">${ico('reloj')}Abierta</span><button type="button" class="btn txt sm" data-accion="tcAbrir" data-panel="editarExtracto">Editar datos del extracto</button>`}</div>
      </section>`;

    const tile = (filtro, etiqueta, valor, sub, extra) => `<button type="button" class="kpi${T.filtro === filtro ? ' on' : ''}" data-tcfiltro="${filtro}" aria-pressed="${T.filtro === filtro}"><span class="kpi-l">${etiqueta}</span><b class="kpi-v">${valor}</b>${extra || ''}<small>${sub}</small></button>`;
    const cuadra = c.diferencia == null ? '<span class="chip mute xs">Falta el total del extracto</span>'
      : Math.abs(c.diferencia) < 1 ? `<span class="chip ok xs">${ico('check')}Cuadra</span>` : `<span class="chip bad xs">${ico('alerta')}Diferencia</span>`;
    const kpis = `<div class="kpis" aria-label="Indicadores de la conciliación">
        <button type="button" class="kpi kpi-hero${T.filtro === 'todos' ? ' on' : ''}" data-tcfiltro="todos" aria-pressed="${T.filtro === 'todos'}">
          <span class="kpi-l">Avance de la conciliación</span><b class="kpi-v">${c.avance} %</b>
          <span class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${c.avance}" aria-label="Avance"><span style="width:${c.avance}%"></span></span>
          <small>${c.resueltos} de ${plural(c.total, 'movimiento', 'movimientos')} revisados</small></button>
        ${tile('pendientes', 'Por conciliar', plata(c.valorPend), plural(c.pend, 'movimiento', 'movimientos'))}
        ${tile('sin_soporte', 'Sin soporte', String(c.sinSop), c.sinSop ? `${plata(c.valorSinSop)} sin factura` : 'Todas las compras tienen factura')}
        ${tile('no_reconocidos', 'No reconocidos', plata(c.valorNoRec), c.noRec ? `${plural(c.noRec, 'cargo', 'cargos')} para reclamar al banco` : 'Ningún cargo en disputa')}
        ${tile('financieros', 'Intereses y cargos', plata(c.financieros), 'Intereses, cuota de manejo y comisiones')}
        ${tile('cuadre', 'Cuadre con el extracto', c.diferencia == null ? '—' : plata(c.diferencia), `Saldo anterior ${plata(e.saldo_anterior)} + cargos ${plata(c.cargos)} − pagos ${plata(c.abonos)} = ${plata(c.calculado)}`, cuadra)}
      </div>`;

    const acc = cerrado
      ? `<div class="tc-acc"><button type="button" class="btn ghost sm" data-accion="tcExportar">${ico('descargar')}Exportar a Excel</button>${botonInformeTc()}
          ${T.confirmar === 'reabrir' ? `<span class="confirmar">¿Reabrir? Se podrá editar de nuevo.<span><button type="button" class="btn sm" data-accion="tcReabrirSi"${ocupado('tc')}>Sí, reabrir</button><button type="button" class="btn txt sm" data-accion="tcNo">No</button></span></span>`
            : '<button type="button" class="btn txt sm" data-accion="tcReabrir">Reabrir conciliación</button>'}</div>`
      : `<div class="tc-acc">
          <button type="button" class="btn sm" data-accion="tcAbrir" data-panel="importar"${T.abierto === 'importar' ? ' disabled' : ''}>${ico('hoja')}Importar movimientos</button>
          <button type="button" class="btn ghost sm" data-accion="tcAbrir" data-panel="mov"${T.abierto === 'mov' ? ' disabled' : ''}>${ico('mas')}Agregar movimiento</button>
          <button type="button" class="btn ghost sm" data-accion="tcSugeridos"${nSug ? '' : ' disabled'}${ocupado('tc')}>${ico('check')}Conciliar sugeridos${nSug ? ` (${nSug})` : ''}</button>
          <button type="button" class="btn txt sm" data-accion="tcExportar">${ico('descargar')}Exportar a Excel</button>
          ${botonInformeTc()}
          ${T.confirmar === 'cerrar' ? `<span class="confirmar">${c.diferencia != null && Math.abs(c.diferencia) >= 1 ? `El saldo no cuadra por ${plata(c.diferencia)}. ¿Cerrar igual?` : '¿Cerrar? Ya no se podrá editar.'}<span><button type="button" class="btn sm" data-accion="tcCerrarSi"${ocupado('tc')}>Sí, cerrar</button><button type="button" class="btn txt sm" data-accion="tcNo">No</button></span></span>`
            : `<button type="button" class="btn ghost sm tc-cerrar" data-accion="tcCerrar"${c.pend ? ` disabled title="Quedan ${plural(c.pend, 'movimiento', 'movimientos')} por conciliar"` : ''}>${ico('check')}Cerrar conciliación</button>`}
        </div>`;

    const panel = cerrado ? '' : T.abierto === 'importar' ? `<section class="card tc-panel">${importarTc()}</section>`
      : T.abierto === 'mov' ? `<section class="card tc-panel">${formMovTc()}</section>` : '';

    const pest = `<div class="seg tc-pest" role="group" aria-label="Vista">${[['banco', `Extracto del banco (${T.movs.length})`], ['agencia', `Gastos subidos (${T.regs.length})`], ['resumen', 'Resumen por categoría']].map(([v, n]) => `<button type="button" data-tcpest="${v}" aria-pressed="${T.pestana === v}">${n}</button>`).join('')}</div>`;
    const cuerpo = T.pestana === 'agencia' ? agenciaTc() : T.pestana === 'resumen' ? resumenTc() : bancoTc(sug);

    return cabeza + panelArriba + resumen + kpis + acc + panel + pest + cuerpo;
  }

  function botonInformeTc() {
    const u = ultimoEnvioTc();
    return `<span class="tc-inf-btn"><button type="button" class="btn ghost sm" data-accion="tcInforme"${ocupado('tcInforme')}>${ico('correo')}Enviar informe por correo</button>${u ? `<small class="hint" title="${esc(u.destinatarios.join(', '))}">Enviado el ${esc(envioTexto(u))}</small>` : ''}</span>`;
  }

  function pasosTc() {
    const T = S.tc, e = tcExtracto();
    const sinSop = T.gastos.filter((g) => !g.soporte_ruta).length;
    const subG = `${plural(T.gastos.length, 'gasto', 'gastos')} en ${nombreMes(T.mes || fechaEn(miTz()).slice(0, 7)).split(' ')[0]}${sinSop ? ` · ${sinSop} sin soporte` : ''}`;
    const subC = e ? `Extracto ${periodoTexto(e)} · ${e.estado === 'cerrado' ? 'cerrado' : `${calcularTc().avance} % conciliado`}` : 'Aún no hay extractos';
    const paso = (id, n, titulo, sub) => `<button type="button" class="tc-paso${T.paso === id ? ' on' : ''}" data-tcpaso="${id}" aria-pressed="${T.paso === id}"><span class="tc-paso-n">${n}</span><span><b>${titulo}</b><small>${esc(sub)}</small></span></button>`;
    return `<nav class="tc-pasos" aria-label="Pasos">${paso('gastos', 1, 'Gastos y soportes', subG)}${paso('conciliar', 2, 'Conciliar con el extracto', subC)}</nav>`;
  }

  async function cargarGastos() {
    const T = S.tc;
    if (!T.mes) T.mes = fechaEn(miTz()).slice(0, 7);
    if (!T.tarjeta) { T.gastos = []; T.gastosCruces = new Map(); return; }
    const gastos = await todas(() => sb.from('tc_registros').select('*').eq('tarjeta_id', T.tarjeta).gte('fecha', T.mes + '-01').lte('fecha', ultimoDia(T.mes))
      .order('fecha', { ascending: false }).order('id', { ascending: false }));
    const ids = gastos.map((g) => g.id);
    const cruces = ids.length ? await todas(() => sb.from('tc_movimientos').select('id,registro_id,extracto_id,estado').in('registro_id', ids)) : [];
    T.gastosCruces = new Map(cruces.map((c) => [c.registro_id, c]));
    T.gastos = gastos;
    const conSoporte = gastos.filter((g) => g.soporte_ruta && !T.urls[g.soporte_ruta]).map((g) => ({ ruta: g.soporte_ruta }));
    await firmar('conciliacion', conSoporte);
    conSoporte.forEach((f) => { T.urls[f.ruta] = f.url; });
  }

  function gastosTc() {
    const T = S.tc, b = T.borrador, mes = T.mes || fechaEn(miTz()).slice(0, 7);
    const cruce = (g) => T.gastosCruces.get(g.id);
    const total = T.gastos.reduce((t, g) => t + Number(g.valor), 0);
    const sinSop = T.gastos.filter((g) => !g.soporte_ruta);
    const porConc = T.gastos.filter((g) => !cruce(g));
    const conc = T.gastos.filter((g) => cruce(g));
    const tile = (f, etiqueta, valor, sub) => `<button type="button" class="kpi${T.filtroG === f ? ' on' : ''}" data-tcfiltrog="${f}" aria-pressed="${T.filtroG === f}"><span class="kpi-l">${etiqueta}</span><b class="kpi-v">${valor}</b><small>${sub}</small></button>`;
    const kpis = `<div class="kpis kpis-4" aria-label="Indicadores de gastos">
        ${tile('todos', `Gastos de ${nombreMes(mes).split(' ')[0]}`, plata(total), plural(T.gastos.length, 'gasto', 'gastos'))}
        ${tile('sin_soporte', 'Sin soporte', String(sinSop.length), sinSop.length ? `${plata(sinSop.reduce((t, g) => t + Number(g.valor), 0))} sin factura` : 'Todos tienen factura')}
        ${tile('por_conciliar', 'Por conciliar', plata(porConc.reduce((t, g) => t + Number(g.valor), 0)), `${plural(porConc.length, 'gasto', 'gastos')} esperando el extracto`)}
        ${tile('conciliados', 'Ya en el extracto', String(conc.length), conc.length ? `${plata(conc.reduce((t, g) => t + Number(g.valor), 0))} cruzados` : 'Aún ninguno')}
      </div>`;
    const arch = T.archivoRegistro;
    const form = `<section class="card tc-gasto-form">
        <form data-form="tcGasto" data-borrador="tc" novalidate>
          <div class="tc-gasto-grid">
            <label class="tc-drop${arch ? ' lleno' : ''}">
              <input type="file" accept="image/*,.heic,application/pdf" data-tcregarchivo="1">
              ${arch && T.archivoUrl ? `<img src="${esc(T.archivoUrl)}" alt="">` : `<span class="tc-drop-i">${ico(arch ? 'documento' : 'clip')}</span>`}
              <b>${arch ? esc(arch.name) : 'Foto o PDF de la factura'}</b><small>${arch ? 'Toca para cambiarla' : 'Toca para tomar la foto o elegir el archivo'}</small>
            </label>
            <div class="tc-gasto-campos">
              <span class="eyebrow">Nuevo gasto</span>
              <div class="form-grid">
                <label class="field"><span>Valor</span><input name="valor" inputmode="decimal" value="${esc(b.valor || '')}" placeholder="$ 0" required></label>
                <label class="field"><span>Fecha</span><input type="date" name="fecha" value="${esc(b.fecha || fechaEn(miTz()))}" required></label>
                <label class="field tc-ancho2"><span>¿Qué se pagó?</span><input name="descripcion" maxlength="200" value="${esc(b.descripcion || '')}" placeholder="Ej.: Tiquetes Bogotá–Madrid · grupo Fátima" required></label>
                <label class="field"><span>Categoría</span><select name="categoria_id">${opcionesCat(b.categoria_id)}</select></label>
                ${T.grupos.length ? `<label class="field"><span>Grupo de viaje (opcional)</span><select name="grupo_id">${opcionesGrupo(b.grupo_id)}</select></label>` : ''}
              </div>
              <button class="btn" type="submit"${ocupado('tc')}>${ico('check')}Guardar gasto</button>
            </div>
          </div>
        </form>
      </section>`;
    const lista = T.gastos.filter((g) => T.filtroG === 'sin_soporte' ? !g.soporte_ruta : T.filtroG === 'por_conciliar' ? !cruce(g) : T.filtroG === 'conciliados' ? !!cruce(g) : true);
    const meses = [];
    for (let i = 0; i < 12; i++) { const d = new Date(Date.UTC(+fechaEn(miTz()).slice(0, 4), +fechaEn(miTz()).slice(5, 7) - 1 - i, 1)); meses.push(d.toISOString().slice(0, 7)); }
    if (!meses.includes(mes)) meses.push(mes);
    const filas = lista.map((g) => {
      const c = cruce(g);
      const estado = c ? `<span class="chip ok xs">${ico('check')}${c.estado === 'conciliado' ? 'Conciliado' : 'En el extracto'}</span>` : `<span class="chip warn xs">${ico('reloj')}Esperando el extracto</span>`;
      const acc = c ? '' : T.borrar === 'g' + g.id
        ? `<span class="confirmar">¿Borrar?<span><button type="button" class="btn sm danger" data-accion="tcBorrarGastoSi" data-id="${g.id}"${ocupado('tc')}>Sí</button><button type="button" class="btn txt sm" data-accion="tcNo">No</button></span></span>`
        : `<button type="button" class="btn txt sm" data-accion="tcBorrarGasto" data-id="${g.id}" aria-label="Borrar gasto">${ico('basura')}</button>`;
      return `<tr>
          <td class="nowrap tc-f">${esc(fechaCorta(g.fecha))}</td>
          <th scope="row" class="tc-desc"><b>${esc(g.descripcion)}</b><small>${esc([(tcGrupo(g.grupo_id) || {}).nombre, g.responsable_id ? primerNombre(nombreDe(g.responsable_id)) : ''].filter(Boolean).join(' · '))}</small></th>
          <td class="num nowrap">${plata(g.valor)}</td>
          <td class="tc-cat"><select data-tcregcampo="${g.id}:categoria_id" aria-label="Categoría"${c && c.estado === 'conciliado' ? ' disabled' : ''} class="${g.categoria_id ? '' : 'falta'}">${opcionesCat(g.categoria_id)}</select></td>
          <td class="tc-s">${soporteGastoTc(g)}</td>
          <td class="tc-e">${estado}</td>
          <td class="td-acc">${acc}</td>
        </tr>`;
    }).join('');
    return kpis + form + `<section class="tc-sec">
        <div class="toolbar"><h2 class="tc-h2">Gastos subidos</h2>
          <label class="field tc-mes"><span>Mes</span><select data-tcmes>${meses.map((m) => `<option value="${m}"${m === mes ? ' selected' : ''}>${esc(nombreMes(m))}</option>`).join('')}</select></label></div>
        <div class="tablewrap card flush"><table class="perm tc-tabla"><thead><tr><th scope="col">Fecha</th><th scope="col">Gasto</th><th scope="col" class="num">Valor</th><th scope="col">Categoría</th><th scope="col">Soporte</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
          <tbody>${filas || `<tr><td colspan="7" class="vacio">${T.gastos.length ? 'Ningún gasto coincide con el filtro.' : 'Aún no hay gastos este mes. Sube el primero arriba.'}</td></tr>`}</tbody></table></div>
      </section>`;
  }
  // El soporte de un gasto se puede cambiar mientras no esté en un extracto cerrado
  function soporteGastoTc(g) {
    const url = g.soporte_ruta ? S.tc.urls[g.soporte_ruta] : '';
    if (g.soporte_ruta) return `<span class="tc-sop">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${ico('clip')}Ver</a>` : `${ico('clip')}Adjunto`}<button type="button" class="btn txt sm" data-accion="tcQuitarSop" data-ref="r:${g.id}" aria-label="Quitar soporte">${ico('x')}</button></span>`;
    return `<label class="btn txt sm tc-subir tc-falta">${ico('clip')}Adjuntar<input type="file" accept="image/*,.heic,application/pdf" data-tcsop="r:${g.id}"></label>`;
  }

  function opcionesCat(sel, vacio) {
    return `<option value="">${vacio || 'Elige categoría'}</option>` + S.tc.categorias.map((c) => `<option value="${c.id}"${String(sel || '') === String(c.id) ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('');
  }
  function opcionesGrupo(sel) {
    return '<option value="">Sin grupo</option>' + S.tc.grupos.map((g) => `<option value="${g.id}"${String(sel || '') === String(g.id) ? ' selected' : ''}>${esc(g.nombre)}</option>`).join('');
  }
  function soporteTc(fila, tipo) {
    const url = fila.soporte_ruta ? S.tc.urls[fila.soporte_ruta] : '';
    if (fila.soporte_ruta) {
      return `<span class="tc-sop">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${ico('clip')}Ver</a>` : `${ico('clip')}Adjunto`}${tcCerrado() ? '' : `<button type="button" class="btn txt sm" data-accion="tcQuitarSop" data-ref="${tipo}:${fila.id}" aria-label="Quitar soporte">${ico('x')}</button>`}</span>`;
    }
    if (tipo === 'm' && fila.registro_id && (tcRegistro(fila.registro_id) || {}).soporte_ruta) {
      const r = tcRegistro(fila.registro_id), u = S.tc.urls[r.soporte_ruta];
      return `<span class="tc-sop">${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${ico('clip')}Del registro</a>` : `${ico('clip')}Del registro`}</span>`;
    }
    if (tcCerrado()) return '<span class="hint">—</span>';
    return `<label class="btn txt sm tc-subir">${ico('clip')}Adjuntar<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,.heic,application/pdf" data-tcsop="${tipo}:${fila.id}"></label>`;
  }

  function filtrarMovsTc(sug) {
    const T = S.tc, f = norm(T.q).trim();
    return T.movs.filter((m) => {
      if (f && !norm(`${m.descripcion} ${m.autorizacion || ''} ${(tcCategoria(m.categoria_id) || {}).nombre || ''} ${Math.round(Math.abs(m.valor))}`).includes(f)) return false;
      switch (T.filtro) {
        case 'pendientes': return m.estado === 'pendiente';
        case 'sin_soporte': return tcNecesitaSoporte(m) && !tcTieneSoporte(m);
        case 'no_reconocidos': return m.estado === 'no_reconocido';
        case 'financieros': return TC_FINANCIEROS.includes(m.tipo);
        case 'sugeridos': return sug.has(m.id);
        default: return true;
      }
    });
  }

  function bancoTc(sug) {
    const T = S.tc;
    const filtros = [['todos', 'Todos'], ['pendientes', 'Por conciliar'], ['sugeridos', 'Con sugerencia'], ['sin_soporte', 'Sin soporte'], ['no_reconocidos', 'No reconocidos'], ['financieros', 'Cargos del banco']];
    return `<section class="tc-sec">
        <div class="toolbar">
          <div class="seg tc-filtros" role="group" aria-label="Filtrar">${filtros.map(([v, n]) => `<button type="button" data-tcfiltro="${v}" aria-pressed="${T.filtro === v}">${n}</button>`).join('')}</div>
          <label class="search">${ico('buscar')}<input type="search" data-buscar="tc" value="${esc(T.q)}" placeholder="Buscar comercio, valor o autorización" aria-label="Buscar movimientos"></label>
        </div>
        <div class="tablewrap card flush"><table class="perm tc-tabla"><thead><tr><th scope="col">Fecha</th><th scope="col">Movimiento</th><th scope="col" class="num">Valor</th><th scope="col">Categoría y grupo</th><th scope="col">Soporte</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
          <tbody id="lista-tc">${filasMovTc(sug)}</tbody></table></div>
      </section>`;
  }

  function filasMovTc(sug) {
    const T = S.tc, lista = filtrarMovsTc(sug), cerrado = tcCerrado();
    if (!lista.length) return `<tr><td colspan="7" class="vacio">${T.movs.length ? 'Ningún movimiento coincide con el filtro.' : 'Aún no hay movimientos. Usa «Importar movimientos» para traerlos del extracto.'}</td></tr>`;
    return lista.map((m) => {
      const E = TC_ESTADOS[m.estado], s = sug.get(m.id), r = m.registro_id ? tcRegistro(m.registro_id) : null;
      const det = [TC_TIPOS[m.tipo], m.cuotas ? `${m.cuotas} cuotas` : '', m.autorizacion ? `Aut. ${m.autorizacion}` : '', m.moneda !== 'COP' && m.valor_origen ? `${m.moneda} ${Number(m.valor_origen).toLocaleString('es-CO')}` : ''].filter(Boolean).join(' · ');
      let sugTxt = '';
      if (m.estado === 'pendiente' && s) sugTxt = s.tipo === 'registro' ? `<small class="tc-sug">${ico('check')}Coincide con «${esc(s.registro.descripcion)}» · ${esc(fechaCorta(s.registro.fecha))}</small>`
        : s.tipo === 'pago' ? `<small class="tc-sug">${ico('check')}Pago a la tarjeta: se concilia solo</small>` : `<small class="tc-sug">${ico('check')}Cargo del banco: va a «Gastos bancarios»</small>`;
      const confirmarBorrar = T.borrar === m.id;
      let acciones;
      if (cerrado) acciones = '<span class="hint">Cerrado</span>';
      else if (confirmarBorrar) acciones = `<span class="confirmar">¿Borrar?<span><button type="button" class="btn sm danger" data-accion="tcBorrarMovSi" data-id="${m.id}"${ocupado('tc')}>Sí</button><button type="button" class="btn txt sm" data-accion="tcNo">No</button></span></span>`;
      else if (m.estado === 'pendiente') {
        acciones = `<button type="button" class="btn sm" data-accion="tcConciliar" data-id="${m.id}"${ocupado('tc')}>${ico('check')}Conciliar</button>
          <span class="tc-mas"><button type="button" class="btn txt sm" data-accion="tcEstado" data-id="${m.id}" data-estado="no_reconocido"${ocupado('tc')}>No lo reconozco</button>
          <button type="button" class="btn txt sm" data-accion="tcEstado" data-id="${m.id}" data-estado="personal"${ocupado('tc')}>Personal</button>
          <button type="button" class="btn txt sm" data-accion="tcBorrarMov" data-id="${m.id}" aria-label="Borrar movimiento">${ico('basura')}</button></span>`;
      } else acciones = `<button type="button" class="btn txt sm" data-accion="tcEstado" data-id="${m.id}" data-estado="pendiente"${ocupado('tc')}>Deshacer</button>`;
      const catSel = tcNecesitaCategoria(m) || m.categoria_id
        ? `<select data-tccampo="m:${m.id}:categoria_id" aria-label="Categoría"${cerrado ? ' disabled' : ''} class="${!m.categoria_id && m.estado === 'pendiente' ? 'falta' : ''}">${opcionesCat(m.categoria_id)}</select>`
        : `<span class="hint">${m.tipo === 'pago' ? 'Pago a la tarjeta' : 'Gastos bancarios'}</span>`;
      const grupoSel = S.tc.grupos.length && (m.tipo === 'compra' || m.tipo === 'avance') ? `<select data-tccampo="m:${m.id}:grupo_id" aria-label="Grupo"${cerrado ? ' disabled' : ''}>${opcionesGrupo(m.grupo_id)}</select>` : '';
      return `<tr class="tc-${m.estado}">
          <td class="nowrap tc-f">${esc(fechaCorta(m.fecha))}</td>
          <th scope="row" class="tc-desc"><b>${esc(m.descripcion)}</b><small>${esc(det)}</small>${r ? `<small class="tc-cruce">${ico('documento')}Registro: ${esc(r.descripcion)}</small>` : ''}${m.nota ? `<small class="tc-nota">${esc(m.nota)}</small>` : ''}${sugTxt}</th>
          <td class="num nowrap${Number(m.valor) < 0 ? ' abono' : ''}">${Number(m.valor) < 0 ? '−' : ''}${plata(Math.abs(m.valor))}</td>
          <td class="tc-cat">${catSel}${grupoSel}</td>
          <td class="tc-s">${soporteTc(m, 'm')}</td>
          <td class="tc-e"><span class="chip ${E.cls} xs">${ico(E.icono)}${E.nombre}</span></td>
          <td class="td-acc">${acciones}</td>
        </tr>`;
    }).join('');
  }

  function agenciaTc() {
    const T = S.tc, e = tcExtracto(), cerrado = tcCerrado();
    const enMov = new Map(T.movs.filter((m) => m.registro_id).map((m) => [m.registro_id, m]));
    const filas = T.regs.map((r) => {
      const m = enMov.get(r.id);
      const estado = m ? `<span class="chip ok xs">${ico('check')}En el extracto</span><small class="hint">${esc(m.descripcion)}</small>`
        : r.fecha > e.hasta ? `<span class="chip info xs">${ico('reloj')}Después del corte</span><small class="hint">Saldrá en el próximo extracto</small>`
        : `<span class="chip warn xs">${ico('alerta')}Sin cargo en el extracto</span><small class="hint">Revisa si se cobró o sigue en tránsito</small>`;
      const borrar = T.borrar === 'r' + r.id
        ? `<span class="confirmar">¿Borrar?<span><button type="button" class="btn sm danger" data-accion="tcBorrarRegSi" data-id="${r.id}"${ocupado('tc')}>Sí</button><button type="button" class="btn txt sm" data-accion="tcNo">No</button></span></span>`
        : m ? '' : `<button type="button" class="btn txt sm" data-accion="tcBorrarReg" data-id="${r.id}" aria-label="Borrar registro">${ico('basura')}</button>`;
      return `<tr>
          <td class="nowrap tc-f">${esc(fechaCorta(r.fecha))}</td>
          <th scope="row" class="tc-desc"><b>${esc(r.descripcion)}</b><small>${esc([(tcCategoria(r.categoria_id) || {}).nombre, (tcGrupo(r.grupo_id) || {}).nombre, r.responsable_id ? primerNombre(nombreDe(r.responsable_id)) : ''].filter(Boolean).join(' · '))}</small></th>
          <td class="num nowrap">${plata(r.valor)}</td>
          <td class="tc-s">${soporteTc(r, 'r')}</td>
          <td class="tc-est-reg">${estado}</td>
          <td class="td-acc">${cerrado ? '' : borrar}</td>
        </tr>`;
    }).join('');
    return `<section class="tc-sec">
        <p class="hint">Lo que el equipo registró que pagó con la tarjeta. Cada registro se cruza con un cargo del extracto (mismo valor, hasta 5 días de diferencia). Un registro sin cargo puede estar en tránsito o ser un cobro que el banco no hizo.</p>
        <div class="tablewrap card flush"><table class="perm tc-tabla"><thead><tr><th scope="col">Fecha</th><th scope="col">Registro</th><th scope="col" class="num">Valor</th><th scope="col">Soporte</th><th scope="col">Cruce</th><th scope="col">Acciones</th></tr></thead>
          <tbody>${filas || '<tr><td colspan="6" class="vacio">Aún no hay registros de la agencia para este periodo.</td></tr>'}</tbody></table></div>
      </section>`;
  }

  function resumenTc() {
    const { cats: filas, grupos, total } = gastosPorTc();
    const max = Math.max(1, ...filas.map((f) => f[1]));
    const barras = (lista, maxV, totalV) => lista.map(([n, v]) => `<li class="tc-bar" title="${esc(n)}: ${plata(v)} (${Math.round((v / totalV) * 100)} %)">
        <span class="tc-bar-n">${esc(n)}</span><span class="tc-bar-t"><span style="width:${Math.max(2, (v / maxV) * 100)}%"></span></span><span class="tc-bar-v">${plata(v)}<small>${Math.round((v / totalV) * 100)} %</small></span></li>`).join('');
    const c = calcularTc();
    return `<section class="tc-sec tc-resumen">
        <div class="card"><h2>Gasto por categoría</h2><p class="hint">Compras y cargos del banco del periodo, sin los no reconocidos ni los personales. Total ${plata(total)}.</p>
          ${filas.length ? `<ul class="tc-barras">${barras(filas, max, total)}</ul>` : '<p class="vacio">Aún no hay gastos.</p>'}</div>
        <div class="card"><h2>Gasto por grupo de viaje</h2><p class="hint">Lo que se pagó con la tarjeta para cada grupo.</p>
          ${grupos.length ? `<ul class="tc-barras">${barras(grupos, Math.max(1, ...grupos.map((g) => g[1])), grupos.reduce((t, g) => t + g[1], 0))}</ul>` : '<p class="vacio">Ningún cargo tiene grupo asignado.</p>'}
          <h2 class="tc-h2b">Por cobrar y por reclamar</h2>
          <dl class="tc-dl"><div><dt>Gastos personales (cobrar a la persona)</dt><dd>${plata(c.valorPers)}<small>${plural(c.pers, 'cargo', 'cargos')}</small></dd></div>
          <div><dt>No reconocidos (reclamo al banco)</dt><dd>${plata(c.valorNoRec)}<small>${plural(c.noRec, 'cargo', 'cargos')}</small></dd></div></dl></div>
      </section>`;
  }

  function formTarjetaTc() {
    const b = S.tc.borrador;
    return `<form data-form="tcTarjeta" data-borrador="tc" novalidate><div class="form-grid">
        <label class="field"><span>Nombre</span><input name="nombre" maxlength="60" value="${esc(b.nombre || '')}" placeholder="Ej.: Visa Empresarial" required></label>
        <label class="field"><span>Banco</span><input name="banco" maxlength="60" value="${esc(b.banco || '')}" placeholder="Ej.: Bancolombia"></label>
        <label class="field"><span>Franquicia</span><select name="franquicia">${TC_FRANQUICIAS.map((f) => `<option${(b.franquicia || 'Visa') === f ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
        <label class="field"><span>Últimos 4 dígitos</span><input name="ultimos4" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" value="${esc(b.ultimos4 || '')}" placeholder="1234" required></label>
        <label class="field"><span>Titular</span><input name="titular" maxlength="80" value="${esc(b.titular || '')}" placeholder="A nombre de quién está"></label>
        <label class="field"><span>Cupo (opcional)</span><input name="cupo" inputmode="numeric" value="${esc(b.cupo || '')}" placeholder="$ 0"></label>
      </div><div class="acc"><button class="btn" type="submit"${ocupado('tc')}>${ico('tarjeta')}Guardar tarjeta</button>${S.tc.tarjetas.length ? '<button class="btn txt" type="button" data-accion="tcCerrarPanel">Cancelar</button>' : ''}</div></form>`;
  }

  function formExtractoTc(e) {
    const T = S.tc, b = T.borrador, ult = T.extractos[0];
    const v = (k, def) => esc(b[k] != null ? b[k] : e ? (e[k] == null ? '' : e[k]) : def);
    const desdeDef = ult ? sumarDias(ult.hasta, 1) : '';
    return `<span class="eyebrow">${e ? 'Editar extracto' : 'Nuevo extracto'}</span><h2>${e ? 'Datos del extracto' : 'Datos de la primera página del extracto'}</h2>
      <form data-form="tcExtracto" data-borrador="tc" data-id="${e ? e.id : ''}" novalidate><div class="form-grid tc-grid3">
        <label class="field"><span>Desde</span><input type="date" name="desde" value="${v('desde', desdeDef)}" required></label>
        <label class="field"><span>Fecha de corte</span><input type="date" name="hasta" value="${v('hasta', '')}" required></label>
        <label class="field"><span>Fecha límite de pago</span><input type="date" name="fecha_pago" value="${v('fecha_pago', '')}"></label>
        <label class="field"><span>Saldo anterior</span><input name="saldo_anterior" inputmode="decimal" value="${v('saldo_anterior', ult && ult.saldo_nuevo != null ? ult.saldo_nuevo : '0')}"></label>
        <label class="field"><span>Total a pagar (saldo nuevo)</span><input name="saldo_nuevo" inputmode="decimal" value="${v('saldo_nuevo', '')}" placeholder="Para comprobar el cuadre"></label>
        <label class="field"><span>Pago mínimo</span><input name="pago_minimo" inputmode="decimal" value="${v('pago_minimo', '')}"></label>
      </div><div class="acc"><button class="btn" type="submit"${ocupado('tc')}>${e ? 'Guardar cambios' : `${ico('mas')}Crear extracto`}</button>${T.extractos.length ? '<button class="btn txt" type="button" data-accion="tcCerrarPanel">Cancelar</button>' : ''}</div></form>`;
  }

  function formRegistroTc() {
    const b = S.tc.borrador;
    return `<span class="eyebrow">Lado de la agencia</span><h2>Registrar un gasto pagado con la tarjeta</h2>
      <form data-form="tcRegistro" data-borrador="tc" novalidate><div class="form-grid tc-grid3">
        <label class="field"><span>Fecha</span><input type="date" name="fecha" value="${esc(b.fecha || fechaEn(miTz()))}" required></label>
        <label class="field tc-ancho"><span>Descripción</span><input name="descripcion" maxlength="200" value="${esc(b.descripcion || '')}" placeholder="Ej.: Tiquetes Bogotá–Madrid · grupo Fátima" required></label>
        <label class="field"><span>Valor</span><input name="valor" inputmode="decimal" value="${esc(b.valor || '')}" placeholder="$ 0" required></label>
        <label class="field"><span>Categoría</span><select name="categoria_id">${opcionesCat(b.categoria_id)}</select></label>
        ${S.tc.grupos.length ? `<label class="field"><span>Grupo (opcional)</span><select name="grupo_id">${opcionesGrupo(b.grupo_id)}</select></label>` : ''}
        <label class="field"><span>Factura o soporte (opcional)</span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,.heic,application/pdf" data-tcregarchivo="1"></label>
      </div><div class="acc"><button class="btn" type="submit"${ocupado('tc')}>${ico('mas')}Guardar registro</button><button class="btn txt" type="button" data-accion="tcCerrarPanel">Cancelar</button></div></form>`;
  }

  function formMovTc() {
    const b = S.tc.borrador;
    return `<span class="eyebrow">Lado del banco</span><h2>Agregar un movimiento del extracto a mano</h2>
      <form data-form="tcMov" data-borrador="tc" novalidate><div class="form-grid tc-grid3">
        <label class="field"><span>Fecha</span><input type="date" name="fecha" value="${esc(b.fecha || '')}" required></label>
        <label class="field tc-ancho"><span>Descripción como sale en el extracto</span><input name="descripcion" maxlength="200" value="${esc(b.descripcion || '')}" required></label>
        <label class="field"><span>Valor</span><input name="valor" inputmode="decimal" value="${esc(b.valor || '')}" placeholder="$ 0" required></label>
        <label class="field"><span>Tipo</span><select name="tipo">${Object.entries(TC_TIPOS).map(([k, n]) => `<option value="${k}"${(b.tipo || 'compra') === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field"><span>Autorización (opcional)</span><input name="autorizacion" maxlength="20" value="${esc(b.autorizacion || '')}"></label>
      </div><p class="hint">Los pagos y abonos se guardan en negativo automáticamente.</p>
      <div class="acc"><button class="btn" type="submit"${ocupado('tc')}>${ico('mas')}Agregar</button><button class="btn txt" type="button" data-accion="tcCerrarPanel">Cancelar</button></div></form>`;
  }

  // ---------- Importar: CSV del banco o filas pegadas desde Excel ----------
  const TC_MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, jan: 1, apr: 4, aug: 8, dec: 12 };
  function tablaDeTexto(texto) {
    const lineas = String(texto || '').replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim());
    if (!lineas.length) return [];
    const muestra = lineas.slice(0, 5).join('\n');
    const sep = muestra.includes('\t') ? '\t' : (muestra.split(';').length >= muestra.split(',').length ? ';' : ',');
    return lineas.slice(0, 2000).map((l) => {
      const celdas = [];
      let actual = '', comillas = false;
      for (let i = 0; i < l.length; i++) {
        const ch = l[i];
        if (ch === '"') { if (comillas && l[i + 1] === '"') { actual += '"'; i++; } else comillas = !comillas; }
        else if (ch === sep && !comillas) { celdas.push(actual.trim()); actual = ''; }
        else actual += ch;
      }
      celdas.push(actual.trim());
      return celdas;
    });
  }
  function fechaTc(s, desde) {
    s = String(s || '').trim().toLowerCase();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return valida(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) return valida(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
    m = s.match(/^(\d{1,2})[\s\-/.]*([a-zñ]{3})[a-zñ]*\.?[\s\-/.]*(\d{2,4})?/);
    if (m && TC_MESES[m[2]]) {
      const anio = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : +(desde || fechaEn(miTz())).slice(0, 4);
      return valida(anio, TC_MESES[m[2]], +m[1]);
    }
    return null;
    function valida(y, mes, d) {
      if (mes < 1 || mes > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
      const iso = `${y}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return new Date(iso + 'T12:00:00Z').toISOString().slice(0, 10) === iso ? iso : null;
    }
  }
  // Acepta $ 1.234.567, 1,234,567.89, (1.000), -45,50, 1.000 CR …
  function valorTc(s) {
    let t = String(s == null ? '' : s).trim();
    if (!t) return null;
    const neg = /^\(.*\)$/.test(t) || /-\s*$/.test(t) || /^-/.test(t) || /\bcr\b/i.test(t);
    t = t.replace(/[^\d.,]/g, '');
    if (!/\d/.test(t)) return null;
    const ultPunto = t.lastIndexOf('.'), ultComa = t.lastIndexOf(',');
    if (ultPunto >= 0 && ultComa >= 0) {
      const dec = ultPunto > ultComa ? '.' : ',';
      t = t.split(dec === '.' ? ',' : '.').join('').replace(dec, '.');
    } else if (ultComa >= 0 || ultPunto >= 0) {
      const sepc = ultComa >= 0 ? ',' : '.', partes = t.split(sepc);
      const decimal = partes.length === 2 && partes[1].length <= 2;
      t = decimal ? partes.join('.') : partes.join('');
    }
    const n = Number(t);
    if (!isFinite(n)) return null;
    return neg ? -n : n;
  }
  function tipoTc(desc) {
    const d = norm(desc);
    if (/\b(pago|abono|pse)\b/.test(d)) return 'pago';
    if (/interes/.test(d)) return 'interes';
    if (/cuota\s*(de\s*)?manejo/.test(d) && !/iva/.test(d)) return 'cuota_manejo';
    if (/comision|iva cuota|gmf|seguro de deuda/.test(d)) return 'comision';
    if (/avance/.test(d)) return 'avance';
    return 'compra';
  }
  const TC_COLS = [
    ['fecha', 'Fecha', /fecha|date|dia/],
    ['descripcion', 'Descripción', /descrip|concepto|detalle|comercio|establec|movimiento|transacc/],
    ['valor', 'Valor del cargo', /valor|monto|importe|cargo|debito|total|pesos/],
    ['abono', 'Abonos (si vienen aparte)', /abono|credito|pago/],
    ['autorizacion', 'Autorización', /autoriz|aprob|comprob|referenc/],
    ['cuotas', 'Cuotas', /^n?.?\s*cuotas?$|cuotas? (pactadas|totales)|plazo/],
  ];
  function analizarImportacion() {
    const I = S.tc.importar, filas = tablaDeTexto(I.texto);
    if (!filas.length) { I.filas = null; return; }
    const primera = filas[0].map((c) => norm(c));
    const tieneCab = primera.some((c) => TC_COLS.some(([, , rx]) => rx.test(c))) && !primera.some((c) => fechaTc(c));
    I.cab = tieneCab ? filas[0] : filas[0].map((_, i) => `Columna ${i + 1}`);
    I.filas = tieneCab ? filas.slice(1) : filas;
    const mapa = {}, usadas = new Set();
    if (tieneCab) {
      TC_COLS.forEach(([k, , rx]) => {
        const i = primera.findIndex((c, j) => !usadas.has(j) && rx.test(c));
        if (i >= 0) { mapa[k] = i; usadas.add(i); }
      });
    }
    // Sin encabezado: la fecha es la primera columna con fechas; el valor, la última con números; la descripción, la de más texto
    const muestra = I.filas.slice(0, 20), ncol = Math.max(...I.filas.map((f) => f.length));
    const cuenta = (fn) => Array.from({ length: ncol }, (_, j) => muestra.filter((f) => fn(f[j] || '')).length);
    if (mapa.fecha == null) { const c = cuenta((x) => !!fechaTc(x)); const i = c.indexOf(Math.max(...c)); if (c[i] > 0) { mapa.fecha = i; usadas.add(i); } }
    if (mapa.valor == null) { const c = cuenta((x) => /\d/.test(x) && valorTc(x) != null && !fechaTc(x) && /[\d][.,]?\d{3}|\d{4,}/.test(x)); for (let j = ncol - 1; j >= 0; j--) if (!usadas.has(j) && c[j] >= Math.max(1, muestra.length / 2)) { mapa.valor = j; usadas.add(j); break; } }
    if (mapa.descripcion == null) { const c = Array.from({ length: ncol }, (_, j) => usadas.has(j) ? -1 : muestra.reduce((t, f) => t + String(f[j] || '').replace(/[\d\s.,$-]/g, '').length, 0)); const i = c.indexOf(Math.max(...c)); if (c[i] > 0) mapa.descripcion = i; }
    I.mapa = mapa;
  }
  function movimientosImportados() {
    const T = S.tc, I = T.importar, e = tcExtracto(), M = I.mapa;
    const existentes = new Set(T.movs.map((m) => `${m.fecha}|${Math.round(Number(m.valor))}|${norm(m.descripcion).trim()}`));
    const vistos = new Set();
    const res = { buenos: [], malos: 0, repetidos: 0, fuera: 0 };
    (I.filas || []).forEach((f) => {
      const fecha = M.fecha != null ? fechaTc(f[M.fecha], e.desde) : null;
      const descripcion = String(M.descripcion != null ? f[M.descripcion] || '' : '').replace(/\s+/g, ' ').trim().slice(0, 200);
      let valor = M.valor != null ? valorTc(f[M.valor]) : null;
      const abono = M.abono != null ? valorTc(f[M.abono]) : null;
      if (abono) valor = (valor || 0) - Math.abs(abono);
      if (!fecha || !descripcion || !valor) { res.malos++; return; }
      const tipo = tipoTc(descripcion);
      if (tipo === 'pago' && valor > 0) valor = -valor;
      valor = Math.round(valor * 100) / 100;
      const clave = `${fecha}|${Math.round(valor)}|${norm(descripcion).trim()}`;
      if (existentes.has(clave) || vistos.has(clave)) { res.repetidos++; return; }
      vistos.add(clave);
      if (fecha < sumarDias(e.desde, -60) || fecha > e.hasta) res.fuera++;
      const cuotas = M.cuotas != null ? parseInt(String(f[M.cuotas]).replace(/\D/g, ''), 10) : null;
      const autorizacion = M.autorizacion != null ? String(f[M.autorizacion] || '').trim().slice(0, 20) : '';
      res.buenos.push({ extracto_id: e.id, fecha, descripcion, valor, tipo, cuotas: cuotas >= 1 && cuotas <= 72 ? cuotas : null, autorizacion: autorizacion || null,
        categoria_id: TC_FINANCIEROS.includes(tipo) ? tcCatId('Gastos bancarios') : null });
    });
    return res;
  }
  function importarTc() {
    const I = S.tc.importar;
    let previa = '';
    if (I.filas) {
      const r = movimientosImportados();
      const ncol = I.cab.length;
      const mapeo = `<div class="tc-mapa">${TC_COLS.map(([k, n]) => `<label class="field"><span>${n}</span><select data-tcmapa="${k}"><option value="">${k === 'abono' || k === 'autorizacion' || k === 'cuotas' ? 'No viene' : 'Elige columna'}</option>${Array.from({ length: ncol }, (_, j) => `<option value="${j}"${I.mapa[k] === j ? ' selected' : ''}>${esc(I.cab[j] || `Columna ${j + 1}`)}</option>`).join('')}</select></label>`).join('')}</div>`;
      const muestra = r.buenos.slice(0, 8).map((m) => `<tr><td class="nowrap">${esc(fechaCorta(m.fecha))}</td><td>${esc(m.descripcion)}</td><td>${TC_TIPOS[m.tipo]}</td><td class="num nowrap${m.valor < 0 ? ' abono' : ''}">${m.valor < 0 ? '−' : ''}${plata(Math.abs(m.valor))}</td></tr>`).join('');
      previa = `<h3>2. Revisa las columnas</h3>${mapeo}
        <div class="tc-cuenta"><span class="chip ok">${ico('check')}${plural(r.buenos.length, 'movimiento listo', 'movimientos listos')}</span>
          ${r.repetidos ? `<span class="chip mute">${plural(r.repetidos, 'repetido', 'repetidos')} (ya estaban)</span>` : ''}
          ${r.malos ? `<span class="chip warn">${ico('alerta')}${plural(r.malos, 'fila sin fecha o valor', 'filas sin fecha o valor')} (se omiten)</span>` : ''}
          ${r.fuera ? `<span class="chip info">${plural(r.fuera, 'fecha fuera del periodo', 'fechas fuera del periodo')} (cuotas de compras anteriores, por ejemplo)</span>` : ''}</div>
        ${muestra ? `<div class="tablewrap card flush"><table class="perm"><thead><tr><th scope="col">Fecha</th><th scope="col">Descripción</th><th scope="col">Tipo</th><th scope="col" class="num">Valor</th></tr></thead><tbody>${muestra}</tbody></table></div>${r.buenos.length > 8 ? `<p class="hint">… y ${r.buenos.length - 8} más.</p>` : ''}` : ''}
        <div class="acc"><button type="button" class="btn" data-accion="tcImportarSi"${r.buenos.length ? '' : ' disabled'}${ocupado('tc')}>${ico('hoja')}Importar ${plural(r.buenos.length, 'movimiento', 'movimientos')}</button><button type="button" class="btn txt" data-accion="tcCerrarPanel">Cancelar</button></div>`;
    }
    return `<span class="eyebrow">Lado del banco</span><h2>Importar los movimientos del extracto</h2>
      <p class="hint">Descarga el extracto en Excel o CSV desde la sucursal virtual del banco, selecciona las filas de movimientos y pégalas aquí (o sube el archivo CSV). Se reconocen solos los pagos, intereses, cuota de manejo y comisiones, y no se duplican movimientos que ya estén.</p>
      <h3>1. Pega las filas o sube el archivo</h3>
      <textarea class="tc-pegar" data-tcimport rows="6" placeholder="Fecha	Descripción	Valor&#10;03/10/2026	AVIANCA BOGOTA	1.250.000">${esc(I.texto)}</textarea>
      <div class="acc"><label class="btn ghost sm">${ico('clip')}Subir CSV<input type="file" accept=".csv,.txt,text/csv,text/plain" data-tcarchivo="1" hidden></label>
        <button type="button" class="btn sm" data-accion="tcAnalizar"${I.texto.trim() ? '' : ' disabled'}>Revisar</button></div>
      ${previa}`;
  }

  // ---------- Acciones ----------
  const numeroForm = (v) => { const n = valorTc(v); return n == null ? null : n; };
  async function guardarTarjetaTc() {
    const b = S.tc.borrador;
    const nombre = String(b.nombre || '').trim(), ultimos4 = String(b.ultimos4 || '').trim();
    if (!nombre) { toast('Escribe un nombre para la tarjeta.', 'bad'); return; }
    if (!/^\d{4}$/.test(ultimos4)) { toast('Escribe solo los últimos 4 dígitos de la tarjeta.', 'bad'); return; }
    await accion('tc', async () => {
      const t = await q(sb.from('tc_tarjetas').insert({ nombre, banco: String(b.banco || '').trim(), franquicia: b.franquicia || 'Visa', ultimos4, titular: String(b.titular || '').trim(), cupo: numeroForm(b.cupo) }).select().single());
      S.tc.tarjeta = t.id; S.tc.extracto = null; S.tc.abierto = null; S.tc.borrador = {};
      await cargarTarjeta();
      toast('Tarjeta guardada.');
    });
  }
  async function guardarExtractoTc(id) {
    const b = S.tc.borrador, e = id ? S.tc.extractos.find((x) => x.id === +id) : null;
    const val = (k) => (b[k] != null ? b[k] : e ? e[k] : undefined);
    const datos = {
      desde: val('desde') || (S.tc.extractos[0] ? sumarDias(S.tc.extractos[0].hasta, 1) : ''), hasta: val('hasta') || '', fecha_pago: val('fecha_pago') || null,
      saldo_anterior: numeroForm(val('saldo_anterior') != null ? val('saldo_anterior') : (S.tc.extractos[0] || {}).saldo_nuevo) || 0,
      saldo_nuevo: numeroForm(val('saldo_nuevo')), pago_minimo: numeroForm(val('pago_minimo')),
    };
    if (!datos.desde || !datos.hasta) { toast('Escribe las fechas del periodo.', 'bad'); return; }
    if (datos.hasta < datos.desde) { toast('La fecha de corte no puede ser antes del inicio.', 'bad'); return; }
    if (datos.fecha_pago && datos.fecha_pago < datos.hasta) { toast('La fecha límite de pago va después del corte.', 'bad'); return; }
    await accion('tc', async () => {
      if (e) await q(sb.from('tc_extractos').update(datos).eq('id', e.id));
      else { const n = await q(sb.from('tc_extractos').insert(Object.assign({ tarjeta_id: S.tc.tarjeta }, datos)).select().single()); S.tc.extracto = n.id; }
      S.tc.abierto = null; S.tc.borrador = {};
      await cargarTarjeta();
      toast(e ? 'Extracto actualizado.' : 'Extracto creado. Ahora importa sus movimientos.');
    });
  }
  async function guardarRegistroTc() {
    const b = S.tc.borrador, valor = numeroForm(b.valor), descripcion = String(b.descripcion || '').trim();
    if (!valor) { toast('Escribe el valor del gasto.', 'bad'); const i = document.querySelector('form[data-form=tcGasto] input[name=valor]'); if (i) i.focus(); return; }
    if (!descripcion) { toast('Escribe qué se pagó.', 'bad'); const i = document.querySelector('form[data-form=tcGasto] input[name=descripcion]'); if (i) i.focus(); return; }
    const archivo = S.tc.archivoRegistro;
    await accion('tc', async () => {
      const r = await q(sb.from('tc_registros').insert({ tarjeta_id: S.tc.tarjeta, fecha: b.fecha || fechaEn(miTz()), descripcion, valor, categoria_id: b.categoria_id ? +b.categoria_id : null,
        grupo_id: b.grupo_id ? +b.grupo_id : null, responsable_id: P().id }).select().single());
      if (archivo) await adjuntarTc('r', r.id, archivo, true);
      if (S.tc.archivoUrl) URL.revokeObjectURL(S.tc.archivoUrl);
      S.tc.abierto = null; S.tc.borrador = {}; S.tc.archivoRegistro = null; S.tc.archivoUrl = null;
      S.tc.mes = r.fecha.slice(0, 7);
      await Promise.all([cargarDatosExtracto(), cargarGastos()]);
      const s = sugerenciasTc();
      const m = [...s.entries()].find(([, x]) => x.registro && x.registro.id === r.id);
      toast(m ? 'Gasto guardado: coincide con un cargo del extracto.' : archivo ? 'Gasto guardado con su soporte.' : 'Gasto guardado. Falta el soporte: adjúntalo cuando lo tengas.', archivo || m ? 'ok' : 'warn');
    });
  }
  async function guardarMovTc() {
    const b = S.tc.borrador, e = tcExtracto(), descripcion = String(b.descripcion || '').trim();
    let valor = numeroForm(b.valor);
    if (!b.fecha || !descripcion || !valor) { toast('Escribe la fecha, la descripción y el valor.', 'bad'); return; }
    const tipo = b.tipo || 'compra';
    if (tipo === 'pago' && valor > 0) valor = -valor;
    await accion('tc', async () => {
      await q(sb.from('tc_movimientos').insert({ extracto_id: e.id, fecha: b.fecha, descripcion, valor, tipo, autorizacion: String(b.autorizacion || '').trim() || null,
        categoria_id: TC_FINANCIEROS.includes(tipo) ? tcCatId('Gastos bancarios') : null }));
      S.tc.abierto = null; S.tc.borrador = {};
      await cargarDatosExtracto();
      toast('Movimiento agregado.');
    });
  }
  async function importarSiTc() {
    const r = movimientosImportados();
    if (!r.buenos.length) return;
    await accion('tc', async () => {
      for (let i = 0; i < r.buenos.length; i += 200) await q(sb.from('tc_movimientos').insert(r.buenos.slice(i, i + 200)));
      S.tc.abierto = null; S.tc.importar = { texto: '', filas: null, mapa: {}, cab: [] };
      S.tc.filtro = 'todos';
      await cargarDatosExtracto();
      const n = sugerenciasTc().size;
      toast(`${plural(r.buenos.length, 'movimiento importado', 'movimientos importados')}.${n ? ` Hay ${plural(n, 'sugerencia', 'sugerencias')} para conciliar.` : ''}`);
    });
  }
  // Datos para conciliar un movimiento; null si le falta la categoría
  function datosConciliarTc(m, s) {
    const d = { estado: 'conciliado' };
    if (m.tipo === 'pago') return d;
    if (TC_FINANCIEROS.includes(m.tipo)) { if (!m.categoria_id) d.categoria_id = tcCatId('Gastos bancarios'); return d; }
    if (s && s.tipo === 'registro') {
      const r = s.registro;
      Object.assign(d, { registro_id: r.id });
      if (!m.categoria_id && r.categoria_id) d.categoria_id = r.categoria_id;
      if (!m.grupo_id && r.grupo_id) d.grupo_id = r.grupo_id;
      if (!m.responsable_id && r.responsable_id) d.responsable_id = r.responsable_id;
    }
    if (tcNecesitaCategoria(m) && !(d.categoria_id || m.categoria_id)) return null;
    return d;
  }
  async function conciliarTc(id) {
    const m = S.tc.movs.find((x) => x.id === id);
    if (!m) return;
    const d = datosConciliarTc(m, sugerenciasTc().get(id));
    if (!d) {
      toast('Elige la categoría antes de conciliar.', 'bad');
      const sel = document.querySelector(`[data-tccampo="m:${id}:categoria_id"]`);
      if (sel) sel.focus();
      return;
    }
    await accion('tc', async () => {
      await q(sb.from('tc_movimientos').update(d).eq('id', id));
      await cargarDatosExtracto();
      toast(d.registro_id ? 'Conciliado con el registro de la agencia.' : 'Conciliado.');
    });
  }
  async function sugeridosTc() {
    const sug = sugerenciasTc();
    const lista = S.tc.movs.filter((m) => sug.has(m.id)).map((m) => [m, datosConciliarTc(m, sug.get(m.id))]).filter(([, d]) => d);
    const sinCat = sug.size - lista.length;
    if (!lista.length) { toast('Las sugerencias necesitan categoría: elígela en cada movimiento.', 'warn'); return; }
    await accion('tc', async () => {
      for (const [m, d] of lista) await q(sb.from('tc_movimientos').update(d).eq('id', m.id));
      await cargarDatosExtracto();
      toast(`${plural(lista.length, 'movimiento conciliado', 'movimientos conciliados')}.${sinCat ? ` ${plural(sinCat, 'necesita', 'necesitan')} categoría.` : ''}`);
    });
  }
  async function estadoTc(id, estado) {
    const d = { estado };
    if (estado === 'pendiente') d.registro_id = null;
    await accion('tc', async () => {
      await q(sb.from('tc_movimientos').update(d).eq('id', id));
      await cargarDatosExtracto();
      toast(estado === 'no_reconocido' ? 'Marcado como no reconocido: repórtalo al banco para el reclamo.' : estado === 'personal' ? 'Marcado como gasto personal: cóbralo a la persona.' : 'Vuelve a quedar por conciliar.');
    });
  }
  async function adjuntarTc(tipo, id, archivo, silencioso) {
    const tabla = tipo === 'm' ? 'tc_movimientos' : 'tc_registros';
    const fila = (tipo === 'm' ? S.tc.movs : S.tc.regs.concat(S.tc.gastos)).find((x) => x.id === id) || { id };
    const { subidos, fallas } = await subirArchivos('conciliacion', `${S.tc.tarjeta}/${tipo}${id}`, [archivo]);
    if (fallas || !subidos.length) throw new Error('No se pudo subir el soporte. Revisa que sea una foto o un PDF de menos de 10 MB.');
    const viejo = fila.soporte_ruta;
    await q(sb.from(tabla).update({ soporte_ruta: subidos[0].ruta, soporte_nombre: String(archivo.name || '').slice(0, 200) }).eq('id', id));
    if (viejo) await sb.storage.from('conciliacion').remove([viejo]);
    if (!silencioso) toast('Soporte adjuntado.');
  }
  function exportarTc() {
    if (CFG.sinDescargas) { toast('En esta vista previa no se descargan archivos. En la intranet publicada, este botón baja el CSV para Excel.', 'warn'); return; }
    const { texto, nombre } = csvTc();
    const blob = new Blob([texto], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Archivo descargado. Ábrelo con Excel.');
  }

  // ---------- Tarjeta: informe de la conciliación por correo ----------
  // Los destinatarios reales están fijos en la Edge Function «enviar-informe-tarjeta»;
  // esta lista solo se muestra para que quien envía sepa a quién le llega.
  const TC_INFORME_PARA = [
    { nombre: 'Yenny Huerfano', cargo: 'Financiero', correo: 'financiero@agenciacaminos.com.co' },
    { nombre: 'Jhon Guataquira', cargo: 'Dirección', correo: 'director@agenciacaminos.com.co' },
  ];
  const paraTexto = () => TC_INFORME_PARA.map((d) => primerNombre(d.nombre)).join(' y ');

  // Gasto del periodo (sin no reconocidos ni personales) por categoría y por grupo
  function gastosPorTc() {
    const gastos = S.tc.movs.filter((m) => Number(m.valor) > 0 && m.estado !== 'no_reconocido' && m.estado !== 'personal');
    const porCat = new Map(), porGrupo = new Map();
    gastos.forEach((m) => {
      const n = (tcCategoria(m.categoria_id) || {}).nombre || (TC_FINANCIEROS.includes(m.tipo) ? 'Gastos bancarios' : 'Sin categoría');
      porCat.set(n, (porCat.get(n) || 0) + Number(m.valor));
      if (m.grupo_id) { const g = (tcGrupo(m.grupo_id) || {}).nombre || 'Grupo'; porGrupo.set(g, (porGrupo.get(g) || 0) + Number(m.valor)); }
    });
    const orden = (mapa) => [...mapa.entries()].sort((a, b) => b[1] - a[1]);
    const cats = orden(porCat), grupos = orden(porGrupo);
    return { cats, grupos, total: cats.reduce((t, f) => t + f[1], 0) };
  }

  async function cargarEnviosTc() {
    const e = tcExtracto();
    S.tc.envios = [];
    if (!e) return;
    // Si la migración 024 aún no está en el servidor, la pestaña sigue funcionando sin el historial
    const { data, error } = await sb.from('tc_envios').select('*').eq('extracto_id', e.id).order('enviado_en', { ascending: false }).limit(5);
    if (!error) S.tc.envios = data || [];
  }
  const ultimoEnvioTc = () => (S.tc.envios || []).find((x) => x.ok !== false) || null;
  function envioTexto(x) {
    const d = new Date(x.enviado_en);
    return `${fechaCorta(fechaEn(miTz(), d))} · ${hhmm(horaEn(miTz(), d))}${x.enviado_por ? ` por ${primerNombre(nombreDe(x.enviado_por))}` : ''}`;
  }

  // CSV para Excel (BOM, «;» y \r\n): el mismo del botón «Exportar a Excel» y del adjunto del correo
  function csvTc() {
    const e = tcExtracto(), t = tcTarjeta(), c = calcularTc();
    const celda = (v) => { let s = String(v == null ? '' : v); if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = "'" + s; return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const num = (v) => (Math.round(Number(v) * 100) / 100).toFixed(2).replace('.', ',');
    const cab = ['Fecha', 'Descripción', 'Tipo', 'Valor', 'Moneda', 'Valor en moneda original', 'Cuotas', 'Autorización', 'Categoría', 'Grupo', 'Estado', 'Soporte', 'Registro de la agencia', 'Nota', 'Conciliado por'];
    const lineas = [
      [`Conciliación ${t.nombre} ···${t.ultimos4}`, `Periodo ${e.desde} a ${e.hasta}`].map(celda).join(';'),
      ['Saldo anterior', num(e.saldo_anterior), 'Cargos', num(c.cargos), 'Pagos', num(c.abonos), 'Saldo calculado', num(c.calculado), 'Total del extracto', e.saldo_nuevo == null ? '' : num(e.saldo_nuevo), 'Diferencia', c.diferencia == null ? '' : num(c.diferencia)].map(celda).join(';'),
      '',
      cab.join(';'),
    ].concat(S.tc.movs.map((m) => [m.fecha, m.descripcion, TC_TIPOS[m.tipo], num(m.valor), m.moneda, m.valor_origen == null ? '' : num(m.valor_origen), m.cuotas || '', m.autorizacion || '',
      (tcCategoria(m.categoria_id) || {}).nombre || '', (tcGrupo(m.grupo_id) || {}).nombre || '', TC_ESTADOS[m.estado].nombre, tcTieneSoporte(m) ? 'Sí' : 'No',
      m.registro_id ? (tcRegistro(m.registro_id) || {}).descripcion || '' : '', m.nota || '', m.conciliado_por ? nombreDe(m.conciliado_por) : ''].map(celda).join(';')));
    return { texto: '﻿' + lineas.join('\r\n') + '\r\n', nombre: `conciliacion-${nombreArchivo(t.nombre)}-${t.ultimos4}-${e.hasta}.csv` };
  }

  // Correo en HTML con estilos en línea (Gmail y Outlook ignoran las hojas de estilo)
  function informeTc(nota) {
    const e = tcExtracto(), t = tcTarjeta(), c = calcularTc(), g = gastosPorTc(), cerrado = e.estado === 'cerrado';
    const yoN = P().nombre || 'La gerencia';
    const estadoTxt = cerrado
      ? `Cerrada${e.cerrado_por ? ` por ${nombreDe(e.cerrado_por)}` : ''}${e.cerrado_en ? ` el ${fechaCorta(fechaEn(miTz(), new Date(e.cerrado_en)))}` : ''}`
      : `Abierta · ${c.avance} % conciliado (${c.resueltos} de ${plural(c.total, 'movimiento', 'movimientos')})`;
    const cuadraTxt = c.diferencia == null ? 'Falta el total del extracto' : Math.abs(c.diferencia) < 1 ? 'Cuadra' : `Diferencia de ${plata(c.diferencia)}`;
    const asunto = `Conciliación tarjeta ${t.nombre} ···${t.ultimos4} · ${periodoTexto(e)} · ${cerrado ? 'cerrada' : `${c.avance} % conciliada`}`;
    const F = "font-family:Poppins,Arial,Helvetica,sans-serif;";
    const td = (v, extra) => `<td style="${F}padding:8px 10px;border-bottom:1px solid #EEE7DF;font-size:13px;color:#1F2024;${extra || ''}">${v}</td>`;
    const th = (v, extra) => `<th align="left" style="${F}padding:8px 10px;border-bottom:2px solid #E4DBD1;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6B6E76;font-weight:600;${extra || ''}">${v}</th>`;
    const h2 = (v) => `<h2 style="${F}font-size:16px;margin:26px 0 8px;color:#1F2024;">${v}</h2>`;
    const tabla = (filas) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${filas}</table>`;
    const dato = (l, v, color) => `<tr>${td(esc(l), 'color:#6B6E76;')}${td(`<b style="color:${color || '#1F2024'};">${v}</b>`, 'text-align:right;white-space:nowrap;')}</tr>`;
    const pct = (v, tot) => (tot ? Math.round((v / tot) * 100) : 0);

    const resumen = tabla([
      dato('Total a pagar', e.saldo_nuevo == null ? '—' : esc(plata(e.saldo_nuevo))),
      dato('Pago mínimo', e.pago_minimo == null ? '—' : esc(plata(e.pago_minimo))),
      dato('Fecha límite de pago', e.fecha_pago ? esc(fechaCorta(e.fecha_pago) + ' ' + e.fecha_pago.slice(0, 4)) : '—', !cerrado && c.diasPago != null && c.diasPago <= 5 ? '#C0392B' : null),
      dato('Saldo anterior', esc(plata(e.saldo_anterior))),
      dato('Cargos del periodo', esc(plata(c.cargos))),
      dato('Pagos y abonos', esc(plata(c.abonos))),
      dato('Saldo calculado', esc(plata(c.calculado))),
      dato('Cuadre con el extracto', esc(cuadraTxt), c.diferencia != null && Math.abs(c.diferencia) < 1 ? '#1E7F4F' : '#C0392B'),
    ].join(''));

    const alertas = [
      c.pend ? ['Por conciliar', `${plural(c.pend, 'movimiento', 'movimientos')} · ${plata(c.valorPend)}`] : null,
      c.sinSop ? ['Compras sin soporte (factura)', `${plural(c.sinSop, 'compra', 'compras')} · ${plata(c.valorSinSop)}`] : null,
      c.noRec ? ['No reconocidos (reclamo al banco)', `${plural(c.noRec, 'cargo', 'cargos')} · ${plata(c.valorNoRec)}`] : null,
      c.pers ? ['Gastos personales (cobrar a la persona)', `${plural(c.pers, 'cargo', 'cargos')} · ${plata(c.valorPers)}`] : null,
      c.financieros ? ['Intereses, cuota de manejo y comisiones', plata(c.financieros)] : null,
    ].filter(Boolean);
    const bloqueAlertas = alertas.length
      ? tabla(alertas.map(([l, v]) => dato(l, esc(v), '#B5532A')).join(''))
      : `<p style="${F}font-size:13px;color:#1E7F4F;margin:0;">Sin pendientes, sin cargos en disputa y todas las compras con factura.</p>`;

    const tablaReparto = (filas, total) => filas.length
      ? tabla(`<tr>${th('Concepto')}${th('Valor', 'text-align:right;')}${th('%', 'text-align:right;')}</tr>` + filas.map(([n, v]) => `<tr>${td(esc(n))}${td(esc(plata(v)), 'text-align:right;white-space:nowrap;')}${td(pct(v, total) + ' %', 'text-align:right;color:#6B6E76;')}</tr>`).join('')
        + `<tr>${td('<b>Total</b>')}${td(`<b>${esc(plata(total))}</b>`, 'text-align:right;white-space:nowrap;')}${td('')}</tr>`)
      : `<p style="${F}font-size:13px;color:#6B6E76;margin:0;">Sin datos.</p>`;

    // Movimientos que piden atención (el detalle completo va en el adjunto)
    const motivo = (m) => m.estado === 'pendiente' ? 'Por conciliar' : m.estado === 'no_reconocido' ? 'No reconocido' : m.estado === 'personal' ? 'Personal' : 'Sin soporte';
    const atencion = S.tc.movs.filter((m) => m.estado === 'pendiente' || m.estado === 'no_reconocido' || m.estado === 'personal' || (tcNecesitaSoporte(m) && !tcTieneSoporte(m)));
    const MAX = 40;
    const bloqueAtencion = atencion.length
      ? tabla(`<tr>${th('Fecha')}${th('Descripción')}${th('Valor', 'text-align:right;')}${th('Revisar')}</tr>` + atencion.slice(0, MAX).map((m) => `<tr>${td(esc(fechaCorta(m.fecha)), 'white-space:nowrap;')}${td(esc(m.descripcion) + (m.nota ? `<br><span style="color:#6B6E76;font-size:12px;">${esc(m.nota)}</span>` : ''))}${td(esc(plata(m.valor)), 'text-align:right;white-space:nowrap;')}${td(esc(motivo(m)), 'white-space:nowrap;color:#B5532A;')}</tr>`).join(''))
        + (atencion.length > MAX ? `<p style="${F}font-size:12px;color:#6B6E76;">Y ${atencion.length - MAX} más en el archivo adjunto.</p>` : '')
      : `<p style="${F}font-size:13px;color:#1E7F4F;margin:0;">Ningún movimiento pendiente de revisión.</p>`;

    const notaHtml = String(nota || '').trim()
      ? `<div style="${F}margin:18px 0 0;padding:12px 14px;background:#FFF1EF;border-left:3px solid #F25061;border-radius:6px;font-size:13px;color:#1F2024;"><b>Nota de ${esc(primerNombre(yoN))}:</b><br>${esc(String(nota).trim()).replace(/\n/g, '<br>')}</div>` : '';

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(asunto)}</title></head>
<body style="margin:0;padding:0;background:#F7F3EE;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EE;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#FFFFFF;border-radius:14px;overflow:hidden;">
<tr><td style="background:#D63B4D;padding:22px 26px;">
  <div style="${F}font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#FFFFFF;opacity:.9;">Caminos · Intranet</div>
  <div style="${F}font-size:22px;font-weight:600;color:#FFFFFF;margin-top:4px;">Conciliación de la tarjeta de crédito</div>
  <div style="${F}font-size:14px;color:#FFFFFF;margin-top:6px;">${esc(t.nombre)} ···${esc(t.ultimos4)}${t.banco ? ' · ' + esc(t.banco) : ''} · Periodo ${esc(periodoTexto(e))}</div>
</td></tr>
<tr><td style="padding:22px 26px 28px;">
  <p style="${F}font-size:14px;color:#1F2024;margin:0;">Hola, ${esc(paraTexto())}: este es el informe de la conciliación de la tarjeta.</p>
  <p style="${F}font-size:13px;margin:10px 0 0;"><span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${cerrado ? '#E3F2E9' : '#FFF4DC'};color:${cerrado ? '#1E7F4F' : '#8A5A00'};font-weight:600;">${esc(estadoTxt)}</span></p>
  ${notaHtml}
  ${h2('Resumen del extracto')}${resumen}
  ${h2('Para revisar')}${bloqueAlertas}
  ${h2('Gasto por categoría')}${tablaReparto(g.cats, g.total)}
  ${g.grupos.length ? h2('Gasto por grupo de viaje') + tablaReparto(g.grupos, g.grupos.reduce((s, x) => s + x[1], 0)) : ''}
  ${h2('Movimientos que piden atención')}${bloqueAtencion}
  <p style="${F}font-size:12px;color:#6B6E76;margin:26px 0 0;line-height:1.5;">El detalle completo (${plural(c.total, 'movimiento', 'movimientos')}) va en el archivo adjunto, listo para abrir con Excel.<br>Enviado desde la Intranet Caminos por ${esc(yoN)} el ${esc(fechaCorta(fechaEn(miTz())))} a las ${esc(hhmm(horaEn(miTz())))}.</p>
</td></tr></table>
<p style="${F}font-size:11px;color:#9A9CA3;margin:14px 0 0;">${esc(MARCA.nombre)} · ${esc(MARCA.direccion)} · ${esc(MARCA.web)}</p>
</td></tr></table></body></html>`;

    const texto = [
      `Conciliación de la tarjeta ${t.nombre} ···${t.ultimos4} · Periodo ${periodoTexto(e)}`,
      estadoTxt,
      String(nota || '').trim() ? `\nNota de ${primerNombre(yoN)}: ${String(nota).trim()}` : '',
      '',
      `Total a pagar: ${e.saldo_nuevo == null ? '—' : plata(e.saldo_nuevo)}`,
      `Fecha límite de pago: ${e.fecha_pago || '—'}`,
      `Cuadre con el extracto: ${cuadraTxt}`,
      ...alertas.map(([l, v]) => `${l}: ${v}`),
      '',
      'Gasto por categoría:',
      ...g.cats.map(([n, v]) => `  ${n}: ${plata(v)} (${pct(v, g.total)} %)`),
      '',
      `El detalle completo va en el archivo adjunto. Enviado desde la Intranet Caminos por ${yoN}.`,
    ].join('\n').replace(/ /g, ' ');
    return { asunto, html, texto };
  }

  function abrirInformeTc() {
    S.tc.informe = { nota: '' };
    render();
    const n = document.querySelector('.modal textarea');
    if (n) n.focus();
  }
  let tcInfEspera = null;
  function refrescarVistaInforme() {
    clearTimeout(tcInfEspera);
    tcInfEspera = setTimeout(() => {
      const f = document.querySelector('.tc-inf-prev iframe');
      if (f && S.tc.informe) f.srcdoc = informeTc(S.tc.informe.nota).html;
    }, 300);
  }

  function informeTcView() {
    const I = S.tc.informe, c = calcularTc(), cerrado = tcCerrado(), inf = informeTc(I.nota), u = ultimoEnvioTc(), enviando = S.ocupado === 'tcInforme';
    return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="tcinf-t">
        <form class="modal-caja tc-inf" data-form="tcInforme">
          <span class="eyebrow">Informe por correo</span>
          <h2 id="tcinf-t">Enviar el informe de la conciliación</h2>
          <dl class="tc-inf-dl">
            <div><dt>Para</dt><dd class="tc-inf-para">${TC_INFORME_PARA.map((d) => `<span class="chip mute"><b>${esc(d.nombre)}</b><span>${esc(d.correo)}</span></span>`).join('')}</dd></div>
            <div><dt>Asunto</dt><dd>${esc(inf.asunto)}</dd></div>
            <div><dt>Adjunto</dt><dd>${ico('hoja')}${esc(csvTc().nombre)} <small class="hint">(detalle para Excel)</small></dd></div>
          </dl>
          ${cerrado ? '' : `<p class="notice warn tc-inf-aviso">${ico('alerta')}<span>La conciliación sigue abierta (${c.avance} %). El informe sale con el avance de este momento${c.pend ? ` y ${plural(c.pend, 'movimiento', 'movimientos')} por conciliar` : ''}.</span></p>`}
          ${u ? `<p class="hint tc-inf-ultimo">${ico('reloj')}Ya se envió el ${esc(envioTexto(u))}.</p>` : ''}
          <label class="field"><span>Nota para ellos (opcional)</span><textarea rows="2" maxlength="1000" data-tcinf="nota" placeholder="Ej.: el pago se hace el jueves; hay un cargo en reclamo con el banco">${esc(I.nota)}</textarea></label>
          <div class="tc-inf-prev"><span class="eyebrow">Vista previa del correo</span><iframe title="Vista previa del correo" sandbox="" srcdoc="${esc(inf.html)}"></iframe></div>
          <div class="modal-acc">
            <button type="button" class="btn ghost" data-accion="tcInformeCerrar"${enviando ? ' disabled' : ''}>Cancelar</button>
            <button type="submit" class="btn"${ocupado('tcInforme')}>${ico('correo')}${enviando ? 'Enviando…' : 'Enviar informe'}</button>
          </div>
        </form>
      </div>`;
  }

  async function enviarInformeTc() {
    const I = S.tc.informe;
    if (!I || !tcExtracto()) return;
    const inf = informeTc(I.nota), csv = csvTc();
    await accion('tcInforme', async () => {
      const { data, error } = await sb.functions.invoke('enviar-informe-tarjeta', {
        body: { extracto_id: S.tc.extracto, asunto: inf.asunto, html: inf.html, texto: inf.texto, csv: csv.texto, csv_nombre: csv.nombre, nota: String(I.nota || '').trim() },
      });
      if (error) {
        let msg = error.message;
        try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) { /* sin cuerpo */ }
        if (/not found|404|failed to send a request/i.test(msg)) msg = 'El envío de correos aún no está instalado en el servidor (Edge Function «enviar-informe-tarjeta»).';
        throw new Error(msg);
      }
      if (data && data.error) throw new Error(data.error);
      S.tc.informe = null;
      await cargarEnviosTc();
      toast(`Informe enviado a ${paraTexto()}.`);
    });
  }

  // ---------- Oficina: desde dónde se puede marcar (gerencia) ----------
  async function cargarOficina() {
    const [ip, equipos, sedes] = await Promise.all([
      q(sb.rpc('mi_ip')),
      q(sb.from('equipos').select('id,sede_id,nombre,activo,creado,ultimo_uso,ultima_ip').order('creado')),
      q(sb.from('sedes').select('*').order('id')),
    ]);
    S.ofi.ip = ip || null;
    S.ofi.equipos = equipos || [];
    S.sedes = sedes || S.sedes;
    if (!S.ofi.sede || !sedeDe(S.ofi.sede)) S.ofi.sede = P().sede_id;
  }

  function oficinaView() {
    const O = S.ofi, sede = sedeDe(O.sede) || {}, tz = miTz();
    const ips = sede.ips_oficina || [];
    const enOficina = !!O.ip && ips.includes(O.ip);
    const equipos = O.equipos.filter((e) => e.activo && e.sede_id === sede.id);
    const local = equipoLocal();
    const este = local && equipos.find((e) => e.id === local.id);
    const elegirSede = variasSedes() ? `<label class="field"><span>Sede</span><select data-ofisede aria-label="Sede">${S.sedes.map((x) => `<option value="${x.id}"${x.id === sede.id ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>` : '';

    const red = `<section class="modcard card">
        <div class="modcard-h">
          <div><span class="eyebrow">Control 1</span><h2>Solo desde la red de la oficina</h2><p class="hint">${validarIp() ? 'Activo: solo se puede marcar con el internet de la oficina. Con datos del celular u otra red, no.' : 'Apagado: se puede marcar desde cualquier internet.'}</p></div>
          <button type="button" class="switch" role="switch" aria-checked="${validarIp()}" data-accion="validarIp"${!validarIp() && !ips.length ? ' disabled title="Primero registra la IP de la oficina"' : ocupado('ofi')}><span></span><b>${validarIp() ? 'Activo' : 'Apagado'}</b></button>
        </div>
        ${elegirSede}
        <div class="ofi-ip"><span class="hint">Tu conexión ahora</span><b class="mono">${esc(O.ip || 'No se pudo leer')}</b>
          ${O.ip ? (enOficina ? '<span class="chip ok">Es la IP de la oficina</span>' : `<button type="button" class="btn sm" data-accion="ipAgregar"${ocupado('ofi')}>${ico('mas')}Registrar como IP de la oficina</button>`) : ''}</div>
        <p class="hint">Haz esto desde un computador conectado al internet de la oficina. La IP es la dirección pública del internet de la oficina: todos los equipos conectados allí salen con la misma.</p>
        <h3>IP registradas${sede.nombre && variasSedes() ? ` · ${esc(sede.nombre)}` : ''}</h3>
        ${ips.length ? `<ul class="ofi-lista">${ips.map((ip) => `<li><span class="mono">${esc(ip)}</span><button type="button" class="btn txt sm" data-accion="ipQuitar" data-ip="${esc(ip)}"${ocupado('ofi')}>Quitar</button></li>`).join('')}</ul>` : '<p class="vacio">Aún no hay ninguna IP registrada.</p>'}
        <div class="notice">${ico('alerta')}<div><p>Si el proveedor de internet cambia la IP de la oficina, nadie podrá marcar hasta que registres la nueva aquí. Pide al proveedor una <strong>IP fija</strong>. Ojo: un celular conectado al Wi-Fi de la oficina sale con la misma IP; para evitarlo, activa también el control 2.</p></div></div>
      </section>`;

    const filas = O.equipos.filter((e) => e.sede_id === sede.id).map((e) => {
      const confirmar = O.quitar === e.id;
      const acc = !e.activo ? '<span class="chip mute">Quitado</span>'
        : confirmar ? `<span class="confirmar">¿Quitar? Ya no podrá marcar.<span><button type="button" class="btn sm danger" data-accion="quitarEquipoSi"${ocupado('ofi')}>Sí</button><button type="button" class="btn txt sm" data-accion="quitarEquipoNo">No</button></span></span>`
        : `<button type="button" class="btn txt sm" data-accion="quitarEquipo" data-id="${e.id}"${ocupado('ofi')}>Quitar</button>`;
      return `<tr class="${e.activo ? '' : 'inactiva'}">
          <th scope="row"><b>${esc(e.nombre)}</b>${este && este.id === e.id ? ' <span class="chip ok xs">Este computador</span>' : ''}</th>
          <td>${e.ultimo_uso ? esc(fechaHora(e.ultimo_uso, tz)) : '<span class="hint">Aún no marca</span>'}</td>
          <td class="td-acc">${acc}</td>
        </tr>`;
    }).join('');
    const compu = `<section class="modcard card">
        <div class="modcard-h">
          <div><span class="eyebrow">Control 2</span><h2>Solo desde computadores autorizados</h2><p class="hint">${validarEquipo() ? 'Activo: solo se marca desde los computadores de esta lista. Celulares y otros computadores no pueden.' : 'Apagado: se puede marcar desde cualquier equipo.'}</p></div>
          <button type="button" class="switch" role="switch" aria-checked="${validarEquipo()}" data-accion="validarEquipo"${!validarEquipo() && !equipos.length ? ' disabled title="Primero autoriza al menos un computador"' : ocupado('ofi')}><span></span><b>${validarEquipo() ? 'Activo' : 'Apagado'}</b></button>
        </div>
        ${este ? `<div class="notice info">${ico('monitor')}<span>Este computador está autorizado como <strong>${esc(este.nombre)}</strong>.</span></div>`
          : `<div class="ofi-autorizar"><label class="field"><span>Nombre de este computador</span><input id="ofi-nombre" maxlength="60" value="${esc(O.nombre)}" placeholder="Ej.: Recepción, Ventas 1" autocomplete="off"></label>
            <button type="button" class="btn" data-accion="autorizarEquipo"${ocupado('ofi')}>${ico('monitor')}Autorizar este computador</button></div>`}
        <p class="hint">Entra a la intranet con tu cuenta <b>en cada computador de la oficina</b> y toca «Autorizar este computador». El navegador guarda una llave secreta; si se borran sus datos, se usa otro navegador o una ventana de incógnito, hay que autorizarlo otra vez.</p>
        <div class="tablewrap card flush"><table class="perm"><thead><tr><th scope="col">Computador</th><th scope="col">Última marca</th><th scope="col">Acciones</th></tr></thead>
          <tbody>${filas || '<tr><td colspan="3" class="vacio">Aún no hay computadores autorizados.</td></tr>'}</tbody></table></div>
      </section>`;

    const remoto = `<section class="card ofi-remoto">
        <span class="eyebrow">Fuera de la intranet</span><h2>Programas de acceso remoto</h2>
        <p>Con AnyDesk, TeamViewer, Chrome Remote Desktop o Escritorio remoto de Windows, alguien desde su casa puede manejar un computador de la oficina. Para la intranet eso se ve igual que estar sentado allí: ninguna página web puede detectarlo con certeza. Se evita con medidas en los computadores:</p>
        <ul>
          <li>Desinstalar esos programas y quitar a los asesores el permiso de administrador para instalar otros.</li>
          <li>Apagar el Escritorio remoto de Windows (Configuración → Sistema → Escritorio remoto).</li>
          <li>Bloquear en el router de la oficina los sitios de esos programas (anydesk.com, teamviewer.com, remotedesktop.google.com).</li>
          <li>Revisar cada mes la columna «Última marca» y las marcas a horas raras.</li>
        </ul>
      </section>`;

    return encabezado('Seguridad de la marcación', '<em>Oficina</em>', 'Decide desde dónde se puede marcar la jornada. Lo más seguro es activar los dos controles.')
      + red + compu + remoto;
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
        </ol><p>¿Olvidaste la contraseña? En la entrada toca «¿Olvidaste tu contraseña?» y te llega un enlace al correo para crear una nueva. También puedes pedirle una a la administración${S.personas.some((p) => p.rol === 'supervisor') ? ' o a un supervisor' : ''}. Para cambiarla cuando quieras, toca tu avatar y elige «Cambiar contraseña».</p>` },
      { id: 'marcar', titulo: 'Marcar la jornada', ver: true, html: `<p>En Inicio está tu <b>pase de jornada</b>. Tiene cuatro pasos y un solo botón grande con el que sigue:</p>
        <ul class="pasos-guia">${PASOS.map((x) => `<li><span class="leg-cod">${x.cod}</span>${x.nombre}</li>`).join('')}</ul>
        <ul>
          <li>La hora la pone el servidor: no importa la hora de tu celular o computador.</li>
          ${validarIp() || validarEquipo() ? `<li>Solo se puede marcar ${validarEquipo() ? 'desde los <b>computadores autorizados</b> de la oficina' : 'con el <b>internet de la oficina</b>'}. Desde el celular o desde la casa, no.</li>` : ''}
          <li>Tienes <b>${t.entrada} minutos</b> de gracia en la entrada y <b>${t.almuerzo} minutos</b> en el almuerzo.</li>
          <li>Si tu turno no tiene almuerzo (por ejemplo, los sábados), solo marcas entrada y salida.</li>
          <li>Si hoy no almuerzas, usa «Hoy no almuerzo · marcar salida».</li>
          <li>La salida también se mide: si te quedas más de <b>${t.salida} minutos</b> después de tu hora, el informe lo cuenta como tiempo adicional.</li>
          <li>Si te autorizaron a <b>entrar y salir más temprano</b>, al marcar la entrada (${t.temprano} min o más antes de tu turno) se abre una ventana: escribe el motivo, si cambia tu hora de salida y quién lo autorizó. Así tu salida no cuenta como «salida antes». Si la cerraste, en el pase aparece «Registrar autorización».</li>
          <li>Si tienes vacaciones, permiso o incapacidad aprobados, ese día no tienes que marcar.</li>
        </ul>` },
      { id: 'viaticos', titulo: 'Viáticos y legalización de gastos', ver: true, html: `<p>Está en <b>Viajes › Viáticos</b>. Sirve para los viajes de acompañamiento de grupos.</p>
        <ol>
          <li><b>Solicita</b> los viáticos: destino, fechas, el grupo (si lo eliges, se llenan solos el destino y las fechas) y el monto. ${esGerencia() ? 'Como gerencia también puedes <b>asignarlos</b> directamente a un funcionario: quedan aprobados con el presupuesto que pongas.' : 'La gerencia también puede asignártelos directamente.'}</li>
          <li>La <b>gerencia</b> fija el presupuesto y aprueba, o rechaza con el motivo.</li>
          <li>Durante y después del viaje, <b>registra cada gasto</b> con la foto de la factura o un PDF. Puedes quitar o agregar gastos hasta enviar.</li>
          <li>Toca <b>Enviar legalización</b>. La gerencia revisa: puede no aceptar un gasto (con el motivo), devolverte la legalización para corregir o aprobarla.</li>
          <li>Al aprobar queda el <b>saldo</b>: si gastaste menos, lo reintegras a Caminos; si gastaste más, Caminos te lo reembolsa. El botón «Formato de legalización» baja el documento para firmar.</li>
        </ol>
        <p>Cada quien ve solo sus viáticos; la gerencia ve los de todos. Nadie se aprueba a sí mismo.</p>` },
      { id: 'grupos', titulo: 'Grupos de viaje', ver: true, html: `<ul>
          <li><b>Tablero:</b> cada grupo es una tarjeta en una de siete columnas: Cotización / costeo, Propuesta comercial, Aprobado parroquia, Gestión comercial (bloqueos y lanzamiento), Ejecución grupo, En destino y Finalizado. Arrástrala a otra columna o usa las flechas de la tarjeta (en el celular, desliza para ver las demás columnas).</li>
          <li><b>Nuevo grupo:</b> nombre, destino, parroquia, fechas de salida y regreso, pasajeros, responsable, alcance y notas internas. Toca el nombre de una tarjeta para cambiarla o eliminarla.</li>
          <li><b>Línea de tiempo:</b> cada grupo con fechas es una barra del día de salida al de regreso; cambia de mes con las flechas.</li>
          <li><b>Google Calendar:</b> los grupos con fechas aparecen solos (puede tardar unos minutos). Cada parroquia tiene su calendario, «Grupos · nombre de la parroquia»; los grupos sin parroquia van a «Grupos Caminos». Para filtrar por parroquia, marca o desmarca esos calendarios en Google Calendar. Las notas internas no van al calendario.</li>
          <li>Todo el equipo puede crear, mover, cambiar y eliminar grupos; cada tarjeta guarda quién hizo el último cambio.</li>
        </ul>` },
      { id: 'malla', titulo: 'Malla, comunicados y herramientas', ver: true, html: `<ul>
          <li><b>Malla:</b> el horario de cada persona por semana. Las celdas con borde de color son cambios puntuales de ese día.</li>
          <li><b>Comunicados:</b> avisos internos. Si piden confirmación, léelos y toca «Confirmar lectura». En Inicio aparece una franja si tienes alguno pendiente.</li>
          <li><b>Herramientas:</b> las tarjetas de Inicio abren el Gestor de reservas, Caminos Documentos y el Cotizador en una pestaña nueva.</li>
        </ul>` },
      { id: 'gestion', titulo: 'Informes de gestión (ventas)', ver: esGerencia(), html: `<p>La pestaña «Gestión» muestra las ventas del gestor de reservas de AppSheet. Se actualiza sola todos los días a las 6 a. m., y cuando tocas <b>Actualizar</b>: un agente de Claude lee la hoja en ese momento y en unos minutos se ven los datos nuevos. La hoja nunca se modifica desde la intranet. Arriba a la derecha dice cuándo fue la última actualización.</p>
          <ul><li><b>Filtros:</b> elige un mes arriba, o una asesora, un estado o un tipo de venta. Todo el tablero cambia a la vez.</li>
          <li><b>Tocar para filtrar:</b> una columna del mes, un estado de la dona, una barra o una asesora también filtran todo. Tocar de nuevo quita el filtro. Los filtros activos quedan arriba, con «Quitar filtros».</li>
          <li><b>Medir por:</b> valor, número de ventas o utilidad.</li>
          <li><b>Ventas efectivas</b> son las confirmadas y facturadas. La <b>utilidad realizada</b> es su valor menos el costo de proveedores.</li>
          <li>Pasa el mouse por una gráfica para ver el detalle. «Exportar a Excel» baja las ventas filtradas.</li></ul>` },
      { id: 'tarjeta', titulo: 'Tarjeta de crédito: gastos y conciliación', ver: esGerencia(), html: `<p>La pestaña «Tarjeta» tiene dos pasos.</p>
        <p><b>Paso 1 · Gastos y soportes</b> (cada vez que pagas con la tarjeta):</p>
        <ol>
          <li>Toca el recuadro de la factura y toma la foto o elige el PDF.</li>
          <li>Escribe el valor, la fecha y qué se pagó. Elige la categoría y, si aplica, el grupo de viaje.</li>
          <li>Toca «Guardar gasto». Si aún no tienes la factura, guárdalo igual y adjúntala después: el indicador «Sin soporte» te recuerda cuáles faltan.</li>
        </ol>
        <p><b>Paso 2 · Conciliar con el extracto</b> (cuando llega el extracto del banco):</p>
        <ol>
          <li>Crea el extracto con los datos de su primera página: periodo, fecha límite de pago, saldo anterior y total a pagar.</li>
          <li>Importa los movimientos: descarga el extracto en Excel o CSV desde la sucursal virtual, copia las filas y pégalas (o sube el CSV).</li>
          <li>Toca «Conciliar sugeridos»: cada cargo se cruza con el gasto que subiste (mismo valor, hasta 5 días de diferencia), y los pagos e intereses se concilian solos.</li>
          <li>Revisa lo que quede. Si no reconoces un cargo, márcalo «No lo reconozco» y repórtalo al banco. Si fue de una persona, márcalo «Personal».</li>
          <li>Cuando «Cuadre con el extracto» diga <b>Cuadra</b> y no queden pendientes, toca «Cerrar conciliación».</li>
        </ol>
        <p>Los indicadores se actualizan al instante y cada uno filtra la lista. De la tarjeta solo se guardan los últimos 4 dígitos.</p>` },
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
      { id: 'lideres', titulo: 'Para quienes lideran una sede', ver: esLider(), html: `<ul>
          <li><b>Malla:</b> carga una vez el <b>horario fijo</b> de cada persona; la malla de cada semana se llena sola. Para un día distinto (un festivo, un cambio) toca la celda en «Semana». «↺ Volver al horario fijo» deshace el cambio.</li>
          <li><b>Turnos:</b> son las franjas de horario. Si cambias sus horas, cambian para todas las personas que lo tienen, también hacia atrás en los informes.</li>
          <li><b>Asistencia:</b> quién está trabajando hoy comparado con la malla. Toca «Actualizar» para ver lo último.</li>
          <li><b>Informes:</b> elige el periodo (un mes, el trimestre, el año, los últimos 7, 30 o 90 días) o pon fechas libres en «Desde» y «Hasta», hasta un año. Muestra puntualidad, llegadas tarde por día, semana o mes según el largo del periodo, quién llegó más tarde, el tiempo adicional (lo que la gente se queda después de su salida), los horarios ajustados por entrada temprana con quién los autorizó, y detalle por persona. «Exportar resumen» baja una fila por persona; «Detalle por día», una fila por jornada con horas marcadas y novedades.</li>
          <li><b>Comunicados:</b> publica avisos con imágenes y mira quién confirmó y quién falta.</li>
        </ul>` },
      { id: 'gerencia', titulo: 'Para la gerencia y la administración', ver: esGerencia(), html: `<ul>
          <li>En «Solicitudes» activas o apagas el módulo y decides quién revisa cada tipo. Apagarlo no borra nada.</li>
          <li>Las herramientas de Inicio, las tolerancias y la meta de puntualidad se cambian en la base de datos, sin programar.</li>
          ${esAdmin() ? '<li><b>Administración:</b> en «Equipo» creas cuentas de cualquier rol, asignas roles y desactivas cuentas. Asigna «Supervisor» a quien administrará cuentas y horarios sin darle poderes de gerencia.</li>' : ''}
        </ul>` },
      { id: 'faq', titulo: 'Preguntas frecuentes', ver: true, html: `<dl class="faq">
          <dt>¿Puedo marcar desde el celular?</dt><dd>${validarEquipo() ? 'No. Solo desde los computadores de la oficina que autorizó la gerencia.' : ip ? 'Solo si estás conectada a la red de la oficina. Desde datos móviles o desde otra red, la intranet no deja marcar.' : 'Sí, desde cualquier dispositivo. La hora la pone el servidor.'}</dd>
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

  // ---------- Grupos (tablero, línea de tiempo y calendario) ----------
  // Todo el equipo activo crea, mueve y borra grupos. Google Calendar los recibe
  // con un programa de Google (calendario/LEEME.md) que usa grupos_calendario().
  const COLUMNAS = [
    { id: 'cotizando', nombre: 'Cotización / costeo', cls: 'c1' },
    { id: 'propuesta', nombre: 'Propuesta comercial', cls: 'c6' },
    { id: 'confirmado', nombre: 'Aprobado parroquia', cls: 'c2' },
    { id: 'gestion', nombre: 'Gestión comercial, bloqueos, lanzamiento', cls: 'c7' },
    { id: 'documentacion', nombre: 'Ejecución grupo', cls: 'c3' },
    { id: 'en_viaje', nombre: 'En destino', cls: 'c4' },
    { id: 'finalizado', nombre: 'Finalizado', cls: 'c5' },
  ];
  const columna = (id) => COLUMNAS.find((c) => c.id === id) || COLUMNAS[0];
  const grupo = (id) => S.grupos.lista.find((g) => String(g.id) === String(id));
  const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
  function fechasGrupo(g) {
    if (!g.salida) return 'Sin fechas';
    if (!g.regreso) return `Sale el ${fechaCorta(g.salida)}`;
    const n = diasEntre(g.salida, g.regreso) + 1;
    return `${fechaCorta(g.salida)} → ${fechaCorta(g.regreso)} · ${plural(n, 'día', 'días')}`;
  }

  async function cargarGrupos() {
    S.grupos.lista = await todas(() => sb.from('grupos').select('*').order('salida', { ascending: true }).order('id'));
    if (!S.grupos.mes) S.grupos.mes = fechaEn(miTz()).slice(0, 7);
  }

  // Filtro por parroquia: '' todas, '__sin' los que no tienen
  const SIN_PARROQUIA = '__sin';
  function gruposFiltrados() {
    const f = S.grupos.parroquia || '';
    if (!f) return S.grupos.lista;
    return S.grupos.lista.filter((g) => (f === SIN_PARROQUIA ? !g.parroquia : g.parroquia === f));
  }
  function filtroParroquia() {
    const G = S.grupos, f = G.parroquia || '';
    const cuenta = new Map();
    G.lista.forEach((g) => { if (g.parroquia) cuenta.set(g.parroquia, (cuenta.get(g.parroquia) || 0) + 1); });
    const nombres = [...cuenta.keys()].sort((a, b) => a.localeCompare(b, 'es'));
    if (f && f !== SIN_PARROQUIA && !cuenta.has(f)) nombres.unshift(f);
    const sin = G.lista.filter((g) => !g.parroquia).length;
    return `<label class="filtro-parroquia">${ico('iglesia')}<select data-gparroquia aria-label="Filtrar por parroquia">
        <option value="">Todas las parroquias</option>
        ${nombres.map((n) => `<option value="${esc(n)}"${f === n ? ' selected' : ''}>${esc(n)} (${cuenta.get(n) || 0})</option>`).join('')}
        ${sin || f === SIN_PARROQUIA ? `<option value="${SIN_PARROQUIA}"${f === SIN_PARROQUIA ? ' selected' : ''}>Sin parroquia (${sin})</option>` : ''}
      </select></label>${f ? '<button type="button" class="btn txt sm" data-accion="gParroquiaTodas">Quitar filtro</button>' : ''}`;
  }

  function gruposView() {
    const G = S.grupos;
    const nuevo = `<button type="button" class="btn" data-accion="grupoNuevo"${G.abierto === 'nuevo' ? ' disabled' : ''}>${ico('mas')}Nuevo grupo</button>`;
    const barra = `<div class="toolbar">
        <div class="seg" role="group" aria-label="Vista">${[['tablero', 'Tablero'], ['tiempo', 'Línea de tiempo']].map(([v, n]) => `<button type="button" data-gvista="${v}" aria-pressed="${G.vista === v}">${n}</button>`).join('')}</div>
        ${filtroParroquia()}
        <span class="hint">${G.parroquia ? `${gruposFiltrados().length} de ${plural(G.lista.length, 'grupo', 'grupos')}` : plural(G.lista.length, 'grupo', 'grupos')}</span>
        ${esAdmin() ? `<button type="button" class="btn ghost sm" data-accion="calClave"${ocupado('calClave')}>${ico('calendario')}Conectar Google Calendar</button>` : ''}
      </div>`;
    const clave = G.clave ? `<section class="clave card" aria-live="polite">
        <span class="eyebrow">Google Calendar</span><h2>Clave del calendario</h2>
        <p class="hint">Pégala en el programa de Google (paso 4 de <b>calendario/LEEME.md</b>). Se muestra <b>una sola vez</b> y la clave anterior dejó de servir.</p>
        <dl><div><dt>Clave</dt><dd class="mono">${esc(G.clave)}</dd></div></dl>
        <div class="acc"><button type="button" class="btn" data-copiar="calendario">${ico('copiar')}Copiar</button><button type="button" class="btn ghost" data-accion="calCerrar">Listo</button></div>
      </section>` : '';
    return encabezado('Viajes', '<em>Grupos</em>', 'Cada grupo es una tarjeta: muévela de columna a medida que avanza. Los grupos con fechas aparecen en la línea de tiempo y en Google Calendar, con un calendario por parroquia para filtrar.', nuevo)
      + clave + (G.abierto ? grupoFormView() : '') + barra
      + (G.vista === 'tiempo' ? lineaTiempoView() : tableroView());
  }

  function tarjetaGrupo(g) {
    const i = COLUMNAS.findIndex((c) => c.id === g.estado);
    const resp = g.responsable_id && persona(g.responsable_id);
    return `<article class="kcard" draggable="true" data-arrastrar="${g.id}" data-gver="${g.id}">
        <div class="kcard-arriba">
          <button type="button" class="kcard-t" data-gver="${g.id}" aria-haspopup="dialog">${esc(g.nombre)}</button>
          ${g.destino ? `<span class="kcard-d">${ico('avion')}${esc(g.destino)}</span>` : ''}
        </div>
        <div class="kcard-abajo">
          <span class="kcard-p${g.parroquia ? '' : ' vacia'}">${ico('iglesia')}${g.parroquia ? esc(g.parroquia) : 'Sin parroquia'}</span>
          <span class="kcard-f">${ico('calendario')}${esc(fechasGrupo(g))}</span>
        </div>
        <div class="kcard-pie">
          <span>${g.pasajeros != null ? `${ico('usuarios')}${g.pasajeros}` : ''}${resp ? `<span class="avatar sm" title="${esc(resp.nombre)}">${esc(initials(resp.nombre))}</span>` : ''}</span>
          <span class="kcard-mover">
            <button type="button" class="btn txt sm kcard-ed" data-gabrir="${g.id}" aria-label="Editar ${esc(g.nombre)}" title="Editar">${ico('lapiz')}</button>
            <button type="button" class="btn txt sm" data-gmover="${g.id}|-1" aria-label="Mover a ${esc(i > 0 ? COLUMNAS[i - 1].nombre : '')}"${i <= 0 ? ' disabled' : ''}>${ico('izq')}</button>
            <button type="button" class="btn txt sm" data-gmover="${g.id}|1" aria-label="Mover a ${esc(i < COLUMNAS.length - 1 ? COLUMNAS[i + 1].nombre : '')}"${i >= COLUMNAS.length - 1 ? ' disabled' : ''}>${ico('der')}</button>
          </span>
        </div>
      </article>`;
  }

  function tableroView() {
    return `<div class="kanban">${COLUMNAS.map((c) => {
      const lista = gruposFiltrados().filter((g) => g.estado === c.id);
      return `<section class="kcol ${c.cls}" data-soltar="${c.id}" aria-label="${esc(c.nombre)}">
          <h2 class="kcol-h"><span>${esc(c.nombre)}</span><span class="badge">${lista.length}</span></h2>
          <div class="kcol-l">${lista.length ? lista.map(tarjetaGrupo).join('') : '<p class="vacio">Sin grupos</p>'}</div>
        </section>`;
    }).join('')}</div>`;
  }

  // Mes vacío: si es por el filtro, lo dice y ofrece saltar al próximo mes con grupos de esa parroquia
  function vacioLinea(mes, m, y) {
    const f = S.grupos.parroquia;
    if (!f) return `<p class="vacio">No hay grupos de viaje en ${esc(MESES[m - 1])} de ${y}.</p>`;
    const nombre = f === SIN_PARROQUIA ? 'sin parroquia' : `de «${esc(f)}»`;
    const prox = gruposFiltrados().filter((g) => g.salida && g.salida.slice(0, 7) > mes).sort((a, b) => (a.salida < b.salida ? -1 : 1))[0];
    const meses = prox ? (+prox.salida.slice(0, 4) - y) * 12 + (+prox.salida.slice(5, 7) - m) : 0;
    return `<p class="vacio">No hay grupos ${nombre} en ${esc(MESES[m - 1])} de ${y}.${prox ? ` <button type="button" class="btn txt sm" data-gmes="${meses}">Ver ${esc(MESES[+prox.salida.slice(5, 7) - 1])} de ${prox.salida.slice(0, 4)} (${esc(prox.nombre)})</button>` : ''}</p>`;
  }

  function lineaTiempoView() {
    const G = S.grupos, mes = G.mes, desde = mes + '-01', hasta = ultimoDia(mes), n = +hasta.slice(8, 10);
    const hoy = fechaEn(miTz());
    const dias = Array.from({ length: n }, (_, i) => sumarDias(desde, i));
    const enMes = gruposFiltrados().filter((g) => g.salida && g.salida <= hasta && (g.regreso || g.salida) >= desde);
    const sinFecha = gruposFiltrados().filter((g) => !g.salida);
    const cols = `--dias: ${n}`;
    const cab = `<div class="gantt-fila gantt-cab" style="${cols}"><span></span>${dias.map((d) => `<span class="${d === hoy ? 'hoy' : ''}${diaSemana(d) >= 6 ? ' finde' : ''}">${+d.slice(8, 10)}</span>`).join('')}</div>`;
    const filas = enMes.map((g) => {
      const a = g.salida < desde ? 1 : +g.salida.slice(8, 10);
      const fin = g.regreso || g.salida;
      const b = fin > hasta ? n : +fin.slice(8, 10);
      const c = columna(g.estado);
      return `<div class="gantt-fila" style="${cols}">
          <button type="button" class="gantt-nom" data-gver="${g.id}" aria-haspopup="dialog"><b>${esc(g.nombre)}</b><small>${esc([g.destino, g.parroquia, c.nombre].filter(Boolean).join(' · '))}</small><small class="gantt-fechas">${esc(fechasGrupo(g))}</small></button>
          <span class="gantt-barra ${c.cls}${g.salida < desde ? ' sigue-antes' : ''}${fin > hasta ? ' sigue-despues' : ''}" style="grid-column: ${a + 1} / ${b + 2}" title="${esc(g.nombre + ' · ' + fechasGrupo(g))}">${esc(fechasGrupo(g))}</span>
        </div>`;
    }).join('');
    const [y, m] = mes.split('-').map(Number);
    return `<div class="weeknav">
        <button type="button" class="btn ghost sm" data-gmes="-1" aria-label="Mes anterior">${ico('izq')}</button>
        <b>${esc(nombreMes(mes))}</b>
        <button type="button" class="btn ghost sm" data-gmes="1" aria-label="Mes siguiente">${ico('der')}</button>
        ${mes !== hoy.slice(0, 7) ? '<button type="button" class="btn txt sm" data-gmes="0">Este mes</button>' : ''}
      </div>
      <div class="card flush gantt">${enMes.length ? cab + filas : vacioLinea(mes, m, y)}</div>
      <div class="leyenda gantt-leyenda">${COLUMNAS.map((c) => `<span><i class="gantt-punto ${c.cls}"></i>${esc(c.nombre)}</span>`).join('')}</div>
      ${sinFecha.length ? `<p class="hint">Sin fechas todavía: ${sinFecha.map((g) => `<button type="button" class="enlace" data-gver="${g.id}">${esc(g.nombre)}</button>`).join(', ')}.</p>` : ''}`;
  }

  // ---------- Ficha de un grupo (emergente) ----------
  // Al pasar el mouse sobre una tarjeta se muestra; al tocarla queda fija. En el celular es una hoja desde abajo.
  const fichaG = { id: null, fija: false, abrir: null, cerrar: null };
  const fichaComoHoja = () => window.innerWidth < 760 || !(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  function fechaFicha(iso) {
    const hoyAnio = fechaEn(miTz()).slice(0, 4);
    return fechaLarga(iso) + (iso.slice(0, 4) !== hoyAnio ? ` de ${iso.slice(0, 4)}` : '');
  }
  function fichaGrupoHtml(g) {
    const c = columna(g.estado), resp = g.responsable_id && persona(g.responsable_id);
    const hoy = fechaEn(miTz()), anio = hoy.slice(0, 4);
    const regreso = g.regreso || g.salida;
    const n = g.salida ? diasEntre(g.salida, regreso) + 1 : 0;
    const diaCaja = (etq, iso) => iso
      ? `<div class="gviaje-dia"><span class="gviaje-etq">${etq}</span><b class="gviaje-num">${+iso.slice(8, 10)}</b><span class="gviaje-mes">${MESES[+iso.slice(5, 7) - 1].slice(0, 3)}${iso.slice(0, 4) !== anio ? ' ' + iso.slice(0, 4) : ''}</span><span class="gviaje-sem">${DIAS_LARGOS[diaSemana(iso) - 1]}</span></div>`
      : `<div class="gviaje-dia vacia"><span class="gviaje-etq">${etq}</span><span class="gviaje-sem">Sin fecha</span></div>`;
    let cuando = '';
    if (g.salida) {
      const faltan = diasEntre(hoy, g.salida), pasaron = diasEntre(regreso, hoy);
      cuando = faltan > 0 ? `Faltan ${plural(faltan, 'día', 'días')} para la salida` : faltan === 0 ? 'Sale hoy' : pasaron <= 0 ? 'Está de viaje ahora' : `Regresó hace ${plural(pasaron, 'día', 'días')}`;
    }
    const viaje = g.salida
      ? `<div class="gviaje">
          ${diaCaja('Salida', g.salida)}
          <div class="gviaje-medio">${ico('avion')}<span>${plural(n, 'día', 'días')}</span></div>
          ${diaCaja('Regreso', g.regreso || g.salida)}
        </div><p class="gviaje-cuando">${ico('reloj')}${esc(cuando)}</p>`
      : `<div class="gviaje vacia">${ico('calendario')}<span>Aún no tiene fechas de salida ni de regreso.</span></div>`;
    const dato = (icono, etq, val, vacio) => `<div class="gficha-dato"><dt>${ico(icono)}${etq}</dt><dd${val ? '' : ' class="vacia"'}>${val || vacio}</dd></div>`;
    return `<div class="gficha-cab"><span class="gficha-etapa">${esc(c.nombre)}</span>
        <button type="button" class="btn txt sm gficha-x" data-accion="gfichaCerrar" aria-label="Cerrar">${ico('x')}</button></div>
      <h3 id="gficha-t">${esc(g.nombre)}</h3>
      ${g.destino ? `<p class="gficha-dest">${ico('avion')}${esc(g.destino)}</p>` : ''}
      <section class="gficha-sec"><h4>Viaje</h4>${viaje}</section>
      <section class="gficha-sec"><h4>Grupo</h4>
        <dl class="gficha-dl">
          ${dato('iglesia', 'Parroquia', g.parroquia ? esc(g.parroquia) : '', 'Sin parroquia')}
          ${dato('usuarios', 'Pasajeros', g.pasajeros != null ? esc(String(g.pasajeros)) : '', 'Sin definir')}
          ${dato('usuarioMas', 'Responsable', resp ? esc(resp.nombre) : '', 'Sin responsable')}
        </dl></section>
      <section class="gficha-sec"><h4>Alcance</h4>${g.alcance ? `<p class="gficha-texto">${esc(g.alcance)}</p>` : '<p class="gficha-texto vacia">Aún no se ha escrito qué incluye.</p>'}</section>
      ${g.notas ? `<section class="gficha-sec"><h4>Notas internas <small>(solo el equipo)</small></h4><p class="gficha-texto">${esc(g.notas)}</p></section>` : ''}
      <p class="gficha-meta">Creado por ${esc(nombreDe(g.creado_por))}${g.actualizado_por ? ` · último cambio de ${esc(nombreDe(g.actualizado_por))}, ${esc(fechaHora(g.actualizado, miTz()))}` : ''}</p>
      <div class="gficha-acc"><button type="button" class="btn sm" data-gabrir="${g.id}">${ico('lapiz')}Editar</button></div>`;
  }
  function anclaFicha(id) {
    return document.querySelector(`.kcard[data-gver="${id}"]`) || document.querySelector(`.gantt-nom[data-gver="${id}"]`) || document.querySelector(`[data-gver="${id}"]`);
  }
  function ubicarFicha() {
    const el = document.getElementById('gficha');
    if (!el || el.hidden) return;
    if (el.classList.contains('hoja')) { el.style.left = el.style.top = ''; return; }
    const a = anclaFicha(fichaG.id);
    if (!a) { cerrarFichaGrupo(); return; }
    const r = a.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, m = 12;
    let x = r.right + m;
    if (x + w > window.innerWidth - m) x = r.left - w - m;
    if (x < m) x = Math.min(Math.max(m, r.left), window.innerWidth - w - m);
    let y = Math.min(Math.max(m, r.top), window.innerHeight - h - m);
    if (x === r.left || (x < r.right && x + w > r.left)) y = Math.min(r.bottom + m, window.innerHeight - h - m);
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(Math.max(m, y)) + 'px';
  }
  function mostrarFichaGrupo(id, fija) {
    const g = grupo(id);
    if (!g || S.view !== 'grupos') return;
    clearTimeout(fichaG.cerrar); clearTimeout(fichaG.abrir);
    let el = document.getElementById('gficha'), fondo = document.getElementById('gficha-fondo');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gficha';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-labelledby', 'gficha-t');
      el.addEventListener('mouseenter', () => clearTimeout(fichaG.cerrar));
      el.addEventListener('mouseleave', () => { if (!fichaG.fija) programarCierreFicha(); });
      document.body.appendChild(el);
      fondo = document.createElement('div');
      fondo.id = 'gficha-fondo';
      fondo.hidden = true;
      document.body.appendChild(fondo);
    }
    const hoja = fija && fichaComoHoja();
    el.className = `gficha ${columna(g.estado).cls}${fija ? ' fija' : ''}${hoja ? ' hoja' : ''}`;
    el.innerHTML = fichaGrupoHtml(g);
    el.setAttribute('aria-modal', hoja ? 'true' : 'false');
    el.hidden = false;
    fondo.hidden = !hoja;
    fichaG.id = String(g.id);
    fichaG.fija = !!fija;
    ubicarFicha();
    if (fija) { const b = el.querySelector('[data-gabrir]'); if (b) b.focus({ preventScroll: true }); }
  }
  function cerrarFichaGrupo(devolverFoco) {
    clearTimeout(fichaG.cerrar); clearTimeout(fichaG.abrir);
    const el = document.getElementById('gficha'), fondo = document.getElementById('gficha-fondo');
    const id = fichaG.id;
    if (el) el.hidden = true;
    if (fondo) fondo.hidden = true;
    fichaG.id = null;
    fichaG.fija = false;
    if (devolverFoco && id) { const b = document.querySelector(`.kcard-t[data-gver="${id}"], .gantt-nom[data-gver="${id}"]`); if (b) b.focus(); }
  }
  function programarCierreFicha() {
    clearTimeout(fichaG.cerrar);
    fichaG.cerrar = setTimeout(() => { if (!fichaG.fija) cerrarFichaGrupo(); }, 220);
  }
  // Después de cada render: si el grupo sigue en pantalla, la ficha se actualiza; si no, se cierra
  function refrescarFichaGrupo() {
    if (!fichaG.id) return;
    const g = grupo(fichaG.id);
    if (S.view !== 'grupos' || S.grupos.abierto || !g || !anclaFicha(fichaG.id)) { cerrarFichaGrupo(); return; }
    const el = document.getElementById('gficha');
    if (el && !el.hidden) { el.innerHTML = fichaGrupoHtml(g); el.className = el.className.replace(/\bc\d\b/, columna(g.estado).cls); ubicarFicha(); }
  }
  document.addEventListener('mouseover', (ev) => {
    if (S.view !== 'grupos' || fichaComoHoja() || fichaG.fija) return;
    const a = ev.target.closest && ev.target.closest('.kcard[data-gver], .gantt-nom[data-gver]');
    if (!a) return;
    if (a.contains(ev.relatedTarget)) return;
    clearTimeout(fichaG.cerrar); clearTimeout(fichaG.abrir);
    if (fichaG.id === a.dataset.gver) return;
    fichaG.abrir = setTimeout(() => { if (!document.querySelector('.kcard.arrastrando')) mostrarFichaGrupo(a.dataset.gver, false); }, 380);
  });
  document.addEventListener('mouseout', (ev) => {
    if (fichaG.fija) return;
    const a = ev.target.closest && ev.target.closest('.kcard[data-gver], .gantt-nom[data-gver]');
    if (!a || a.contains(ev.relatedTarget) || (ev.relatedTarget && ev.relatedTarget.closest && ev.relatedTarget.closest('#gficha'))) return;
    clearTimeout(fichaG.abrir);
    if (fichaG.id) programarCierreFicha();
  });
  document.addEventListener('dragstart', () => cerrarFichaGrupo());
  window.addEventListener('resize', () => { if (fichaG.id) { if (fichaG.fija) mostrarFichaGrupo(fichaG.id, true); else cerrarFichaGrupo(); } });
  document.addEventListener('scroll', () => { if (!fichaG.id) return; if (fichaG.fija) ubicarFicha(); else cerrarFichaGrupo(); }, true);

  function grupoFormView() {
    const G = S.grupos, b = G.borrador, editar = G.abierto !== 'nuevo';
    const g = editar ? grupo(G.abierto) : null;
    const confirmar = editar && G.borrar === G.abierto;
    const meta = g ? `<p class="hint">Creado por ${esc(nombreDe(g.creado_por))}${g.actualizado_por ? ` · último cambio de ${esc(nombreDe(g.actualizado_por))}, ${esc(fechaHora(g.actualizado, miTz()))}` : ''}.</p>` : '';
    return `<section class="card grupo-form">
        <form data-form="grupo" data-borrador="grupo" novalidate>
          <span class="eyebrow">${editar ? 'Editar grupo' : 'Nuevo grupo'}</span><h2>${editar ? esc(g ? g.nombre : '') : 'Crear grupo'}</h2>
          ${S.error ? `<p class="err" role="alert">${esc(S.error)}</p>` : ''}
          <div class="form-grid">
            <label class="field"><span>Nombre del grupo</span><input name="nombre" value="${esc(b.nombre || '')}" maxlength="120" required autocomplete="off" placeholder="Peregrinación Fátima y Lourdes"></label>
            <label class="field"><span>Destino</span><input name="destino" value="${esc(b.destino || '')}" maxlength="120" autocomplete="off" placeholder="Portugal y Francia"></label>
            <label class="field"><span>Parroquia</span><input name="parroquia" value="${esc(b.parroquia || '')}" maxlength="120" autocomplete="off" placeholder="Parroquia San José de Chapinero" list="parroquias"><datalist id="parroquias">${[...new Set(S.grupos.lista.map((x) => x.parroquia).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'es')).map((x) => `<option value="${esc(x)}">`).join('')}</datalist></label>
            <label class="field"><span>Salida</span><input name="salida" type="date" value="${esc(b.salida || '')}"></label>
            <label class="field"><span>Regreso</span><input name="regreso" type="date" value="${esc(b.regreso || '')}"${b.salida ? ` min="${esc(b.salida)}"` : ''}></label>
            <label class="field"><span>Pasajeros</span><input name="pasajeros" type="number" min="0" max="9999" inputmode="numeric" value="${esc(b.pasajeros == null ? '' : b.pasajeros)}"></label>
            <label class="field"><span>Responsable</span><select name="responsable_id"><option value="">Sin responsable</option>${activas().map((p) => `<option value="${p.id}"${b.responsable_id === p.id ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>
            <label class="field"><span>Columna</span><select name="estado">${COLUMNAS.map((c) => `<option value="${c.id}"${(b.estado || 'cotizando') === c.id ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>
            <label class="field full"><span>Alcance</span><textarea name="alcance" rows="3" maxlength="4000" placeholder="Qué incluye: aéreos, hoteles, traslados, guía…">${esc(b.alcance || '')}</textarea></label>
            <label class="field full"><span>Notas internas</span><textarea name="notas" rows="3" maxlength="4000" placeholder="Solo para el equipo: no van al calendario.">${esc(b.notas || '')}</textarea></label>
          </div>
          ${meta}
          <div class="acc">
            <button class="btn" type="submit"${ocupado('grupo')}>${ico('check')}${S.ocupado === 'grupo' ? 'Guardando…' : 'Guardar'}</button>
            <button class="btn ghost" type="button" data-accion="grupoCancelar">Cancelar</button>
            ${editar ? (confirmar
              ? `<span class="confirmar">¿Eliminar este grupo? También sale del calendario.<span><button type="button" class="btn sm danger" data-gborrar="si"${ocupado('grupoBorrar')}>Sí, eliminar</button><button type="button" class="btn txt sm" data-gborrar="no">No</button></span></span>`
              : `<button class="btn txt" type="button" data-gborrar="pedir">${ico('basura')}Eliminar</button>`) : ''}
          </div>
        </form>
      </section>`;
  }

  function abrirGrupo(id) {
    const G = S.grupos;
    S.error = '';
    G.borrar = null;
    if (id === 'nuevo') {
      G.abierto = 'nuevo';
      G.borrador = { estado: 'cotizando', responsable_id: P().id, parroquia: G.parroquia && G.parroquia !== SIN_PARROQUIA ? G.parroquia : '' };
    } else {
      const g = grupo(id);
      if (!g) return;
      G.abierto = g.id;
      G.borrador = { nombre: g.nombre, destino: g.destino, parroquia: g.parroquia || '', salida: g.salida || '', regreso: g.regreso || '', pasajeros: g.pasajeros == null ? '' : g.pasajeros, responsable_id: g.responsable_id || '', estado: g.estado, alcance: g.alcance, notas: g.notas };
    }
    foco = 'form[data-form=grupo] input[name=nombre]';
    render();
    window.scrollTo(0, 0);
  }

  async function guardarGrupo() {
    const G = S.grupos, b = G.borrador;
    const fila = {
      nombre: String(b.nombre || '').trim(), destino: String(b.destino || '').trim(), parroquia: String(b.parroquia || '').trim(),
      salida: b.salida || null, regreso: b.regreso || null,
      pasajeros: b.pasajeros === '' || b.pasajeros == null ? null : Math.round(+b.pasajeros),
      responsable_id: b.responsable_id || null, estado: b.estado || 'cotizando',
      alcance: String(b.alcance || '').trim(), notas: String(b.notas || '').trim(),
    };
    S.error = !fila.nombre ? 'Escribe el nombre del grupo.'
      : fila.salida && fila.regreso && fila.regreso < fila.salida ? 'El regreso no puede ser antes de la salida.'
      : !fila.salida && fila.regreso ? 'Pon también la fecha de salida.'
      : fila.pasajeros != null && !(fila.pasajeros >= 0 && fila.pasajeros <= 9999) ? 'Revisa el número de pasajeros.' : '';
    if (S.error) { foco = fila.nombre ? 'form[data-form=grupo] input[name=salida]' : 'form[data-form=grupo] input[name=nombre]'; render(); return; }
    await accion('grupo', async () => {
      if (G.abierto === 'nuevo') await q(sb.from('grupos').insert(fila));
      else await q(sb.from('grupos').update(fila).eq('id', G.abierto));
      const nuevo = G.abierto === 'nuevo';
      G.abierto = null; G.borrador = {};
      await cargarGrupos();
      toast(nuevo ? `Grupo «${fila.nombre}» creado.` : 'Cambios guardados.');
    });
  }

  async function moverGrupo(id, estado) {
    const g = grupo(id);
    if (!g || g.estado === estado) return;
    const antes = g.estado;
    g.estado = estado; // se ve de inmediato; si falla, vuelve
    render();
    try {
      await q(sb.from('grupos').update({ estado }).eq('id', g.id));
      await cargarGrupos();
      render();
      toast(`«${g.nombre}» pasó a ${columna(estado).nombre}.`);
    } catch (e) {
      g.estado = antes;
      render();
      toast(errorTexto(e), 'bad');
    }
  }

  // ---------- Navegación ----------
  const CARGAS = {
    inicio: cargarInicio, grupos: cargarGrupos, malla: cargarMalla, comunicados: cargarComunicados, asistencia: cargarAsistencia,
    informes: cargarInforme, viaticos: cargarViaticos, gestion: cargarGestion, solicitudes: cargarSolicitudes, equipo: recargarPersonas, tarjeta: cargarTarjeta, oficina: cargarOficina,
  };
  let navegacion = 0;
  async function ir(view) {
    if (!puedeVer(view)) view = 'inicio';
    const yo = ++navegacion;
    S.view = view;
    const gNav = GRUPOS_NAV.find((g) => g.vistas.includes(view));
    if (gNav) S.navUltima[gNav.id] = view;
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
  const ACCIONES = '[data-view],[data-accion],[data-marcar],[data-semana],[data-mvista],[data-editar],[data-leer],[data-comf],[data-borrarcom],[data-lb],[data-lbmover],[data-quitarimg],[data-revisar],[data-cancelarsol],[data-lbsol],[data-quitarsop],[data-revquitar],[data-selinf],[data-orden],[data-restablecer],[data-activar],[data-copiar],[data-guia],[data-soltipo],[data-confirmar],[data-demo],[data-gvista],[data-gver],[data-gabrir],[data-gmover],[data-gmes],[data-gborrar],[data-tcfiltro],[data-tcpest],[data-tcpaso],[data-tcfiltrog],[data-gfiltro],[data-gmesf],[data-gquitar],[data-gmedida],[data-gorden],[data-eqpest],[data-cx],[data-cxpedir],[data-cc],[data-ccpdf],[data-ccpedir],[data-ccestado],[data-via],[data-viaform],[data-viafiltro],[data-viaaccion]';

  document.addEventListener('click', async (ev) => {
    if (fichaG.id && !(ev.target.closest && (ev.target.closest('#gficha') || ev.target.closest('[data-gver]')))) {
      cerrarFichaGrupo();
      if (ev.target.id === 'gficha-fondo') return;
    }
    const el = ev.target.closest(ACCIONES);
    if (S.menu && !ev.target.closest('.menu')) {
      S.menu = false;
      if (!el) { render(); return; }
    }
    if (S.lb && ev.target.classList && ev.target.classList.contains('lightbox')) { S.lb = null; render(); return; }
    if (!el) return;
    const d = el.dataset;
    if (el.tagName === 'A' && d.view) ev.preventDefault();

    if (d.via) { if (d.via === 'volver') { S.via.abierto = null; render(); window.scrollTo(0, 0); } else await abrirViatico(+d.via); return; }
    if (d.viaform) { if (d.viaform === 'cerrar') { S.via.form = null; render(); } else abrirFormViatico(d.viaform); return; }
    if (d.viafiltro) { S.via.filtro = d.viafiltro; render(); return; }
    if (d.viaaccion) { await accionViatico(d.viaaccion); return; }
    if (d.view) {
      const idCom = d.irCom;
      await ir(d.view);
      if (idCom) { const n = document.getElementById('com-' + idCom); if (n) n.scrollIntoView({ block: 'center' }); }
      return;
    }
    if (d.demo) { if (!S.ocupado) await iniciarSesion(d.demo, CFG.demo.clave); return; }
    if (d.tcfiltro) { S.tc.filtro = d.tcfiltro; if (S.tc.pestana !== 'banco') S.tc.pestana = 'banco'; render(); return; }
    if (d.tcpest) { S.tc.pestana = d.tcpest; render(); return; }
    if (d.tcfiltrog) { S.tc.filtroG = d.tcfiltrog; render(); return; }
    if (d.tcpaso) {
      Object.assign(S.tc, { paso: d.tcpaso, abierto: null, confirmar: null, borrar: null });
      if (d.tcpaso === 'gastos') { try { await cargarGastos(); } catch (e) { toast(errorTexto(e), 'bad'); } }
      render();
      window.scrollTo(0, 0);
      return;
    }
    if (d.accion) {
      switch (d.accion) {
        case 'menu': S.menu = !S.menu; render(); return;
        case 'abrirAjuste': abrirAjuste(); return;
        case 'cerrarAjuste': S.ajuste = null; render(); return;
        case 'gfichaCerrar': cerrarFichaGrupo(true); return;
        case 'gParroquiaTodas': S.grupos.parroquia = ''; render(); return;
        case 'tcAbrir': S.tc.abierto = d.panel; S.tc.borrador = {}; S.tc.confirmar = null; S.tc.archivoRegistro = null; render(); { const f = document.querySelector('.tc-panel input:not([type=file]), .tc-panel textarea'); if (f) f.focus(); } return;
        case 'tcCerrarPanel': S.tc.abierto = null; S.tc.borrador = {}; render(); return;
        case 'tcNo': S.tc.confirmar = null; S.tc.borrar = null; render(); return;
        case 'tcAnalizar': analizarImportacion(); if (!S.tc.importar.filas) toast('No se encontraron filas para importar.', 'bad'); render(); return;
        case 'tcImportarSi': await importarSiTc(); return;
        case 'tcConciliar': await conciliarTc(Number(d.id)); return;
        case 'tcSugeridos': await sugeridosTc(); return;
        case 'tcEstado': await estadoTc(Number(d.id), d.estado); return;
        case 'tcExportar': exportarTc(); return;
        case 'tcInforme': abrirInformeTc(); return;
        case 'tcInformeCerrar': if (S.ocupado !== 'tcInforme') { S.tc.informe = null; render(); } return;
        case 'tcCerrar': S.tc.confirmar = 'cerrar'; render(); return;
        case 'tcReabrir': S.tc.confirmar = 'reabrir'; render(); return;
        case 'tcCerrarSi':
        case 'tcReabrirSi': {
          const cerrar = d.accion === 'tcCerrarSi';
          await accion('tc', async () => {
            await q(sb.rpc(cerrar ? 'cerrar_extracto' : 'reabrir_extracto', { p_id: S.tc.extracto }));
            S.tc.confirmar = null;
            await cargarTarjeta();
            toast(cerrar ? 'Conciliación cerrada. Ya no se puede editar.' : 'Conciliación reabierta.');
          });
          return;
        }
        case 'tcBorrarMov': S.tc.borrar = Number(d.id); render(); return;
        case 'tcBorrarReg': S.tc.borrar = 'r' + d.id; render(); return;
        case 'tcBorrarGasto': S.tc.borrar = 'g' + d.id; render(); return;
        case 'tcBorrarGastoSi': {
          const id = Number(d.id), fila = S.tc.gastos.find((x) => x.id === id);
          await accion('tc', async () => {
            await q(sb.from('tc_registros').delete().eq('id', id));
            if (fila && fila.soporte_ruta) await sb.storage.from('conciliacion').remove([fila.soporte_ruta]);
            S.tc.borrar = null;
            await Promise.all([cargarGastos(), cargarDatosExtracto()]);
            toast('Gasto borrado.');
          });
          return;
        }
        case 'tcBorrarMovSi':
        case 'tcBorrarRegSi': {
          const esMov = d.accion === 'tcBorrarMovSi', id = Number(d.id);
          const fila = (esMov ? S.tc.movs : S.tc.regs).find((x) => x.id === id);
          await accion('tc', async () => {
            await q(sb.from(esMov ? 'tc_movimientos' : 'tc_registros').delete().eq('id', id));
            if (fila && fila.soporte_ruta) await sb.storage.from('conciliacion').remove([fila.soporte_ruta]);
            S.tc.borrar = null;
            await cargarDatosExtracto();
            toast(esMov ? 'Movimiento borrado.' : 'Registro borrado.');
          });
          return;
        }
        case 'tcQuitarSop': {
          const [tipo, id] = d.ref.split(':');
          const fila = (tipo === 'm' ? S.tc.movs : S.tc.regs.concat(S.tc.gastos)).find((x) => x.id === +id);
          if (!fila) return;
          await accion('tc', async () => {
            await q(sb.from(tipo === 'm' ? 'tc_movimientos' : 'tc_registros').update({ soporte_ruta: null, soporte_nombre: null }).eq('id', fila.id));
            await sb.storage.from('conciliacion').remove([fila.soporte_ruta]);
            await Promise.all([cargarDatosExtracto(), cargarGastos()]);
            toast('Soporte quitado.');
          });
          return;
        }
        case 'recargar': location.reload(); return;
        case 'salir': await salir(); return;
        case 'cambiarClave': S.menu = false; S.claveVoluntaria = true; S.error = ''; S.pantalla = 'clave'; foco = 'input[name=clave]'; render(); return;
        case 'olvido': {
          const escrito = document.querySelector('form[data-form=login] input[name=correo]');
          if (escrito) S.correoLogin = escrito.value.trim().toLowerCase();
        }
          S.error = ''; S.olvido = { enviado: false, correo: S.correoLogin || '' }; S.pantalla = 'olvido'; foco = 'input[name=correo]'; render(); return;
        case 'volverLogin': S.error = ''; S.correoLogin = S.olvido.correo || S.correoLogin; S.pantalla = 'login'; foco = 'input[name=clave]'; render(); return;
        case 'abrirEnlaceDemo': {
          const ok = CFG.demo && sb.auth.abrirEnlaceDemo && await sb.auth.abrirEnlaceDemo(S.olvido.correo);
          if (!ok) { toast('En la demostración, usa el correo de una de las cuentas de ejemplo.', 'bad'); return; }
          const { data } = await sb.auth.getSession();
          S.recuperacion = true;
          await cargarUsuario(data.session.user);
          return;
        }
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
        case 'exportar': exportarInforme('resumen'); return;
        case 'exportarDetalle': exportarInforme('detalle'); return;
        case 'agregarTurno': await accion('turno', agregarTurno); return;
        case 'lbCerrar': S.lb = null; render(); return;
        case 'grupoNuevo': abrirGrupo('nuevo'); return;
        case 'grupoCancelar': S.error = ''; S.grupos.abierto = null; S.grupos.borrador = {}; S.grupos.borrar = null; render(); return;
        case 'calClave':
          await accion('calClave', async () => { S.grupos.clave = await q(sb.rpc('nueva_clave_calendario')); });
          return;
        case 'calCerrar': S.grupos.clave = null; render(); return;
        case 'gesClave':
          await accion('gesClave', async () => { S.ges.clave = await q(sb.rpc('nueva_clave_ventas')); await cargarGestion(); });
          return;
        case 'gesClaveCerrar': S.ges.clave = null; render(); return;
        case 'cerrarClaveCliente': S.equipo.claveCliente = null; render(); return;
        case 'gesConexion': S.ges.conAbierta = !S.ges.conAbierta; render(); return;
        case 'gesActualizar': await actualizarGestion(); return;
        case 'gesTareaQuitar':
          await accion('gesTarea', async () => {
            await q(sb.rpc('guardar_tarea_ventas', { p_url: '', p_token: '' }));
            await cargarGestion();
            toast('Botón desconectado: ahora solo recarga los datos guardados.');
          });
          return;
        case 'gesLimpiar': S.ges.f = {}; S.ges.mes = ''; render(); return;
        case 'gesDetalle': S.ges.detalle = !S.ges.detalle; render(); return;
        case 'gesExportar': exportarGestion(); return;
        case 'cerrarClave': S.equipo.claveNueva = null; render(); return;
        case 'validarIp':
        case 'validarEquipo': {
          const clave = d.accion === 'validarIp' ? 'validar_ip' : 'validar_equipo';
          await accion('ofi', async () => {
            const valor = { activo: !(S.config[clave] && S.config[clave].activo) };
            await q(sb.from('configuracion').upsert({ clave, valor, actualizado: new Date().toISOString() }, { onConflict: 'clave' }));
            S.config[clave] = valor;
            toast(valor.activo ? 'Control activado.' : 'Control apagado.');
          });
          return;
        }
        case 'ipAgregar':
        case 'ipQuitar': {
          const sede = sedeDe(S.ofi.sede);
          if (!sede) return;
          const actuales = sede.ips_oficina || [];
          const ips = d.accion === 'ipAgregar' ? actuales.concat(S.ofi.ip && !actuales.includes(S.ofi.ip) ? [S.ofi.ip] : []) : actuales.filter((x) => x !== d.ip);
          if (d.accion === 'ipQuitar' && !ips.length && validarIp()) { toast('Apaga el control 1 antes de quitar la última IP: si no, nadie podría marcar.', 'bad'); return; }
          await accion('ofi', async () => {
            const fila = await q(sb.rpc('fijar_ips_oficina', { p_sede: sede.id, p_ips: ips }));
            Object.assign(sede, fila && fila.ips_oficina ? { ips_oficina: fila.ips_oficina } : { ips_oficina: ips });
            toast(d.accion === 'ipAgregar' ? 'IP de la oficina registrada.' : 'IP quitada.');
          });
          return;
        }
        case 'autorizarEquipo': {
          const inp = document.getElementById('ofi-nombre');
          const nombre = (inp ? inp.value : '').trim();
          S.ofi.nombre = nombre;
          if (!nombre) { toast('Escribe un nombre para este computador.', 'bad'); if (inp) inp.focus(); return; }
          await accion('ofi', async () => {
            const r = await q(sb.rpc('autorizar_equipo', { p_nombre: nombre, p_sede: S.ofi.sede }));
            if (!guardarEquipoLocal({ id: r.id, llave: r.llave, nombre })) {
              await q(sb.rpc('quitar_equipo', { p_id: r.id }));
              throw new Error('Este navegador no deja guardar la llave (ventana de incógnito o datos bloqueados). Usa una ventana normal.');
            }
            S.ofi.nombre = '';
            await cargarOficina();
            toast(`Listo: «${nombre}» puede marcar.`);
          });
          return;
        }
        case 'quitarEquipo': S.ofi.quitar = Number(d.id); render(); return;
        case 'quitarEquipoNo': S.ofi.quitar = null; render(); return;
        case 'quitarEquipoSi': {
          const id = S.ofi.quitar;
          const activos = S.ofi.equipos.filter((e) => e.activo && e.id !== id && e.sede_id === S.ofi.sede);
          if (validarEquipo() && !activos.length) { toast('Apaga el control 2 antes de quitar el último computador: si no, nadie podría marcar.', 'bad'); S.ofi.quitar = null; render(); return; }
          await accion('ofi', async () => {
            await q(sb.rpc('quitar_equipo', { p_id: id }));
            const local = equipoLocal();
            if (local && local.id === id) guardarEquipoLocal(null);
            S.ofi.quitar = null;
            await cargarOficina();
            toast('Computador quitado.');
          });
          return;
        }
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
        await q(sb.rpc('marcar', { p_tipo: tipo, p_equipo: (equipoLocal() || {}).llave || null }));
        await cargarInicio();
        toast(`${PASOS.find((x) => x.tipo === tipo).nombre} marcada a las ${hhmm(horaEn(miTz()))}.`);
      });
      // Si entró bastante antes de su turno, pregunta de una vez por la autorización
      if (tipo === 'entrada' && S.hoy && !S.hoy.ajuste && S.hoy.marcas.some((m) => m.tipo === 'entrada')) {
        const t = turnoHoy(), mm = {};
        S.hoy.marcas.forEach((m) => { mm[m.tipo] = m; });
        if (t && conHorario(t) && minAntesEntrada(t, mm, miTz()) >= tol().temprano) abrirAjuste();
      }
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
    if (d.copiar === 'calendario') { if (S.grupos.clave) await copiarTexto(S.grupos.clave); return; }
    if (d.copiar === 'ventas') { if (S.ges.clave) await copiarTexto(S.ges.clave); return; }
    if (d.copiar === 'cliente') {
      const k = S.equipo.claveCliente;
      if (k) await copiarTexto(`Portal de clientes de ${MARCA.nombre}\n${urlPortal()}\nUsuario: ${k.correo}\nContraseña temporal: ${k.clave}\nAl entrar, crea tu propia contraseña.`);
      return;
    }
    if (d.copiar) {
      const c = S.equipo.claveNueva;
      if (c) await copiarTexto(`${MARCA.textoClave}\n${location.origin}${location.pathname}\nUsuario: ${c.correo}\nContraseña temporal: ${c.clave}\nAl entrar, crea tu propia contraseña.`);
      return;
    }
    if (d.eqpest) { S.equipo.pest = d.eqpest; render(); return; }
    if (d.cc) {
      const C = S.ges.cc;
      if (d.cc === 'nueva') Object.assign(C, mesAnteriorRango(), { abierto: true, cliente: '', quitadas: new Set(), confirmar: null });
      else if (d.cc === 'cerrar') C.abierto = false;
      else if (d.cc === 'no') C.confirmar = null;
      else if (d.cc === 'generar') { await generarCuentaCobro(); return; }
      render();
      return;
    }
    if (d.ccpdf) { const k = S.ges.cc.datos.cuentas.find((x) => String(x.id) === d.ccpdf); if (k) window.CuentaCobro.abrir(k); return; }
    if (d.ccpedir) { S.ges.cc.confirmar = { id: +d.ccid, estado: d.ccpedir }; render(); return; }
    if (d.ccestado) {
      await accion('cc', async () => {
        await q(sb.rpc('estado_cuenta_cobro', { p_id: +d.ccid, p_estado: d.ccestado }));
        S.ges.cc.confirmar = null;
        await cargarCuentasCobro();
        toast(d.ccestado === 'anulada' ? 'Cuenta de cobro anulada: sus ventas quedaron libres.' : d.ccestado === 'pagada' ? 'Marcada como pagada.' : 'Marcada como enviada.');
      });
      return;
    }
    if (d.cxpedir) { S.equipo.confirmarCx = { id: d.cxid, accion: d.cxpedir }; render(); return; }
    if (d.cx) {
      if (d.cx === 'no') { S.equipo.confirmarCx = null; render(); return; }
      await accionCliente(d.cx, d.cxid);
      return;
    }
    if ('gmesf' in d) { S.ges.mes = S.ges.mes === d.gmesf ? '' : d.gmesf; render(); return; }
    if (d.gfiltro) { const F = S.ges.f; F[d.gfiltro] = F[d.gfiltro] === d.gvalor ? '' : d.gvalor; render(); return; }
    if (d.gquitar) { S.ges.f[d.gquitar] = ''; render(); return; }
    if (d.gmedida) { S.ges.medida = d.gmedida; render(); return; }
    if (d.gorden) {
      const o = S.ges.orden;
      if (o.col === d.gorden) o.asc = !o.asc; else { o.col = d.gorden; o.asc = ['asesora', 'destino', 'tipo_venta', 'estado'].includes(d.gorden); }
      render();
      return;
    }
    if (d.gvista) { S.grupos.vista = d.gvista; render(); return; }
    if (d.gver) {
      if (fichaG.id === String(d.gver) && fichaG.fija) { cerrarFichaGrupo(); return; }
      mostrarFichaGrupo(d.gver, true);
      return;
    }
    if (d.gabrir) { cerrarFichaGrupo(); abrirGrupo(d.gabrir); return; }
    if (d.gmover) {
      const [id, paso] = d.gmover.split('|');
      const g = grupo(id), i = g ? COLUMNAS.findIndex((c) => c.id === g.estado) + +paso : -1;
      if (COLUMNAS[i]) await moverGrupo(id, COLUMNAS[i].id);
      return;
    }
    if (d.gmes) {
      const G = S.grupos, [y, m] = G.mes.split('-').map(Number);
      if (d.gmes === '0') G.mes = fechaEn(miTz()).slice(0, 7);
      else { const f = new Date(Date.UTC(y, m - 1 + +d.gmes, 1)); G.mes = f.toISOString().slice(0, 7); }
      render();
      return;
    }
    if (d.gborrar) {
      const G = S.grupos;
      if (d.gborrar === 'pedir') { G.borrar = G.abierto; render(); return; }
      if (d.gborrar === 'no') { G.borrar = null; render(); return; }
      await accion('grupoBorrar', async () => {
        const g = grupo(G.abierto);
        await q(sb.from('grupos').delete().eq('id', G.abierto));
        G.abierto = null; G.borrador = {}; G.borrar = null;
        await cargarGrupos();
        toast(`Grupo «${g ? g.nombre : ''}» eliminado.`);
      });
      return;
    }
    if (d.guia) { const n = document.getElementById('guia-' + d.guia); if (n) n.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });

  async function pedirEnlace(correo) {
    S.olvido.correo = correo;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { S.error = 'Escribe tu correo corporativo completo.'; foco = 'input[name=correo]'; render(); return; }
    S.error = '';
    S.ocupado = 'olvido';
    render();
    try {
      // La respuesta es la misma exista o no la cuenta: así nadie puede averiguar qué correos están registrados.
      const { error } = await sb.auth.resetPasswordForEmail(correo, { redirectTo: location.origin + location.pathname });
      if (error) throw error;
      S.ocupado = '';
      S.olvido.enviado = true;
      render();
    } catch (e) {
      S.ocupado = '';
      const m = String((e && e.message) || '');
      S.error = (e && e.status === 429) || /rate limit|seconds|security purposes/i.test(m)
        ? 'Ya pediste un enlace hace muy poco. Espera un minuto y vuelve a intentarlo.'
        : errorTexto(e);
      render();
    }
  }

  async function iniciarSesion(correo, clave) {
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
  }

  document.addEventListener('submit', async (ev) => {
    const f = ev.target.closest('form[data-form]');
    if (!f) return;
    ev.preventDefault();
    const tipo = f.dataset.form;
    if (tipo === 'login') {
      await iniciarSesion(f.correo.value.trim().toLowerCase(), f.clave.value);
      return;
    }
    if (tipo === 'olvido') { await pedirEnlace(f.correo.value.trim().toLowerCase()); return; }
    if (tipo === 'viatico') { await guardarViatico(); return; }
    if (tipo === 'tcInforme') { await enviarInformeTc(); return; }
    if (tipo === 'viagasto') { await guardarGastoVia(); return; }
    if (tipo === 'ajuste') {
      const A = S.ajuste;
      if (!A) return;
      const motivo = String(A.motivo || '').trim();
      if (motivo.length < 3) { toast('Escribe el motivo.', 'bad'); return; }
      if (!A.autorizo) { toast('Elige quién lo autorizó.', 'bad'); return; }
      const salida = A.opcion === 'igual' ? null : A.opcion === 'corre' ? hm(A.corrida).padStart(5, '0') : A.salida;
      if (A.opcion === 'otra' && !/^\d{2}:\d{2}/.test(salida || '')) { toast('Pon la nueva hora de salida.', 'bad'); return; }
      await accion('ajuste', async () => {
        await q(sb.rpc('ajustar_jornada', { p_motivo: motivo, p_salida: salida, p_autorizo: A.autorizo }));
        S.ajuste = null;
        await cargarInicio();
        toast(salida ? `Listo: tu salida de hoy queda a las ${hhmm(salida)}.` : 'Listo: quedó registrado quién autorizó tu entrada temprana.');
      });
      return;
    }
    if (tipo === 'gesTarea') {
      const url = f.url.value.trim(), token = f.token.value.trim();
      await accion('gesTarea', async () => {
        await q(sb.rpc('guardar_tarea_ventas', { p_url: url, p_token: token }));
        await cargarGestion();
        toast('Botón conectado: «Actualizar» ahora despierta la tarea de Claude.');
      });
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
        if (S.recuperacion) { S.recuperacion = false; toast('Listo: ya puedes entrar con tu contraseña nueva.'); }
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
    if (tipo === 'cuenta') { await crearCuenta(); return; }
    if (tipo === 'grupo') { await guardarGrupo(); return; }
    if (tipo === 'tcTarjeta') { await guardarTarjetaTc(); return; }
    if (tipo === 'tcExtracto') { await guardarExtractoTc(f.dataset.id); return; }
    if (tipo === 'tcRegistro' || tipo === 'tcGasto') { await guardarRegistroTc(); return; }
    if (tipo === 'tcMov') { await guardarMovTc(); }
  });

  // Borradores: lo escrito sobrevive a cada render
  const borradorDe = (k) => (k === 'com' ? S.com.borrador : k === 'sol' ? S.sol.borrador : k === 'grupo' ? S.grupos.borrador : k === 'tc' ? S.tc.borrador : S.equipo.borrador);
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset && S.via) {
      const dv = el.dataset;
      if (dv.viab && S.via.form) { S.via.form[dv.viab] = el.value; if (dv.viab !== 'grupo') return; }
      if (dv.viag) { S.via.gasto = S.via.gasto || {}; S.via.gasto[dv.viag] = el.value; return; }
      if (dv.viar) { S.via.rev[dv.viar] = el.value; return; }
      if (dv.vianomot) { S.via.noMotivo = el.value; return; }
    }
    if (el.dataset && el.dataset.tcinf && S.tc.informe) { S.tc.informe[el.dataset.tcinf] = el.value; refrescarVistaInforme(); return; }
    if (el.dataset && el.dataset.aj && S.ajuste) {
      S.ajuste[el.dataset.aj] = el.value;
      if (el.dataset.aj === 'salida') { S.ajuste.opcion = 'otra'; const r = document.querySelector('input[name=opcion][value=otra]'); if (r) r.checked = true; }
      return;
    }
    if (el.id === 'ofi-nombre') { S.ofi.nombre = el.value; return; }
    if (el.dataset && el.dataset.tcimport !== undefined) {
      const antes = !!S.tc.importar.texto.trim();
      S.tc.importar.texto = el.value;
      if (antes !== !!el.value.trim()) { const b = document.querySelector('[data-accion=tcAnalizar]'); if (b) b.disabled = !el.value.trim(); }
      return;
    }
    if (el.dataset && el.dataset.buscar === 'tc') { S.tc.q = el.value; const l = document.getElementById('lista-tc'); if (l) l.innerHTML = filasMovTc(sugerenciasTc()); return; }
    if (el.dataset && el.dataset.buscar === 'clientes') {
      S.equipo.filtroCx = el.value;
      const pos = el.selectionStart;
      render();
      const i = document.querySelector('[data-buscar="clientes"]');
      if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) { /* nada */ } }
      return;
    }
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
      const b = borradorDe(k);
      b[el.name] = el.type === 'checkbox' ? el.checked : el.value;
      if (k === 'com' && el.name === 'titulo') { const h = el.parentElement.querySelector('.hint'); if (h) h.textContent = `${el.value.length}/140`; }
    }
  });

  document.addEventListener('change', async (ev) => {
    const el = ev.target, d = el.dataset || {};
    if (d.viaarchivo) { S.via.archivo = el.files && el.files[0] ? el.files[0] : null; return; }
    if (d.viab && S.via.form) {
      const F = S.via.form;
      F[d.viab] = el.value;
      if (d.viab === 'grupo' && el.value) {
        const g = S.via.grupos.find((x) => String(x.id) === el.value);
        if (g) { if (g.destino) F.destino = g.destino; if (g.salida) F.salida = g.salida; if (g.regreso) F.regreso = g.regreso; }
        render();
      }
      return;
    }
    if (d.viag || d.viar || d.vianomot) return;
    if (d.aj && S.ajuste) { S.ajuste[d.aj] = el.value; if (d.aj === 'salida') S.ajuste.opcion = 'otra'; return; }
    if (d.gsel) { S.ges.f[d.gsel] = el.value; render(); return; }
    if (d.ccsel) { S.ges.cc[d.ccsel] = el.value; if (d.ccsel === 'cliente') S.ges.cc.quitadas = new Set(); render(); return; }
    if (d.ccventa) { const Q = S.ges.cc.quitadas; if (el.checked) Q.delete(d.ccventa); else Q.add(d.ccventa); render(); return; }
    if (d.tcsel) {
      if (d.tcsel === 'tarjeta') { S.tc.tarjeta = +el.value; S.tc.extracto = null; } else S.tc.extracto = +el.value;
      Object.assign(S.tc, { abierto: null, confirmar: null, borrar: null, filtro: 'todos', q: '' });
      await ir('tarjeta');
      return;
    }
    if (d.tccampo) {
      const [, id, campo] = d.tccampo.split(':');
      await accion('tc', async () => {
        await q(sb.from('tc_movimientos').update({ [campo]: el.value ? +el.value : null }).eq('id', +id));
        await cargarDatosExtracto();
      });
      return;
    }
    if (d.tcmapa) { S.tc.importar.mapa[d.tcmapa] = el.value === '' ? undefined : +el.value; render(); return; }
    if (d.tcsop) {
      const [tipo, id] = d.tcsop.split(':'), archivo = el.files && el.files[0];
      if (!archivo) return;
      await accion('tc', async () => { await adjuntarTc(tipo, +id, archivo); await Promise.all([cargarDatosExtracto(), cargarGastos()]); });
      return;
    }
    if (d.tcregarchivo) {
      if (S.tc.archivoUrl) URL.revokeObjectURL(S.tc.archivoUrl);
      const f = (el.files && el.files[0]) || null;
      S.tc.archivoRegistro = f;
      S.tc.archivoUrl = f && /^image\/(jpeg|png|webp|gif)$/.test(f.type) ? URL.createObjectURL(f) : null;
      render();
      return;
    }
    if (d.tcmes !== undefined) {
      S.tc.mes = el.value; S.tc.filtroG = 'todos';
      try { await cargarGastos(); } catch (e) { toast(errorTexto(e), 'bad'); }
      render();
      return;
    }
    if (d.tcregcampo) {
      const [id, campo] = d.tcregcampo.split(':');
      await accion('tc', async () => {
        await q(sb.from('tc_registros').update({ [campo]: el.value ? +el.value : null }).eq('id', +id));
        await Promise.all([cargarGastos(), cargarDatosExtracto()]);
      });
      return;
    }
    if (d.tcarchivo) {
      const archivo = el.files && el.files[0];
      if (!archivo) return;
      if (archivo.size > 3 * 1024 * 1024) { toast('El archivo es muy grande. Sube el CSV de un solo extracto.', 'bad'); return; }
      const lector = new FileReader();
      lector.onload = () => {
        let texto = String(lector.result || '');
        // Los CSV de algunos bancos vienen en Latin-1: si hay caracteres dañados, se vuelve a leer así
        if (texto.includes('\uFFFD')) { const l2 = new FileReader(); l2.onload = () => { S.tc.importar.texto = String(l2.result || ''); analizarImportacion(); render(); }; l2.readAsText(archivo, 'windows-1252'); return; }
        S.tc.importar.texto = texto;
        analizarImportacion();
        render();
      };
      lector.readAsText(archivo, 'utf-8');
      return;
    }
    if (d.gparroquia !== undefined) { S.grupos.parroquia = el.value; render(); return; }
    if (d.ofisede !== undefined) { S.ofi.sede = Number(el.value); S.ofi.quitar = null; render(); return; }
    const form = el.closest && el.closest('form[data-borrador]');
    if (form && el.name && (el.tagName === 'SELECT' || el.type === 'checkbox')) {
      const k = form.dataset.borrador;
      const b = borradorDe(k);
      b[el.name] = el.type === 'checkbox' ? el.checked : el.value;
      if (k === 'com' && el.name === 'destino') render();
      return;
    }
    if (d.celda) { if (el.value) await guardarCelda(d.celda, el.value); return; }
    if (d.msede) { S.malla.sede = el.value; render(); return; }
    if (d.rota) { await cambiarRotacion(d.rota, +el.value); return; }
    if (d.rotadesde) { if (el.value) { const r = rotacionDe(d.rotadesde); await cambiarRotacion(d.rotadesde, r ? r.semanas : 2, el.value); } return; }
    if (d.tsede) { S.turnoSede = +el.value; render(); return; }
    if (d.asede) { S.asisSede = el.value; render(); return; }
    if (d.inf) {
      const I = S.inf;
      if (d.inf === 'rango' || d.inf === 'desde' || d.inf === 'hasta') {
        if (d.inf === 'rango') ponerRango(I, el.value);
        else {
          if (!el.value || el.value < '2000-01-01') return; // fecha incompleta mientras se escribe
          I[d.inf] = el.value;
          if (I.desde > I.hasta) { if (d.inf === 'desde') I.hasta = I.desde; else I.desde = I.hasta; }
          if (diasEntre(I.desde, I.hasta) + 1 > MAX_DIAS_INFORME) {
            if (d.inf === 'desde') I.hasta = sumarDias(I.desde, MAX_DIAS_INFORME - 1); else I.desde = sumarDias(I.hasta, -(MAX_DIAS_INFORME - 1));
            toast(`El informe abarca hasta ${MAX_DIAS_INFORME} días; ajusté la otra fecha.`, 'warn');
          }
          const igual = rangosInforme().todos.find((r) => r.desde === I.desde && r.hasta === I.hasta);
          I.rango = igual ? igual.id : 'libre';
        }
        I.sel = null;
        I.datos = null;
        render();
        try { await cargarInforme(); } catch (e) { S.errorVista = errorTexto(e); }
        render();
      } else { I[d.inf] = el.value; render(); }
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

  // Tablero de grupos: arrastrar una tarjeta a otra columna (en el celular, las flechas de la tarjeta)
  document.addEventListener('dragstart', (ev) => {
    const c = ev.target.closest && ev.target.closest('[data-arrastrar]');
    if (!c) return;
    ev.dataTransfer.setData('text/plain', c.dataset.arrastrar);
    ev.dataTransfer.effectAllowed = 'move';
    c.classList.add('arrastrando');
  });
  document.addEventListener('dragend', (ev) => {
    const c = ev.target.closest && ev.target.closest('[data-arrastrar]');
    if (c) c.classList.remove('arrastrando');
    document.querySelectorAll('.kcol.encima').forEach((x) => x.classList.remove('encima'));
  });
  document.addEventListener('dragover', (ev) => {
    const col = ev.target.closest && ev.target.closest('[data-soltar]');
    if (!col) return;
    ev.preventDefault();
    document.querySelectorAll('.kcol.encima').forEach((x) => { if (x !== col) x.classList.remove('encima'); });
    col.classList.add('encima');
  });
  document.addEventListener('drop', async (ev) => {
    const col = ev.target.closest && ev.target.closest('[data-soltar]');
    if (!col) return;
    ev.preventDefault();
    col.classList.remove('encima');
    const id = ev.dataTransfer.getData('text/plain');
    if (id) await moverGrupo(id, col.dataset.soltar);
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
      if (fichaG.id) { cerrarFichaGrupo(true); return; }
      if (S.lb) { S.lb = null; render(); return; }
      if (S.ajuste && S.ocupado !== 'ajuste') { S.ajuste = null; render(); return; }
      if (S.tc.informe && S.ocupado !== 'tcInforme') { S.tc.informe = null; render(); return; }
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
    const dia = r.dataset.dia, hasta = r.dataset.hasta || dia;
    const { porDia } = calcularInformeCache();
    let lista = porDia[dia] || [], titulo = fechaLarga(dia);
    if (hasta !== dia) {
      const acum = {};
      Object.keys(porDia).forEach((d) => { if (d >= dia && d <= hasta) porDia[d].forEach((x) => { const a = acum[x.nombre] = acum[x.nombre] || { nombre: x.nombre, n: 0, min: 0 }; a.n++; a.min += x.min; }); });
      lista = Object.values(acum).sort((a, b) => b.min - a.min);
      titulo = `${fechaCorta(dia)} – ${fechaCorta(hasta)}`;
    }
    const mas = lista.length > 8 ? `<span>y ${lista.length - 8} más</span>` : '';
    tip.innerHTML = `<b>${esc(titulo)}</b>${lista.length ? lista.slice(0, 8).map((x) => `<span>${esc(x.nombre)} · ${x.n ? `${x.n}× · ` : ''}${x.min} min</span>`).join('') + mas : '<span>Nadie llegó tarde</span>'}`;
    const box = tip.parentElement.getBoundingClientRect();
    tip.hidden = false;
    const x = Math.min(ev.clientX - box.left + 12, box.width - tip.offsetWidth - 4);
    tip.style.left = Math.max(4, x) + 'px';
    tip.style.top = Math.max(4, ev.clientY - box.top - tip.offsetHeight - 10) + 'px';
  });
  let cacheInf = { clave: '', valor: null };
  function calcularInformeCache() {
    const I = S.inf, k = [I.desde, I.hasta, I.sede, I.area, I.datos && I.datos.marcas.length].join('|');
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
