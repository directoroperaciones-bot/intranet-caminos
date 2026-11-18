/* =====================================================================
   Caminos · Extranet de clientes · clientes.js
   Los clientes de Caminos (aliados y parroquias) entran con su correo y
   ven SOLO sus ventas. La base decide qué ve cada uno (RLS: cada fila
   lleva el código del cliente). Aquí no hay costos, utilidad ni
   proveedores: esos datos ni siquiera llegan a estas tablas.
   ===================================================================== */
(function () {
  'use strict';

  const CFG = window.INTRANET_CONFIG || {};
  const SIN_CONFIGURAR = !CFG.supabaseUrl || /PENDIENTE/.test(CFG.supabaseUrl + CFG.supabaseKey);
  const ENLACE = (function () {
    const h = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    return { recuperar: h.get('type') === 'recovery', error: h.get('error_code') || h.get('error') || '' };
  })();
  const sb = window.supabase && !SIN_CONFIGURAR ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { flowType: 'implicit' } }) : null;

  const MARCA = { nombre: 'Caminos', lema: 'Para ir más lejos', web: 'agenciacaminos.com.co', direccion: 'Calle 79 # 16a-20, Oficina 507 · Bogotá', logo: 'assets/logo-caminos.svg', logoBlanco: 'assets/logo-caminos-blanco.svg' };
  const EFECTIVAS = ['Confirmada', 'Facturado'];
  const ESTADOS = {
    Cotizado: { nombre: 'En cotización', cls: 'info' },
    Confirmada: { nombre: 'Confirmada', cls: 'ok' },
    Facturado: { nombre: 'Facturada', cls: 'ok' },
    Cancelada: { nombre: 'Cancelada', cls: 'mute' },
  };
  const FILTROS = [['todas', 'Todas'], ['viajar', 'Por viajar'], ['efectivas', 'Confirmadas y facturadas'], ['Cotizado', 'En cotización'], ['Cancelada', 'Canceladas']];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  // ---------- Ayudas ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const plata = (v) => COP.format(Math.round(Number(v) || 0)).replace(/\s/g, ' ');
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const fecha = (iso) => (iso ? `${+iso.slice(8, 10)} ${MESES[+iso.slice(5, 7) - 1].slice(0, 3)} ${iso.slice(0, 4)}` : '—');
  const fechaLarga = (iso) => (iso ? `${+iso.slice(8, 10)} de ${MESES[+iso.slice(5, 7) - 1]} de ${iso.slice(0, 4)}` : '');
  const dias = (iso) => Math.round((new Date(iso + 'T12:00:00Z') - new Date(hoy() + 'T12:00:00Z')) / 86400000);
  const pct = (x) => (x == null ? '' : `${(x * 100).toLocaleString('es-CO', { maximumFractionDigits: 2 })} %`);
  const estrella = (cls) => `<svg class="${cls || ''}" viewBox="211.03 381.17 308.05 413.55" aria-hidden="true"><path d="M339.16,587.19l25.9,207.53,26.12-205.32,66.68,38.99-40.16-68.24,101.38-25.73-102.55-23.79,42.5-68.63-69.02,40.94-24.76-101.77-23.98,102.55-69.02-43.28,42.5,69.8-103.72,23.79,103.33,24.56s-44.84,70.97-42.89,70.19c1.95-.78,67.69-41.6,67.69-41.6Z"/></svg>`;
  const IC = {
    avion: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    hotel: '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>',
    bus: '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
    escudo: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    caja: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    usuarios: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    alerta: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    llave: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
    der: '<path d="m9 18 6-6-6-6"/>',
    buscar: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    documento: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  };
  const ico = (n, cls) => `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;
  const icoServicio = (t) => { const k = String(t).toLowerCase(); return k.includes('vuelo') ? 'avion' : k.includes('hotel') ? 'hotel' : k.includes('terrestre') || k.includes('traslado') ? 'bus' : k.includes('asist') ? 'escudo' : 'caja'; };
  const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || '';

  function errorTexto(e) {
    const m = String((e && (e.message || e.error_description)) || e || '');
    if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/banned/i.test(m)) return 'Tu acceso está desactivado. Escríbele a Caminos.';
    if (/same|different from the old/i.test(m)) return 'La contraseña nueva debe ser distinta a la anterior.';
    if (/only request this after|rate limit/i.test(m)) return 'Ya pedimos un enlace hace poco. Espera un minuto e inténtalo de nuevo.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No hay conexión. Revisa tu internet e inténtalo de nuevo.';
    return m || 'Algo salió mal. Inténtalo de nuevo.';
  }
  async function q(p) { const { data, error } = await p; if (error) throw error; return data; }

  // ---------- Estado ----------
  const C = { pantalla: 'cargando', error: '', ocupado: '', correo: '', cuenta: null, ficha: null, ventas: [], cobros: [], cuentas: [], cobradas: new Set(), filtro: 'todas', busca: '', abierta: null, enviado: false, recuperacion: false,
    cc: { abierto: false, desde: '', hasta: '', quitadas: new Set(), confirmar: null, msg: null } };
  const ocupado = (k) => (C.ocupado === k ? ' disabled aria-busy="true"' : C.ocupado ? ' disabled' : '');

  // ---------- Pantallas de acceso ----------
  function marco(html) {
    return `<main class="login cx-login">
      <section class="login-hero">
        <img class="login-logo" src="${MARCA.logoBlanco}" alt="${MARCA.nombre}">
        ${estrella('login-star')}
        <div class="login-copy">
          <span class="eyebrow">Portal de clientes</span>
          <h1>Tus viajes con ${MARCA.nombre}, <em>siempre a la mano.</em></h1>
          <p>Consulta el estado de tus ventas, tus viajeros, lo que ya pagaste y tu saldo, en cualquier momento.</p>
        </div>
        <span class="login-lema">${MARCA.nombre} · ${MARCA.lema}</span>
      </section>
      <section class="login-side">${html}</section>
    </main>`;
  }
  const errHtml = () => (C.error ? `<p class="err" role="alert">${ico('alerta')}${esc(C.error)}</p>` : '');

  function loginView() {
    const demo = CFG.demo && CFG.demo.clientes ? `<div class="demo-cuentas"><span class="eyebrow">Demostración · datos de ejemplo</span>
        <p class="hint">Cliente ficticio: nada de lo que hagas aquí se guarda. Toca la cuenta para entrar.</p>
        <div class="demo-lista">${CFG.demo.clientes.map((c) => `<button type="button" class="demo-cta" data-demo="${esc(c.correo)}"${C.ocupado ? ' disabled' : ''}><b>${esc(c.rol)}</b><span>${esc(c.nombre)}</span></button>`).join('')}</div></div>` : '';
    return marco(`${demo}<form class="card login-card" data-form="login" novalidate>
        <span class="eyebrow">Ingresar</span>
        <h2>Entra a tu portal</h2>
        <label class="field"><span>Correo</span><input name="correo" type="email" autocomplete="username" inputmode="email" value="${esc(C.correo)}" required></label>
        <label class="field"><span>Contraseña</span><input name="clave" type="password" autocomplete="current-password" required></label>
        ${errHtml()}
        <button class="btn block" type="submit"${ocupado('login')}>${C.ocupado === 'login' ? 'Entrando…' : 'Entrar'}</button>
        <button class="btn txt block" type="button" data-a="olvido">¿Olvidaste tu contraseña?</button>
        <p class="hint">¿Aún no tienes acceso? Pídeselo a tu asesora de ${MARCA.nombre}.</p>
      </form>`);
  }
  function olvidoView() {
    if (C.enviado) {
      return marco(`<div class="card login-card"><span class="eyebrow">Recuperar contraseña</span><h2>Revisa tu correo</h2>
        <p class="hint">Si <b>${esc(C.correo)}</b> tiene acceso al portal, en unos minutos te llega un correo con un enlace para crear una contraseña nueva. Sirve una sola vez y vence en 1 hora.</p>
        <button class="btn block" type="button" data-a="volver">Volver a ingresar</button></div>`);
    }
    return marco(`<form class="card login-card" data-form="olvido" novalidate><span class="eyebrow">Recuperar contraseña</span>
        <h2>¿Olvidaste tu contraseña?</h2><p class="hint">Escribe tu correo y te enviamos un enlace seguro para crear una nueva.</p>
        <label class="field"><span>Correo</span><input name="correo" type="email" autocomplete="username" inputmode="email" value="${esc(C.correo)}" required></label>
        ${errHtml()}
        <button class="btn block" type="submit"${ocupado('olvido')}>Enviarme el enlace</button>
        <button class="btn txt block" type="button" data-a="volver">Volver a ingresar</button></form>`);
  }
  function claveView() {
    const n = primerNombre(C.cuenta && (C.cuenta.contacto || C.cuenta.nombre));
    return marco(`<form class="card login-card" data-form="clave" novalidate>
        <span class="eyebrow">${C.recuperacion ? 'Recuperar contraseña' : 'Primer ingreso'}</span>
        <h2>Crea tu contraseña</h2>
        <p class="hint">${n ? `Hola, ${esc(n)}. ` : ''}${C.recuperacion ? 'Escribe tu contraseña nueva dos veces.' : 'La contraseña que te dimos es temporal: crea una propia, de 8 caracteres o más.'}</p>
        <label class="field"><span>Contraseña nueva</span><input name="clave" type="password" autocomplete="new-password" minlength="8" required></label>
        <label class="field"><span>Repítela</span><input name="clave2" type="password" autocomplete="new-password" minlength="8" required></label>
        ${errHtml()}
        <button class="btn block" type="submit"${ocupado('clave')}>Guardar contraseña</button>
        <button class="btn txt block" type="button" data-a="salir">Salir</button></form>`);
  }
  const avisoView = (titulo, texto, extra) => marco(`<div class="card login-card"><span class="eyebrow">Portal de clientes</span><h2>${titulo}</h2><p class="hint">${texto}</p>${extra || ''}<button class="btn block" type="button" data-a="salir">Salir</button></div>`);

  // ---------- Portal ----------
  const efectiva = (v) => EFECTIVAS.includes(v.estado);
  function filtradas() {
    const t = hoy(), b = C.busca.trim().toLowerCase();
    return C.ventas.filter((v) => {
      if (C.filtro === 'viajar' && !(efectiva(v) && v.salida && v.salida >= t)) return false;
      if (C.filtro === 'efectivas' && !efectiva(v)) return false;
      if (ESTADOS[C.filtro] && v.estado !== C.filtro) return false;
      if (b && !(`${v.destino} ${v.plan} ${v.id} ${(v.viajeros || []).join(' ')}`.toLowerCase().includes(b))) return false;
      return true;
    });
  }

  function tarjetaVenta(v) {
    const e = ESTADOS[v.estado] || { nombre: v.estado, cls: 'mute' }, abierta = C.abierta === v.id;
    const ef = efectiva(v), saldo = ef ? Math.max(0, v.valor - v.cobrado) : 0, pagadoPct = ef && v.valor ? Math.min(100, v.cobrado / v.valor * 100) : 0;
    const prox = ef && v.salida && v.salida >= hoy() ? dias(v.salida) : null;
    const servicios = (v.servicios || []);
    return `<article class="cx-venta${abierta ? ' abierta' : ''}">
      <button type="button" class="cx-venta-h" data-venta="${esc(v.id)}" aria-expanded="${abierta}">
        <span class="cx-fecha"><b>${v.salida ? +v.salida.slice(8, 10) : '—'}</b><small>${v.salida ? MESES[+v.salida.slice(5, 7) - 1].slice(0, 3) + ' ' + v.salida.slice(2, 4) : 'sin fecha'}</small></span>
        <span class="cx-dest"><b>${esc(v.destino || 'Viaje')}</b><small>${esc([v.plan, v.tipo_viaje, plural(v.pasajeros || (v.viajeros || []).length, 'viajero', 'viajeros')].filter(Boolean).join(' · '))}</small>
          ${servicios.length ? `<span class="cx-servs">${[...new Set(servicios.map((s) => s.tipo))].map((t) => `<i title="${esc(t)}">${ico(icoServicio(t))}</i>`).join('')}</span>` : ''}</span>
        <span class="cx-est"><span class="chip ${e.cls}">${esc(e.nombre)}</span>${prox != null ? `<small class="cx-prox">${prox === 0 ? 'Sale hoy' : prox === 1 ? 'Sale mañana' : `Sale en ${prox} días`}</small>` : ''}</span>
        <span class="cx-val"><b>${plata(v.valor)}</b>${ef ? `<small class="${saldo ? 'warn' : 'ok'}">${saldo ? `Saldo ${plata(saldo)}` : 'Pagado'}</small>` : `<small>${e.nombre}</small>`}</span>
        <span class="cx-chev">${ico('der')}</span>
      </button>
      ${abierta ? `<div class="cx-venta-b">
        ${ef ? `<div class="cx-pago"><div class="cx-barra" role="img" aria-label="Pagado ${Math.round(pagadoPct)} %"><i style="width:${pagadoPct.toFixed(1)}%"></i></div>
          <dl><div><dt>Valor del viaje</dt><dd>${plata(v.valor)}</dd></div><div><dt>Pagado</dt><dd>${plata(v.cobrado)}</dd></div><div><dt>Saldo pendiente</dt><dd class="${saldo ? 'warn' : 'ok'}">${plata(saldo)}</dd></div>${C.cuenta.comision ? `<div><dt>Tu comisión</dt><dd>${plata(v.comision)}</dd></div>` : ''}</dl></div>` : ''}
        <div class="cx-cols">
          <section><h3>${ico('usuarios')}Viajeros</h3>${(v.viajeros || []).length ? `<ul class="cx-lista">${v.viajeros.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '<p class="hint">Aún sin viajeros registrados.</p>'}</section>
          <section><h3>${ico('caja')}Servicios</h3>${servicios.length ? `<ul class="cx-lista serv">${servicios.map((s) => `<li>${ico(icoServicio(s.tipo))}<span><b>${esc(s.tipo)}${s.cantidad > 1 ? ` ×${s.cantidad}` : ''}</b>${s.detalle ? `<small>${esc(s.detalle)}</small>` : ''}</span></li>`).join('')}</ul>` : '<p class="hint">Aún sin servicios registrados.</p>'}</section>
        </div>
        <p class="cx-ref">Venta <b>${esc(v.id)}</b> · registrada el ${esc(fechaLarga(v.fecha))}${v.salida ? ` · viaje del ${esc(fecha(v.salida))}${v.regreso ? ` al ${esc(fecha(v.regreso))}` : ''}` : ''}</p>
      </div>` : ''}
    </article>`;
  }

  function portalView() {
    const c = C.cuenta, ef = C.ventas.filter(efectiva), t = hoy();
    const valor = ef.reduce((s, v) => s + v.valor, 0), pagado = ef.reduce((s, v) => s + v.cobrado, 0), saldo = ef.reduce((s, v) => s + Math.max(0, v.valor - v.cobrado), 0);
    const comision = ef.reduce((s, v) => s + (+v.comision || 0), 0), viajeros = ef.reduce((s, v) => s + (v.pasajeros || 0), 0);
    const proximas = ef.filter((v) => v.salida && v.salida >= t).sort((a, b) => a.salida.localeCompare(b.salida));
    const lista = filtradas().sort((a, b) => (b.salida || b.fecha).localeCompare(a.salida || a.fecha));
    const kpi = (titulo, val, sub, cls) => `<div class="cx-kpi${cls ? ' ' + cls : ''}"><span>${titulo}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const sinc = c.sincronizado ? new Date(c.sincronizado) : null;
    const cobros = seccionCobros();
    return `<header class="top"><div class="wrap top-in">
        <span class="brand"><img src="${MARCA.logo}" alt="${MARCA.nombre}"><span>Portal de clientes</span></span>
        ${CFG.demo ? '<span class="demo-tag">Demostración</span>' : ''}
        <span class="cx-yo">${esc(c.nombre || c.contacto)}</span>
        <button type="button" class="btn ghost sm" data-a="salir">${ico('salir')}Salir</button>
      </div></header>
      <main class="wrap page cx">
        <div class="page-h"><div><span class="eyebrow">${esc(c.tipo === 'Freelance' ? 'Aliado' : c.tipo || 'Cliente')}${c.contacto && c.nombre && c.contacto !== c.nombre ? ' · ' + esc(c.nombre) : ''}</span>
          <h1 class="display">Hola, <em>${esc(primerNombre(c.contacto || c.nombre))}</em></h1>
          <p class="lead">Estas son tus ventas con ${MARCA.nombre}.${sinc ? ` Información al ${esc(fechaLarga(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(sinc)))}.` : ''}</p></div></div>
        <div class="cx-kpis">
          ${kpi('Ventas', String(ef.length), `${plural(C.ventas.length, 'registrada', 'registradas')} · ${ef.length} confirmadas o facturadas`, 'hero')}
          ${kpi('Valor de tus viajes', plata(valor), 'Confirmados y facturados')}
          ${kpi('Pagado', plata(pagado), valor ? `${Math.round(pagado / valor * 100)} % del valor` : '')}
          ${kpi('Saldo pendiente', plata(saldo), saldo ? 'Por pagar' : 'Estás al día', saldo ? 'warn' : 'ok')}
          ${c.comision ? kpi('Tu comisión', plata(comision), [c.pct_terrestre != null ? `${pct(c.pct_terrestre)} del plan terrestre` : '', c.part_ta != null ? `${pct(c.part_ta)} de la TA` : '', c.modalidad].filter(Boolean).join(' · ')) : kpi('Viajeros', String(viajeros), 'En ventas confirmadas y facturadas')}
        </div>
        ${proximas.length ? `<section class="cx-proximas"><h2>Próximos viajes</h2><div class="cx-prox-l">${proximas.slice(0, 3).map((v) => {
          const d = dias(v.salida), s = Math.max(0, v.valor - v.cobrado);
          return `<button type="button" class="cx-prox-c" data-venta="${esc(v.id)}"><span class="cx-cuenta"><b>${d}</b><small>${d === 1 ? 'día' : 'días'}</small></span><span><b>${esc(v.destino)}</b><small>${esc(fecha(v.salida))} · ${plural(v.pasajeros || 0, 'viajero', 'viajeros')}</small>${s ? `<small class="warn">Saldo ${plata(s)}</small>` : '<small class="ok">Pagado</small>'}</span></button>`;
        }).join('')}</div></section>` : ''}
        <section class="cx-ventas">
          <div class="cx-barra-f">
            <div class="cx-chips" role="group" aria-label="Filtrar ventas">${FILTROS.map(([k, n]) => `<button type="button" data-filtro="${k}" aria-pressed="${C.filtro === k}">${n}</button>`).join('')}</div>
            <label class="cx-busca">${ico('buscar')}<input type="search" placeholder="Buscar destino o viajero" value="${esc(C.busca)}" data-busca aria-label="Buscar"></label>
          </div>
          <div class="cx-lista-v">${lista.length ? lista.map(tarjetaVenta).join('') : '<p class="hint cx-vacio">No hay ventas con este filtro.</p>'}</div>
        </section>
        ${cobros}
        <p class="cx-nota">${ico('escudo')}Solo tú ves esta información. Si algo no coincide, escríbele a tu asesora de ${MARCA.nombre}.</p>
      </main>
      <footer class="foot-site"><div class="wrap"><span><b>${MARCA.nombre}</b> — ${MARCA.lema}</span><span>${esc(MARCA.direccion)} · ${MARCA.web}</span></div></footer>`;
  }

  // ---------- Cuentas de cobro (aliados) ----------
  // El aliado junta la comisión de varias ventas en un solo documento. Las reglas
  // las vuelve a revisar la base al generarla (generar_cuenta_cobro).
  const esAliado = () => !!(C.cuenta && (C.cuenta.comision || /freelance|aliad/i.test(C.cuenta.tipo || '')));
  function rangoMesAnterior() {
    const h = hoy(), d = new Date(Date.UTC(+h.slice(0, 4), +h.slice(5, 7) - 2, 1)), m = d.toISOString().slice(0, 7);
    return { desde: m + '-01', hasta: m + '-' + String(new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate()).padStart(2, '0') };
  }
  function seccionCobros() {
    const CC = window.CuentaCobro, K = C.cc;
    if (!esAliado() && !C.cuentas.length && !C.cobros.length) return '';
    const ficha = Object.assign({ id: C.cuenta.cliente_id, modalidad: C.cuenta.modalidad }, C.ficha || {});
    let form = '';
    if (K.abierto) {
      const el = CC.elegibles(C.ventas, ficha, K.desde, K.hasta, C.cobradas);
      const sel = el.ok.filter((v) => !K.quitadas.has(v.id)), total = sel.reduce((s2, v) => s2 + v.comision, 0);
      const falta = CC.faltantes(ficha), r = el.razones;
      const notas = [r.sinComision && plural(r.sinComision, 'venta sin comisión calculada', 'ventas sin comisión calculada'), r.descuento && `${plural(r.descuento, 'venta', 'ventas')} en otra modalidad`, r.sinFactura && plural(r.sinFactura, 'venta sin número de factura', 'ventas sin número de factura'), r.cobradas && plural(r.cobradas, 'venta ya cobrada', 'ventas ya cobradas'), r.fueraPeriodo && plural(r.fueraPeriodo, 'venta facturada fuera del periodo', 'ventas facturadas fuera del periodo')].filter(Boolean);
      form = `<div class="cx-ccform">
        <div class="cx-ccfechas"><label class="field"><span>Desde (fecha de factura)</span><input type="date" data-cc="desde" value="${esc(K.desde)}"></label>
          <label class="field"><span>Hasta (fecha de corte)</span><input type="date" data-cc="hasta" value="${esc(K.hasta)}" max="${hoy()}"></label></div>
        ${falta.length ? `<p class="notice warn">${ico('alerta')}<span>A tus datos en ${MARCA.nombre} les falta: <b>${esc(falta.join(', '))}</b>. Pídele a tu asesora que los complete${falta.includes('% de comisión') || falta.includes('modalidad «Retorno»') ? '; sin eso no hay ventas para cobrar' : ''}.</span></p>` : ''}
        ${el.ok.length ? `<ul class="cx-ccventas">${el.ok.map((v) => `<li><label><input type="checkbox" data-ccventa="${esc(v.id)}"${K.quitadas.has(v.id) ? '' : ' checked'}><span><b>${esc(v.codigo || v.id)} · ${esc(v.destino)}</b><small>Factura ${esc(v.factura)} · ${esc(fecha(v.fecha_factura))}</small></span><b class="cx-ccval">${plata(v.comision)}</b></label></li>`).join('')}</ul>`
          : '<p class="hint">No tienes ventas para cobrar en este periodo: deben estar facturadas, con número de factura, en modalidad Retorno y sin una cuenta de cobro anterior.</p>'}
        ${notas.length ? `<p class="hint">No entran: ${esc(notas.join(' · '))}.</p>` : ''}
        ${K.msg && K.msg.tipo === 'bad' ? `<p class="err" role="alert">${ico('alerta')}${esc(K.msg.texto)}</p>` : ''}
        <div class="cx-ccacc"><button type="button" class="btn" data-a="ccgenerar"${!sel.length || C.ocupado ? ' disabled' : ''}>${ico('documento')}Generar${sel.length ? ` · ${plural(sel.length, 'venta', 'ventas')} · ${plata(total)}` : ''}</button><button type="button" class="btn txt" data-a="cccerrar">Cancelar</button></div>
      </div>`;
    }
    const filas = C.cuentas.map((k) => {
      const e = CC.ESTADOS[k.estado] || { nombre: k.estado, cls: 'mute' }, conf = K.confirmar === k.id;
      return `<tr><td><b>${esc(k.numero)}</b></td><td>${esc(CC.periodo(k.desde, k.hasta))}</td><td class="num">${k.ventas}</td><td class="num">${plata(k.total)}</td><td><span class="chip ${e.cls}">${esc(e.nombre)}</span></td>
        <td><div class="cx-ccacc">${conf ? `<span class="hint">¿Anularla?</span><button type="button" class="btn sm" data-ccanular="${k.id}"${C.ocupado ? ' disabled' : ''}>Sí</button><button type="button" class="btn txt sm" data-a="ccno">No</button>`
          : `<button type="button" class="btn ghost sm" data-ccpdf="${k.id}">${ico('documento')}PDF</button>${k.estado === 'generada' ? `<button type="button" class="btn txt sm" data-ccpedir="${k.id}">Anular</button>` : ''}`}</div></td></tr>`;
    }).join('');
    const appsheet = C.cobros.length ? `<h3 class="cx-ccsub">Registradas en el gestor de reservas</h3><div class="tablewrap"><table><thead><tr><th>Periodo</th><th>Del</th><th>Al</th><th class="num">Ventas</th><th class="num">Comisión</th><th>Estado</th></tr></thead>
        <tbody>${C.cobros.map((k) => `<tr><td>${esc(k.periodo)}</td><td>${fecha(k.desde)}</td><td>${fecha(k.hasta)}</td><td class="num">${k.ventas}</td><td class="num">${plata(k.total)}</td><td><span class="chip ${/pag/i.test(k.estado) ? 'ok' : 'info'}">${esc(k.estado || '—')}</span></td></tr>`).join('')}</tbody></table></div>` : '';
    return `<section class="card cx-cobros"><div class="cx-cch"><h2>${ico('documento')}Tus cuentas de cobro</h2>${esAliado() && !K.abierto ? `<button type="button" class="btn sm" data-a="ccnueva">${ico('documento')}Generar cuenta de cobro</button>` : ''}</div>
      <p class="hint">Junta en un solo documento la comisión de varias ventas facturadas. Descárgalo en PDF, fírmalo y envíalo a ${MARCA.nombre}.</p>
      ${K.msg && K.msg.tipo === 'ok' ? `<p class="notice ok">${esc(K.msg.texto)}</p>` : ''}
      ${form}
      ${C.cuentas.length ? `<div class="tablewrap"><table><thead><tr><th>Número</th><th>Periodo</th><th class="num">Ventas</th><th class="num">Comisión</th><th>Estado</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>` : (K.abierto ? '' : '<p class="hint">Aún no tienes cuentas de cobro.</p>')}
      ${appsheet}</section>`;
  }
  async function cargarCuentas() {
    const [cuentas, cobradas, ficha] = await Promise.all([
      q(sb.from('cuentas_cobro').select('*').order('creada', { ascending: false })),
      q(sb.from('cuentas_cobro_ventas').select('venta_id')),
      q(sb.from('clientes_ext').select('*')),
    ]);
    C.cuentas = cuentas || [];
    C.cobradas = new Set((cobradas || []).map((x) => x.venta_id));
    C.ficha = (ficha || [])[0] || null;
  }
  async function ccAccion(fn) {
    if (C.ocupado) return;
    C.ocupado = 'cc'; C.cc.msg = null; render();
    try { await fn(); } catch (e) { C.cc.msg = { tipo: 'bad', texto: errorTexto(e) }; }
    C.ocupado = ''; render();
  }

  // ---------- Render ----------
  let foco = null;
  function render() {
    const app = document.getElementById('app');
    const P = C.pantalla;
    const activa = document.activeElement && document.activeElement.matches && document.activeElement.matches('[data-busca]');
    const pos = activa ? document.activeElement.selectionStart : null;
    app.innerHTML = P === 'cargando' ? `<div class="cargando">${estrella('arranque-star')}<span>Cargando…</span></div>`
      : P === 'login' ? loginView() : P === 'olvido' ? olvidoView() : P === 'clave' ? claveView()
      : P === 'inactivo' ? avisoView('Tu acceso está desactivado', `Escríbele a tu asesora de ${MARCA.nombre} si crees que es un error.`)
      : P === 'nocliente' ? avisoView('Esta cuenta no es del portal de clientes', 'Si eres del equipo de Caminos, entra a la intranet.', '<a class="btn ghost block" href="./">Ir a la intranet</a>')
      : P === 'preparacion' ? avisoView('Muy pronto', 'El portal de clientes se está preparando.') : portalView();
    if (activa) { const i = app.querySelector('[data-busca]'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) { /* nada */ } } }
    if (foco) { const f = app.querySelector(foco); foco = null; if (f) f.focus(); }
  }
  async function accion(k, fn) {
    if (C.ocupado) return;
    C.ocupado = k; C.error = ''; render();
    try { await fn(); } catch (e) { C.error = errorTexto(e); }
    C.ocupado = ''; render();
  }

  // ---------- Flujo ----------
  async function cargar(user) {
    const cuenta = await q(sb.rpc('mi_cuenta_cliente'));
    if (!cuenta) { C.pantalla = 'nocliente'; return; }
    if (!cuenta.activo) { C.pantalla = 'inactivo'; return; }
    C.cuenta = cuenta;
    if (C.recuperacion || cuenta.debe_cambiar || (user && user.user_metadata && user.user_metadata.debe_cambiar_contrasena)) { C.pantalla = 'clave'; foco = 'input[name=clave]'; return; }
    const [ventas, cobros] = await Promise.all([
      q(sb.from('ventas_cliente').select('*').order('fecha', { ascending: false })),
      q(sb.from('cobros_cliente').select('*').order('hasta', { ascending: false })),
    ]);
    C.ventas = (ventas || []).map((v) => Object.assign({}, v, { valor: +v.valor || 0, cobrado: +v.cobrado || 0, comision: +v.comision || 0, viajeros: Array.isArray(v.viajeros) ? v.viajeros : [], servicios: Array.isArray(v.servicios) ? v.servicios : [] }));
    C.cobros = cobros || [];
    try { await cargarCuentas(); } catch (e) { C.cuentas = []; }
    C.pantalla = 'portal';
  }
  async function arrancar() {
    if (SIN_CONFIGURAR) { C.pantalla = 'preparacion'; render(); return; }
    if (!sb) { C.pantalla = 'login'; C.error = 'No se pudo cargar el portal. Revisa tu conexión y recarga.'; render(); return; }
    try {
      const { data } = await sb.auth.getSession();
      if (ENLACE.recuperar || ENLACE.error) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* nada */ } }
      if (ENLACE.recuperar && data && data.session) C.recuperacion = true;
      if (!data || !data.session) {
        C.pantalla = ENLACE.error ? 'olvido' : 'login';
        if (ENLACE.error) C.error = 'El enlace venció o ya se usó. Pide uno nuevo.';
      } else await cargar(data.session.user);
    } catch (e) { C.pantalla = 'login'; C.error = errorTexto(e); }
    render();
  }
  async function entrar(correo, clave) {
    C.correo = correo;
    await accion('login', async () => {
      const { data, error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
      if (error) { foco = 'input[name=clave]'; throw error; }
      await cargar(data.user);
    });
  }
  async function salir() {
    try { await sb.auth.signOut(); } catch (e) { /* igual se limpia */ }
    Object.assign(C, { pantalla: 'login', cuenta: null, ficha: null, ventas: [], cobros: [], cuentas: [], cobradas: new Set(), error: '', filtro: 'todas', busca: '', abierta: null, recuperacion: false });
    Object.assign(C.cc, { abierto: false, quitadas: new Set(), confirmar: null, msg: null });
    render();
  }

  // ---------- Eventos ----------
  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-a],[data-venta],[data-filtro],[data-demo],[data-ccpdf],[data-ccpedir],[data-ccanular]');
    if (!el) return;
    const d = el.dataset;
    if (d.demo) { await entrar(d.demo, CFG.demo.clave); return; }
    if (d.venta) {
      const yaAbierta = C.abierta === d.venta;
      C.abierta = yaAbierta ? null : d.venta;
      if (!yaAbierta && el.classList.contains('cx-prox-c')) { C.filtro = 'todas'; C.busca = ''; }
      render();
      if (!yaAbierta) { const t = document.querySelector(`.cx-venta-h[data-venta="${CSS.escape(d.venta)}"]`); if (t && el.classList.contains('cx-prox-c')) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return;
    }
    if (d.filtro) { C.filtro = d.filtro; C.abierta = null; render(); return; }
    if (d.ccpdf) { const k = C.cuentas.find((x) => String(x.id) === d.ccpdf); if (k) window.CuentaCobro.abrir(k); return; }
    if (d.ccpedir) { C.cc.confirmar = +d.ccpedir; render(); return; }
    if (d.ccanular) {
      await ccAccion(async () => {
        await q(sb.rpc('estado_cuenta_cobro', { p_id: +d.ccanular, p_estado: 'anulada' }));
        C.cc.confirmar = null;
        await cargarCuentas();
        C.cc.msg = { tipo: 'ok', texto: 'Cuenta de cobro anulada: sus ventas quedaron libres para otra.' };
      });
      return;
    }
    if (d.a === 'ccnueva') { Object.assign(C.cc, rangoMesAnterior(), { abierto: true, quitadas: new Set(), msg: null, confirmar: null }); render(); return; }
    if (d.a === 'cccerrar') { C.cc.abierto = false; C.cc.msg = null; render(); return; }
    if (d.a === 'ccno') { C.cc.confirmar = null; render(); return; }
    if (d.a === 'ccgenerar') {
      const K = C.cc, ficha = Object.assign({ id: C.cuenta.cliente_id, modalidad: C.cuenta.modalidad }, C.ficha || {});
      const ids = window.CuentaCobro.elegibles(C.ventas, ficha, K.desde, K.hasta, C.cobradas).ok.filter((v) => !K.quitadas.has(v.id)).map((v) => v.id);
      await ccAccion(async () => {
        const r = await q(sb.rpc('generar_cuenta_cobro', { p_cliente: C.cuenta.cliente_id, p_desde: K.desde, p_hasta: K.hasta, p_ventas: ids }));
        await cargarCuentas();
        Object.assign(K, { abierto: false, quitadas: new Set() });
        K.msg = { tipo: 'ok', texto: `Listo: cuenta de cobro ${r.numero} por ${plata(r.total)}. Toca «PDF» para descargarla, fírmala y envíala.` };
      });
      return;
    }
    if (d.a === 'olvido') { C.pantalla = 'olvido'; C.enviado = false; C.error = ''; render(); return; }
    if (d.a === 'volver') { C.pantalla = 'login'; C.error = ''; render(); return; }
    if (d.a === 'salir') { await salir(); }
  });
  document.addEventListener('change', (ev) => {
    const t = ev.target, d = t.dataset || {};
    if (d.cc === 'desde' || d.cc === 'hasta') { C.cc[d.cc] = t.value; C.cc.msg = null; render(); return; }
    if (d.ccventa) { if (t.checked) C.cc.quitadas.delete(d.ccventa); else C.cc.quitadas.add(d.ccventa); render(); }
  });
  document.addEventListener('input', (ev) => {
    if (ev.target.matches && ev.target.matches('[data-busca]')) { C.busca = ev.target.value; C.abierta = null; render(); }
  });
  document.addEventListener('submit', async (ev) => {
    const f = ev.target.closest('form[data-form]');
    if (!f) return;
    ev.preventDefault();
    const tipo = f.dataset.form;
    if (tipo === 'login') { await entrar(f.correo.value.trim().toLowerCase(), f.clave.value); return; }
    if (tipo === 'olvido') {
      C.correo = f.correo.value.trim().toLowerCase();
      if (!C.correo.includes('@')) { C.error = 'Escribe tu correo.'; render(); return; }
      await accion('olvido', async () => {
        const { error } = await sb.auth.resetPasswordForEmail(C.correo, { redirectTo: location.origin + location.pathname });
        if (error) throw error;
        C.enviado = true;
      });
      return;
    }
    if (tipo === 'clave') {
      const a = f.clave.value, b = f.clave2.value;
      if (a.length < 8) { C.error = 'La contraseña debe tener 8 caracteres o más.'; foco = 'input[name=clave]'; render(); return; }
      if (a !== b) { C.error = 'Las dos contraseñas no coinciden.'; foco = 'input[name=clave2]'; render(); return; }
      await accion('clave', async () => {
        const { error } = await sb.auth.updateUser({ password: a, data: { debe_cambiar_contrasena: false } });
        if (error) throw error;
        await q(sb.rpc('clave_cliente_cambiada'));
        C.recuperacion = false;
        const { data } = await sb.auth.getUser();
        await cargar(data.user);
      });
    }
  });
  if (sb) sb.auth.onAuthStateChange((evento) => { if (evento === 'SIGNED_OUT' && C.pantalla !== 'login') { C.pantalla = 'login'; render(); } });

  arrancar();
})();
