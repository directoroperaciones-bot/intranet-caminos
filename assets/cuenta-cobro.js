/* =====================================================================
   Caminos · Cuenta de cobro del aliado (documento para imprimir o PDF)
   Sigue la plantilla CUENTA_COBRO_ALIADO_MENSUAL_CAMINOS de AppSheet.
   La usan la intranet (gerencia) y el portal de clientes (el aliado).
   CuentaCobro.abrir(cuenta) abre el documento y el diálogo de imprimir;
   ahí se elige «Guardar como PDF».
   ===================================================================== */
(function () {
  'use strict';
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const plata = (v) => COP.format(Math.round(Number(v) || 0)).replace(/\s/g, ' ');
  const fecha = (iso) => (iso ? `${+String(iso).slice(8, 10)} de ${MESES[+String(iso).slice(5, 7) - 1]} de ${String(iso).slice(0, 4)}` : '—');
  const corta = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}` : '—');
  function periodo(desde, hasta) {
    const d = String(desde), h = String(hasta);
    const mesCompleto = d.slice(0, 7) === h.slice(0, 7) && d.slice(8) === '01' && +h.slice(8) === new Date(Date.UTC(+h.slice(0, 4), +h.slice(5, 7), 0)).getUTCDate();
    if (mesCompleto) { const m = MESES[+d.slice(5, 7) - 1]; return `${m.charAt(0).toUpperCase() + m.slice(1)} de ${d.slice(0, 4)}`; }
    return `${fecha(d)} al ${fecha(h)}`;
  }

  function html(c) {
    const a = (c.datos && c.datos.cliente) || {}, lineas = (c.datos && c.datos.lineas) || [];
    const titular = a.titular_cuenta || a.nombre || '';
    const docTitular = a.titular_cuenta ? (a.documento_titular || '') : (a.nit || '');
    const falta = (v) => (v ? esc(v) : '<span class="falta">Sin dato en AppSheet</span>');
    const anulada = c.estado === 'anulada';
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cuenta de cobro ${esc(c.numero)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap">
<style>
  @page { size: letter; margin: 16mm 16mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 400 10.5pt/1.45 Poppins, system-ui, sans-serif; color: #3A3C42; background: #fff; }
  .hoja { max-width: 780px; margin: 0 auto; padding: 24px; position: relative; }
  .anulada::before { content: "ANULADA"; position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-24deg); font: 700 90pt/1 Poppins, sans-serif; color: rgba(180, 35, 24, .14); pointer-events: none; }
  h1 { margin: 0; font: 700 17pt/1.2 Poppins, sans-serif; color: #1F2024; }
  .emisor p { margin: 2px 0 0; color: #7E859A; font-size: 9.5pt; }
  .barra { height: 4px; background: #F25061; border-radius: 4px; margin: 14px 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  .caja td { border: 1px solid #E2E0DD; padding: 9px 12px; text-align: center; }
  .caja .num { font-weight: 700; color: #1F2024; font-size: 11.5pt; }
  .partes { margin-top: 10px; }
  .partes td { border: 1px solid #E2E0DD; padding: 8px 12px; }
  .partes td:first-child { width: 22%; font: 600 8.5pt/1.3 Poppins, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #7E859A; background: #F8F5F2; }
  h2 { font: 600 8.5pt/1.3 Poppins, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #F25061; margin: 18px 0 6px; }
  .detalle th { font: 600 8pt/1.3 Poppins, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #fff; background: #1F2024; padding: 8px 10px; text-align: left; }
  .detalle td { padding: 7px 10px; border-bottom: 1px solid #E2E0DD; }
  .detalle .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .detalle small { display: block; color: #7E859A; font-size: 8.5pt; }
  .detalle .total td { font-weight: 700; color: #1F2024; background: #FDE9EB; border-bottom: 0; }
  .nota { color: #7E859A; font-size: 9pt; margin: 6px 0 0; }
  .pago td { border: 1px solid #E2E0DD; padding: 7px 12px; }
  .pago td:first-child { width: 32%; color: #7E859A; background: #F8F5F2; }
  ul { margin: 0; padding-left: 18px; font-size: 9pt; color: #3A3C42; }
  ul li { margin: 2px 0; }
  .firmas { margin-top: 40px; }
  .firmas td { width: 50%; vertical-align: bottom; padding: 0 14px 0 0; font-size: 9.5pt; }
  .linea { border-top: 1px solid #1F2024; padding-top: 6px; }
  .pie { margin-top: 26px; padding-top: 10px; border-top: 1px solid #E2E0DD; font-size: 8.5pt; color: #7E859A; text-align: right; }
  .falta { color: #B42318; font-style: italic; }
  .acc { text-align: center; margin: 0 0 16px; }
  .acc button { font: 600 11pt Poppins, sans-serif; background: #F25061; color: #fff; border: 0; border-radius: 10px; padding: 10px 18px; cursor: pointer; }
  @media print { .acc { display: none; } .hoja { padding: 0; } }
</style></head><body><div class="hoja${anulada ? ' anulada' : ''}">
<div class="acc"><button type="button" onclick="window.print()">Imprimir o guardar como PDF</button></div>
<div class="emisor"><h1>${esc(a.nombre || '')}</h1>
  <p>NIT ${falta(a.nit)} · ${falta(a.direccion)} · ${falta(a.ciudad)}</p>
  <p>Tel. ${falta(a.telefono)} · ${esc(a.correo || '')}</p></div>
<div class="barra"></div>
<table class="caja"><tr><td class="num">CUENTA DE COBRO No. ${esc(c.numero)}</td><td>Fecha de expedición: <b>${esc(fecha(c.hasta))}</b></td></tr></table>
<table class="partes"><tr><td>Deudor</td><td>AGENCIA DE VIAJES CAMINOS · NIT 901763410-9</td></tr>
  <tr><td>Acreedor</td><td>${esc(a.nombre || '')} · NIT ${falta(a.nit)}</td></tr></table>
<h2>Concepto</h2>
<p>Comisión consolidada por intermediación comercial correspondiente a las ventas facturadas entre el ${esc(fecha(c.desde))} y el ${esc(fecha(c.hasta))}, gestionadas por el aliado a través de Agencia de Viajes Caminos. El detalle siguiente identifica cada reserva, su factura y la comisión causada según el acuerdo comercial vigente.</p>
<h2>Detalle de cobro</h2>
<table class="detalle"><thead><tr><th>Reserva</th><th>Número de factura</th><th>Fecha de factura</th><th class="r">Comisión</th></tr></thead>
<tbody>${lineas.map((l) => `<tr><td><b>${esc(l.codigo || l.venta)}</b>${l.destino ? `<small>${esc([l.destino, l.plan].filter(Boolean).join(' · '))}</small>` : ''}</td><td>${esc(l.factura)}</td><td>${esc(corta(l.fecha_factura))}</td><td class="r">${plata(l.comision)}</td></tr>`).join('')}
<tr class="total"><td colspan="3">TOTAL COMISIÓN DEL PERIODO</td><td class="r">${plata(c.total)}</td></tr></tbody></table>
<p class="nota">Periodo: ${esc(periodo(c.desde, c.hasta))} · Ventas incluidas: ${lineas.length} · Valores expresados en pesos colombianos.</p>
<h2>Forma de pago</h2>
<table class="pago"><tr><td>Banco</td><td>${falta(a.banco)}</td></tr><tr><td>Tipo de cuenta</td><td>${falta(a.tipo_cuenta)}</td></tr>
  <tr><td>Número de cuenta</td><td>${falta(a.numero_cuenta)}</td></tr><tr><td>Titular</td><td>${falta(titular)}</td></tr>
  <tr><td>Documento del titular</td><td>${falta(docTitular)}</td></tr></table>
<h2>Observaciones</h2>
<ul><li>El presente documento no constituye factura de venta. El cobrante declara no encontrarse obligado a expedir factura.</li>
  <li>Las retenciones que correspondan se aplicarán de acuerdo con el régimen tributario del cobrante.</li>
  <li>Esta cuenta de cobro se emite únicamente para comisiones en modalidad Retorno. Las ventas en modalidad Descuento quedan excluidas.</li>
  <li>El detalle incluye únicamente ventas del periodo con número de factura registrado en la aplicación.</li></ul>
<table class="firmas"><tr><td><div class="linea">Firma del cobrante<br><b>${esc(titular)}</b><br>Documento: ${esc(docTitular)}</div></td>
  <td><div class="linea">Ciudad y fecha<br><b>${esc(a.ciudad || '')}${a.ciudad ? ', ' : ''}${esc(fecha(c.hasta))}</b></div></td></tr></table>
<div class="pie">Documento prellenado automáticamente por la aplicación de gestión de Agencia de Viajes Caminos · NIT 901763410-9 · Para ir más lejos</div>
</div></body></html>`;
  }

  // Abre el documento listo para imprimir o guardar como PDF
  function abrir(c) {
    const doc = html(c);
    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(doc);
      w.document.close();
      w.focus();
      setTimeout(() => { try { w.print(); } catch (e) { /* el botón de la página sirve */ } }, 600);
      return true;
    }
    // Si el navegador bloqueó la ventana: se imprime desde un marco oculto
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(doc); f.contentDocument.close();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { /* nada */ } setTimeout(() => f.remove(), 2000); }, 600);
    return false;
  }

  // Ventas que se pueden cobrar (mismas reglas que generar_cuenta_cobro en la base)
  function elegibles(ventas, cliente, desde, hasta, cobradas) {
    const mod = (v) => String(v.modalidad || (cliente && cliente.modalidad) || '').trim().toLowerCase();
    const res = { ok: [], razones: { sinFactura: 0, descuento: 0, sinComision: 0, cobradas: 0, fueraPeriodo: 0 } };
    ventas.filter((v) => v.cliente_id === cliente.id && v.estado === 'Facturado').forEach((v) => {
      if (!String(v.factura || '').trim()) { res.razones.sinFactura++; return; }
      if (mod(v) !== 'retorno') { res.razones.descuento++; return; }
      if (cobradas.has(v.id)) { res.razones.cobradas++; return; }
      if (!v.fecha_factura || v.fecha_factura < desde || v.fecha_factura > hasta) { res.razones.fueraPeriodo++; return; }
      if (!(+v.comision > 0)) { res.razones.sinComision++; return; }
      res.ok.push(v);
    });
    res.ok.sort((x, y) => String(x.fecha_factura).localeCompare(String(y.fecha_factura)));
    return res;
  }
  // Datos del aliado que la plantilla necesita y faltan en AppSheet
  function faltantes(c) {
    const f = [];
    if (!c.nit) f.push('NIT');
    if (!c.banco || !c.numero_cuenta || !c.tipo_cuenta) f.push('datos bancarios');
    if (!c.direccion) f.push('dirección');
    if (c.pct_terrestre == null && c.part_ta == null) f.push('% de comisión');
    if (String(c.modalidad || '').trim().toLowerCase() !== 'retorno') f.push('modalidad «Retorno»');
    return f;
  }
  const ESTADOS = { generada: { nombre: 'Generada', cls: 'info' }, enviada: { nombre: 'Enviada', cls: 'warn' }, pagada: { nombre: 'Pagada', cls: 'ok' }, anulada: { nombre: 'Anulada', cls: 'mute' } };

  window.CuentaCobro = { html, abrir, elegibles, faltantes, periodo, ESTADOS };
})();
