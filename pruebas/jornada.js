// Pruebas de la entrada temprana autorizada y de la medición de la salida,
// con el Supabase simulado y el reloj fijo en un lunes a las 6:10 a. m. (Bogotá).
// Uso: servir intranet/ en :8765 y correr  node pruebas/jornada.js
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8765/pruebas/demo.html';

const fallos = [];
const ok = (c, msg) => { if (c) console.log('OK    ' + msg); else { console.log('FALLO ' + msg); fallos.push(msg); } };

// Próximo lunes (Daniela tiene Turno 1: 7:00 a 16:30)
const d = new Date();
d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
const LUNES = d.toISOString().slice(0, 10);
const a_las = (hhmm) => new Date(`${LUNES}T${hhmm}:00-05:00`);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 }, acceptDownloads: true });
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const esperar = () => page.waitForFunction(() => !document.querySelector('.cargando') && !document.querySelector('[aria-busy="true"]'));
  const avisa = (t) => page.waitForFunction((t) => [...document.querySelectorAll('.toast')].some((x) => x.textContent.includes(t)), t, { timeout: 4000 }).then(() => true).catch(() => false);
  async function entrar(correo) {
    if (await page.$('header.top')) { await page.click('[data-accion=menu]'); await page.click('.menu-pop [data-accion=salir]'); }
    await page.waitForSelector('form[data-form=login]');
    await page.click(`[data-demo="${correo}"]`);
    await page.waitForSelector('header.top, [data-accion=aceptarDatos]');
    if (await page.$('[data-accion=aceptarDatos]')) await page.click('[data-accion=aceptarDatos]');
    await page.waitForSelector('header.top');
    await esperar();
  }

  await page.clock.setFixedTime(a_las('06:10'));
  await page.goto(BASE);
  await entrar('daniela.castro@caminos.example');

  // Marca la entrada 50 min antes: se abre la ventana
  await page.click('[data-marcar=entrada]');
  await page.waitForSelector('.modal', { timeout: 4000 }).catch(() => {});
  ok(await page.isVisible('.modal'), 'entrada temprana: al marcar 50 min antes se abre la ventana');
  ok((await page.textContent('.modal h2')).includes('50 min antes'), 'la ventana dice cuántos minutos antes entró');
  ok((await page.textContent('.modal')).includes('15:40'), 'propone salir a las 15:40 (16:30 − 50 min)');
  const opciones = await page.$$eval('.modal select[name=autorizo] option', (o) => o.map((x) => x.textContent));
  ok(opciones.some((t) => t.includes('Carolina')) && !opciones.some((t) => t.includes('Santiago')) && !opciones.some((t) => t.includes('Daniela')), 'solo se elige a la gerencia, dirección o supervisión (ni colaboradores ni ella misma)');

  // «Ahora no» y luego la registra desde el pase
  await page.click('.modal [data-accion=cerrarAjuste]');
  ok(!(await page.$('.modal')), '«Ahora no» cierra la ventana');
  ok((await page.textContent('.pass')).includes('Entraste 50 min antes'), 'el pase recuerda registrar la autorización');
  await page.click('.pass [data-accion=abrirAjuste]');
  await page.fill('.modal textarea[name=motivo]', 'Salida temprana del grupo a Cartagena');
  await page.click('.modal button[type=submit]');
  await page.waitForTimeout(300);
  ok(await page.isVisible('.modal') && await page.evaluate(() => window.SUPABASE_DEMO.db.ajustes_jornada.every((a) => !a.motivo.includes('Cartagena'))), 'sin elegir quién autorizó no se guarda');
  ok((await page.inputValue('.modal textarea[name=motivo]')).includes('Cartagena'), 'el motivo escrito no se pierde');
  await page.selectOption('.modal select[name=autorizo]', { label: 'Carolina Méndez · Dirección de operaciones' });
  await page.click('.modal button[type=submit]');
  ok(await avisa('tu salida de hoy queda a las 15:40'), 'guarda: la salida de hoy queda a las 15:40');
  await esperar();
  const pase = await page.textContent('.pass');
  ok(pase.includes('Horario ajustado hoy') && pase.includes('autorizó Carolina Méndez'), 'el pase muestra el ajuste y quién lo autorizó');
  ok((await page.textContent('.route')).includes('15:40') && (await page.textContent('.route')).includes('ajustada'), 'la salida del pase cambia a 15:40 (ajustada)');

  // Otra hora de salida
  await page.click('.pass [data-accion=abrirAjuste]');
  await page.fill('.modal input[name=salida]', '15:00');
  ok(await page.isChecked('.modal input[name=opcion][value=otra]'), 'al poner otra hora se elige «a otra hora»');
  await page.click('.modal button[type=submit]');
  ok(await avisa('queda a las 15:00'), 'se puede corregir la hora de salida');
  await esperar();

  // Sale a las 15:12: 12 min después de la hora autorizada = tiempo adicional, no «salida antes»
  await page.clock.setFixedTime(a_las('15:12'));
  await page.click('[data-marcar=salida]');
  await esperar();
  const chips = await page.$$eval('.legs .chip', (c) => c.map((x) => x.textContent));
  ok(chips.some((t) => t.includes('+12 min adicionales')) && !chips.some((t) => t.includes('antes') && t.includes('Salió')), `la salida se mide contra la hora autorizada: +12 min adicionales (${chips.join(' | ')})`);
  ok(!(await page.$('.pass [data-accion=abrirAjuste]')), 'después de marcar la salida ya no se cambia el ajuste');

  // La líder lo ve en Asistencia
  await entrar('carolina.mendez@caminos.example');
  await page.click('.tabs [data-view="asistencia"]');
  await esperar();
  const filaDaniela = await page.locator('table.asis tr', { hasText: 'Daniela Castro' }).textContent();
  ok(filaDaniela.includes('Sale 15:00') && filaDaniela.includes('autorizó Carolina'), 'la líder ve en Asistencia la salida ajustada y quién autorizó');

  // Informe: el ejemplo sembrado de Valentina (entró y salió 1 h antes con permiso)
  await entrar('andrea.rojas@caminos.example');
  await page.click('.tabs [data-view="informes"]');
  await esperar();
  await page.selectOption('select[data-inf=rango]', 'd30');
  await esperar();
  await page.waitForSelector('table.rep tbody tr');
  const secAj = await page.locator('section.card', { hasText: 'Horarios ajustados' }).textContent().catch(() => '');
  ok(secAj.includes('Valentina Ruiz') && secAj.includes('Carolina Méndez') && secAj.includes('Inventario'), 'el informe lista los horarios ajustados con quién autorizó');
  const kpis = await page.$$eval('.kpis.six .kpi', (k) => k.map((x) => x.textContent));
  ok(kpis.some((t) => t.includes('Tiempo adicional') && t.includes('después de la salida')), 'indicador de tiempo adicional');
  ok(kpis.some((t) => t.includes('Salidas antes') && /\d+ min en total/.test(t)), 'las salidas antes traen los minutos en total');
  ok((await page.textContent('table.rep thead')).includes('Adicional'), 'la tabla por persona trae la columna Adicional');
  const [desc] = await Promise.all([page.waitForEvent('download'), page.click('[data-accion=exportarDetalle]')]);
  const lineas = fs.readFileSync(await desc.path(), 'utf8').split('\r\n');
  ok(lineas.some((l) => l.startsWith('Fecha;Día;Persona') && l.includes('Tiempo adicional (min)') && l.includes('Horario ajustado')), 'el detalle por día trae tiempo adicional y horario ajustado');
  const filaVal = lineas.find((l) => l.includes('Valentina Ruiz') && l.includes('autorizó Carolina'));
  ok(!!filaVal && filaVal.includes('(autorizado)') && !/Salió \d+ min antes/.test(filaVal), `el día con permiso de Valentina no cuenta como salida antes (${filaVal ? filaVal.split(';').slice(-3).join(' | ') : 'sin fila'})`);
  const otras = lineas.filter((l) => /;Se quedó \d+ min más/.test(l));
  ok(otras.length > 0, `el detalle marca cuánto se quedó cada persona (${otras.length} jornadas con tiempo adicional)`);

  // Celular: la ventana cabe
  await page.setViewportSize({ width: 390, height: 800 });
  await page.clock.setFixedTime(a_las('06:10'));
  await page.goto(BASE);
  await entrar('daniela.castro@caminos.example');
  await page.click('[data-marcar=entrada]');
  await page.waitForSelector('.modal');
  const ancho = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.querySelector('.modal-caja').getBoundingClientRect().right));
  ok(ancho <= 390, `@390: la ventana cabe sin desborde (${Math.round(ancho)})`);
  if (process.env.CAPTURAS) await page.screenshot({ path: process.env.CAPTURAS + '/ajuste-celular.png' });

  ok(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await browser.close();
  console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nTodo OK');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('FALLO inesperado: ' + e.message); process.exit(1); });
