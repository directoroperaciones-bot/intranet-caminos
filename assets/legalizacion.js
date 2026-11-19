/* =====================================================================
   Caminos · Legalización de gastos de viaje (documento para imprimir o PDF)
   Legalizacion.abrir(datos) abre el formato y el diálogo de imprimir.
   datos: { numero, funcionario, area, destino, grupo, salida, regreso, motivo,
            presupuesto, aprobo, aprobado, reviso, revisado, estado,
            gastos: [{ fecha, categoria, descripcion, valor, soporte, no_aceptado }] }
   ===================================================================== */
(function () {
  'use strict';
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const CATEGORIAS = { alimentacion: 'Alimentación', hospedaje: 'Hospedaje', transporte: 'Transporte', propinas: 'Propinas', entradas: 'Entradas y tiquetes', otros: 'Otros' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const plata = (v) => COP.format(Math.round(Number(v) || 0)).replace(/\s/g, ' ');
  const fecha = (iso) => (iso ? `${+String(iso).slice(8, 10)} de ${MESES[+String(iso).slice(5, 7) - 1]} de ${String(iso).slice(0, 4)}` : '—');
  const corta = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}` : '—');

  function html(d) {
    const gastos = (d.gastos || []).slice().sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    const aceptado = gastos.filter((g) => !g.no_aceptado).reduce((a, g) => a + Number(g.valor), 0);
    const registrado = gastos.reduce((a, g) => a + Number(g.valor), 0);
    const saldo = Number(d.presupuesto || 0) - aceptado;
    const porCat = {};
    gastos.filter((g) => !g.no_aceptado).forEach((g) => { porCat[g.categoria] = (porCat[g.categoria] || 0) + Number(g.valor); });
    const cerrado = d.estado === 'cerrado';
    const borrador = !cerrado;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Legalización de viáticos No. ${esc(d.numero)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap">
<style>
  @page { size: letter; margin: 14mm 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 400 10pt/1.45 Poppins, system-ui, sans-serif; color: #3A3C42; background: #fff; }
  .hoja { max-width: 800px; margin: 0 auto; padding: 24px; position: relative; }
  .borrador::before { content: "BORRADOR"; position: fixed; top: 42%; left: 50%; transform: translate(-50%, -50%) rotate(-24deg); font: 700 84pt/1 Poppins, sans-serif; color: rgba(242, 80, 97, .10); pointer-events: none; }
  h1 { margin: 0; font: 700 16pt/1.2 Poppins, sans-serif; color: #1F2024; }
  .emisor p { margin: 2px 0 0; color: #7E859A; font-size: 9pt; }
  .barra { height: 4px; background: #F25061; border-radius: 4px; margin: 12px 0 14px; }
  table { width: 100%; border-collapse: collapse; }
  .caja td { border: 1px solid #E2E0DD; padding: 8px 12px; text-align: center; }
  .caja .num { font-weight: 700; color: #1F2024; font-size: 11pt; }
  .partes { margin-top: 10px; }
  .partes td { border: 1px solid #E2E0DD; padding: 7px 12px; }
  .partes td.k { width: 20%; font: 600 8pt/1.3 Poppins, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #7E859A; background: #F8F5F2; }
  h2 { font: 600 8.5pt/1.3 Poppins, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #F25061; margin: 16px 0 6px; }
  .detalle th { font: 600 7.5pt/1.3 Poppins, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #fff; background: #1F2024; padding: 7px 8px; text-align: left; }
  .detalle td { padding: 6px 8px; border-bottom: 1px solid #E2E0DD; vertical-align: top; }
  .detalle .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .detalle .no td { color: #9AA0AE; }
  .detalle .no .r { text-decoration: line-through; }
  .detalle small { display: block; color: #B42318; font-size: 8pt; }
  .resumen td { border: 1px solid #E2E0DD; padding: 7px 12px; }
  .resumen td:first-child { width: 60%; background: #F8F5F2; color: #3A3C42; }
  .resumen .r { text-align: right; font-variant-numeric: tabular-nums; }
  .resumen .total td { font-weight: 700; color: #1F2024; background: #FDE9EB; }
  .nota { color: #7E859A; font-size: 8.5pt; margin: 6px 0 0; }
  .firmas { margin-top: 44px; }
  .firmas td { width: 33%; vertical-align: bottom; padding: 0 14px 0 0; font-size: 9pt; }
  .linea { border-top: 1px solid #1F2024; padding-top: 6px; }
  .pie { margin-top: 24px; padding-top: 10px; border-top: 1px solid #E2E0DD; font-size: 8pt; color: #7E859A; text-align: right; }
  .acc { text-align: center; margin: 0 0 16px; }
  .acc button { font: 600 11pt Poppins, sans-serif; background: #F25061; color: #fff; border: 0; border-radius: 10px; padding: 10px 18px; cursor: pointer; }
  @media print { .acc { display: none; } .hoja { padding: 0; } }
</style></head><body><div class="hoja${borrador ? ' borrador' : ''}">
<div class="acc"><button type="button" onclick="window.print()">Imprimir o guardar como PDF</button></div>
<div class="emisor"><h1>AGENCIA DE VIAJES CAMINOS</h1><p>NIT 901763410-9 · Legalización de gastos de viaje (viáticos)</p></div>
<div class="barra"></div>
<table class="caja"><tr><td class="num">LEGALIZACIÓN No. ${esc(d.numero)}</td><td>${cerrado ? `Aprobada el <b>${esc(fecha(d.revisado))}</b>` : `Estado: <b>${esc(d.estadoTxt || d.estado)}</b>`}</td></tr></table>
<table class="partes">
  <tr><td class="k">Funcionario</td><td>${esc(d.funcionario)}${d.area ? ` · ${esc(d.area)}` : ''}</td><td class="k">Destino</td><td>${esc(d.destino)}</td></tr>
  <tr><td class="k">Viaje</td><td>${esc(corta(d.salida))} al ${esc(corta(d.regreso))}</td><td class="k">Grupo</td><td>${esc(d.grupo || '—')}</td></tr>
  <tr><td class="k">Motivo</td><td colspan="3">${esc(d.motivo || '—')}</td></tr>
  <tr><td class="k">Aprobó el anticipo</td><td>${esc(d.aprobo || '—')}${d.aprobado ? ` · ${esc(corta(String(d.aprobado).slice(0, 10)))}` : ''}</td><td class="k">Revisó</td><td>${esc(d.reviso || '—')}</td></tr>
</table>
<h2>Detalle de gastos</h2>
<table class="detalle"><thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Soporte</th><th class="r">Valor</th></tr></thead>
<tbody>${gastos.map((g) => `<tr class="${g.no_aceptado ? 'no' : ''}"><td>${esc(corta(g.fecha))}</td><td>${esc(CATEGORIAS[g.categoria] || g.categoria)}</td><td>${esc(g.descripcion)}${g.no_aceptado ? `<small>No aceptado: ${esc(g.no_aceptado)}</small>` : ''}</td><td>${g.soporte ? 'Sí' : 'No'}</td><td class="r">${plata(g.valor)}</td></tr>`).join('') || '<tr><td colspan="5">Sin gastos registrados.</td></tr>'}</tbody></table>
<h2>Resumen</h2>
<table class="resumen">
  ${Object.keys(CATEGORIAS).filter((k) => porCat[k]).map((k) => `<tr><td>${esc(CATEGORIAS[k])}</td><td class="r">${plata(porCat[k])}</td></tr>`).join('')}
  <tr><td>Anticipo entregado (presupuesto)</td><td class="r">${plata(d.presupuesto)}</td></tr>
  <tr><td>Total gastos registrados</td><td class="r">${plata(registrado)}</td></tr>
  ${registrado !== aceptado ? `<tr><td>Gastos no aceptados</td><td class="r">− ${plata(registrado - aceptado)}</td></tr>` : ''}
  <tr><td>Total legalizado</td><td class="r">${plata(aceptado)}</td></tr>
  <tr class="total"><td>${saldo > 0 ? 'Saldo a favor de Caminos (lo reintegra el funcionario)' : saldo < 0 ? 'Saldo a favor del funcionario (lo reembolsa Caminos)' : 'Saldo'}</td><td class="r">${plata(Math.abs(saldo))}</td></tr>
</table>
<p class="nota">Valores en pesos colombianos. Los soportes (facturas y recibos) quedan adjuntos en la intranet de Caminos.</p>
<table class="firmas"><tr><td><div class="linea">Firma del funcionario<br><b>${esc(d.funcionario)}</b></div></td>
  <td><div class="linea">Aprobó<br><b>${esc(d.reviso || '')}</b></div></td>
  <td><div class="linea">Contabilidad</div></td></tr></table>
<div class="pie">Generado por la intranet de Agencia de Viajes Caminos · Para ir más lejos</div>
</div></body></html>`;
  }

  function abrir(d) { return window.CuentaCobro.imprimir(html(d)); }

  window.Legalizacion = { html, abrir, CATEGORIAS };
})();
