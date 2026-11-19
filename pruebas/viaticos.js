// Pruebas del módulo de viáticos y legalización de gastos, con el Supabase simulado.
// Uso: servir intranet/ en :8765 y correr  node pruebas/viaticos.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/pruebas/demo.html';

const fallos = [];
const ok = (c, msg) => { if (c) console.log('OK    ' + msg); else { console.log('FALLO ' + msg); fallos.push(msg); } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const esperar = () => page.waitForFunction(() => !document.querySelector('.cargando') && !document.querySelector('[aria-busy="true"]'));
  const avisa = (t) => page.waitForFunction((t) => [...document.querySelectorAll('.toast')].some((x) => x.textContent.includes(t)), t, { timeout: 4000 }).then(() => true).catch(() => false);
  const texto = (sel) => page.textContent(sel).catch(() => '');
  async function entrar(correo) {
    if (await page.$('header.top')) { await page.click('[data-accion=menu]'); await page.click('.menu-pop [data-accion=salir]'); }
    else await page.goto(BASE);
    await page.waitForSelector('form[data-form=login]');
    if (await page.$(`[data-demo="${correo}"]`)) await page.click(`[data-demo="${correo}"]`);
    else { await page.fill('input[name=correo]', correo); await page.fill('input[name=clave]', await page.evaluate(() => window.SUPABASE_DEMO.clave)); await page.click('form[data-form=login] button[type=submit]'); }
    await page.waitForSelector('header.top, [data-accion=aceptarDatos]');
    if (await page.$('[data-accion=aceptarDatos]')) await page.click('[data-accion=aceptarDatos]');
    await page.waitForSelector('header.top');
    await esperar();
  }
  async function irViaticos() {
    await page.click('header.top .tabs [data-vistas~="viaticos"]');
    await esperar();
    if (await page.$('header.top .subtabs [data-view="viaticos"]')) await page.click('header.top .subtabs [data-view="viaticos"]');
    await page.waitForFunction(() => location.hash === '#viaticos' && !document.querySelector('.cargando'));
  }
  const abrir = async (destino) => { await page.locator('.via-card', { hasText: destino }).first().click(); await page.waitForSelector('.via-volver'); await esperar(); };
  const volver = async () => { await page.click('[data-via=volver]'); await page.waitForSelector('.via-filtros'); };

  // ---------- Menú agrupado ----------
  await entrar('daniela.castro@caminos.example');
  const grupos = await page.$$eval('header.top .tabs button', (b) => b.map((x) => x.textContent.replace(/\d+$/, '').trim()));
  ok(JSON.stringify(grupos) === JSON.stringify(['Inicio', 'Comunicados', 'Viajes', 'Personal']), `menú agrupado de una colaboradora: ${grupos.join(' · ')}`);
  ok(await page.waitForSelector('header.top [data-vistas~="viaticos"] .badge', { timeout: 4000 }).then(() => true).catch(() => false), 'Viajes muestra la insignia: tiene un viático por legalizar');
  await irViaticos();
  const subtabs = await page.$$eval('header.top .subtabs button', (b) => b.map((x) => x.textContent.replace(/\d+$/, '').trim()));
  ok(JSON.stringify(subtabs) === JSON.stringify(['Grupos', 'Viáticos']), `Viajes agrupa ${subtabs.join(' y ')}`);

  // ---------- La colaboradora solicita ----------
  const cards = await page.$$eval('.via-card', (c) => c.map((x) => x.textContent));
  ok(cards.length === 2 && !cards.some((t) => t.includes('Santa Marta')), 'la colaboradora solo ve sus viáticos');
  await page.click('[data-viaform=solicitar]');
  await page.selectOption('.via-form select[data-viab=grupo]', { label: await page.$eval('.via-form select[data-viab=grupo]', (s) => [...s.options].find((o) => o.text.startsWith('Ruta colonial Mompox')).text) });
  ok((await page.inputValue('.via-form input[data-viab=destino]')) === 'Mompox' && !!(await page.inputValue('.via-form input[data-viab=salida]')), 'al elegir el grupo se llenan destino y fechas');
  await page.fill('.via-form input[data-viab=monto]', '600000');
  await page.fill('.via-form textarea[data-viab=motivo]', 'Acompañamiento de la ruta colonial');
  await page.click('.via-form button[type=submit]');
  ok(await avisa('Solicitud enviada'), 'envía la solicitud a gerencia');
  await esperar();
  ok((await page.$$('.via-card')).length === 3, 'la solicitud aparece en su lista');

  // ---------- Legaliza el viaje a Girardot ----------
  await abrir('Girardot');
  await page.fill('[data-viag=descripcion]', 'Taxi de regreso');
  await page.fill('[data-viag=valor]', '40000');
  await page.selectOption('[data-viag=categoria]', 'transporte');
  await page.setInputFiles('[data-viaarchivo]', { name: 'factura-taxi.png', mimeType: 'image/png', buffer: PNG });
  await page.click('form[data-form=viagasto] button[type=submit]');
  ok(await avisa('Gasto agregado con su soporte'), 'registra un gasto con foto del soporte');
  await esperar();
  await page.fill('[data-viag=descripcion]', 'Peaje');
  await page.fill('[data-viag=valor]', '12000');
  await page.click('form[data-form=viagasto] button[type=submit]');
  ok(await avisa('sin soporte'), 'puede registrar un gasto sin soporte (queda marcado)');
  await esperar();
  ok((await texto('.via-tabla')).includes('Sin soporte'), 'la tabla marca los gastos sin soporte');
  await page.locator('.via-tabla tr', { hasText: 'Peaje' }).locator('[data-viaaccion^="quitar:"]').click();
  await page.locator('.via-tabla tr', { hasText: 'Peaje' }).locator('[data-viaaccion^="quitarsi:"]').click();
  ok(await avisa('Gasto quitado'), 'quita un gasto (con confirmación)');
  await esperar();
  ok((await texto('.via-tabla tfoot')).includes('195.000'), 'el total registrado suma los gastos (195.000)');
  await page.click('[data-viaaccion=enviar]');
  ok(await avisa('Legalización enviada'), 'envía la legalización');
  await esperar();
  ok((await texto('.page-h')).includes('en revisión') && !(await page.$('form[data-form=viagasto]')), 'enviada: queda en revisión y ya no se editan gastos');
  const lect = await page.evaluate(async () => { const s = window.supabase.createClient('https://demo.local', 'demo'); return ((await s.from('viaticos').select('*')).data || []).map((v) => v.persona_id); });
  ok(lect.length > 0 && lect.every((id) => id === 'a0000000-0000-4000-8000-000000000004'), 'con su sesión no lee viáticos de otras personas');

  // ---------- La gerencia revisa ----------
  await entrar('andrea.rojas@caminos.example');
  const gAndrea = await page.$$eval('header.top .tabs button', (b) => b.map((x) => x.textContent.replace(/\d+$/, '').trim()));
  ok(JSON.stringify(gAndrea) === JSON.stringify(['Inicio', 'Comunicados', 'Viajes', 'Personal', 'Administración']), `menú de gerencia: ${gAndrea.join(' · ')}`);
  await irViaticos();
  const kpis = await page.$$eval('.via-kpi', (k) => k.map((x) => x.textContent));
  ok(kpis[0].includes('2') && kpis[1].includes('2'), `la gerencia ve 2 solicitudes por aprobar y 2 legalizaciones por revisar (${kpis[0].trim()} | ${kpis[1].trim()})`);
  await page.click('[data-viafiltro=pendientes]');
  ok((await page.$$('.via-card')).length === 4, 'el filtro «Esperan mi revisión» muestra 4');

  await abrir('Mompox');
  ok((await page.inputValue('[data-viar=presupuesto]')) === '600000', 'propone el monto solicitado como presupuesto');
  await page.fill('[data-viar=presupuesto]', '650000');
  await page.click('[data-viaaccion=aprobar]');
  ok(await avisa('aprobado por'), 'asigna presupuesto y aprueba');
  await esperar();
  ok((await texto('.via-kpis')).includes('650.000'), 'el presupuesto aprobado aparece en el viático');
  await volver();

  await abrir('Cartagena');
  await page.click('[data-viaaccion=rechazar]');
  ok(await avisa('motivo del rechazo'), 'para rechazar pide el motivo');
  await page.fill('[data-viar=comentario]', 'El colegio lleva su propio acompañante');
  await page.click('[data-viaaccion=rechazar]');
  ok(await avisa('Solicitud rechazada'), 'rechaza con motivo');
  await esperar();
  await volver();

  await page.click('[data-viafiltro=todos]');
  await abrir('Girardot');
  await page.locator('.via-tabla tr', { hasText: 'Almuerzo y cena' }).locator('[data-viaaccion^="noaceptar:"]').click();
  await page.fill('[data-vianomot]', 'Sin factura legible');
  await page.locator('.via-tabla tr', { hasText: 'Almuerzo y cena' }).locator('[data-viaaccion^="noaceptarsi:"]').click();
  ok(await avisa('no aceptado'), 'no acepta un gasto puntual con motivo');
  await esperar();
  ok((await texto('.via-tabla')).includes('No aceptado: Sin factura legible'), 'el gasto queda tachado con el motivo');
  await page.click('[data-viaaccion=aprobarleg]');
  ok(await avisa('reintegra'), 'aprueba la legalización y dice el saldo a reintegrar');
  await esperar();
  const tiles = await texto('.via-kpis');
  ok(tiles.includes('100.000') && tiles.includes('350.000') && tiles.includes('a favor de Caminos'), 'legalizado 100.000 · saldo 350.000 a favor de Caminos');
  const [doc] = await Promise.all([page.waitForEvent('popup'), page.click('[data-viaaccion=imprimir]')]);
  await doc.waitForLoadState();
  const txtDoc = await doc.textContent('body');
  ok(txtDoc.includes('LEGALIZACIÓN No.') && txtDoc.includes('Daniela Castro') && txtDoc.includes('Saldo a favor de Caminos') && txtDoc.includes('No aceptado'), 'el formato de legalización trae funcionario, gastos, no aceptados y saldo');
  await doc.close();
  await volver();

  await abrir('Chiquinquirá');
  await page.fill('[data-viar=comentario]', 'Falta el soporte del taxi');
  await page.click('[data-viaaccion=devolver]');
  ok(await avisa('devuelta'), 'devuelve una legalización para corregir');
  await esperar();
  await volver();

  await page.click('[data-viaform=asignar]');
  await page.selectOption('.via-form select[data-viab=persona]', { label: 'Felipe Moreno' });
  await page.fill('.via-form input[data-viab=destino]', 'Tunja');
  await page.fill('.via-form input[data-viab=monto]', '300000');
  const hoy = new Date().toISOString().slice(0, 10);
  await page.fill('.via-form input[data-viab=salida]', hoy);
  await page.fill('.via-form input[data-viab=regreso]', hoy);
  await page.click('.via-form button[type=submit]');
  ok(await avisa('asignados a Felipe Moreno'), 'la gerencia asigna viáticos aprobados directamente');
  await esperar();
  ok(!(await page.$('.via-form select[data-viab=persona] option[value="a0000000-0000-4000-8000-000000000001"]')), 'la gerencia no puede asignarse a sí misma');

  // ---------- Valentina corrige lo devuelto ----------
  await entrar('valentina.ruiz@caminos.example');
  await irViaticos();
  await abrir('Chiquinquirá');
  ok((await texto('.via-nota')).includes('te pide corregir') && (await texto('.via-nota')).includes('Falta el soporte del taxi'), 'la funcionaria ve qué debe corregir');
  ok(!!(await page.$('form[data-form=viagasto]')), 'devuelta, puede volver a registrar gastos');
  await page.click('[data-viaaccion=enviar]');
  ok(await avisa('Legalización enviada'), 'la reenvía');

  // ---------- Celular ----------
  await page.setViewportSize({ width: 390, height: 844 });
  await volver();
  let sw = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 390, `@390: la lista de viáticos sin desborde (${sw})`);
  await abrir('Chiquinquirá');
  sw = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 390, `@390: el detalle sin desborde (${sw})`);

  ok(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await browser.close();
  console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nTodo OK');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('FALLO inesperado: ' + e.message); process.exit(1); });
