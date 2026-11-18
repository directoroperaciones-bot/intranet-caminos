// Pruebas del portal de clientes (extranet) con el Supabase simulado.
// Uso: servir intranet/ en :8765 y correr  node pruebas/clientes.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/pruebas/clientes-demo.html';

const fallos = [];
const ok = (c, msg) => { if (c) console.log('OK    ' + msg); else { console.log('FALLO ' + msg); fallos.push(msg); } };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));

  // Acceso
  await page.goto(BASE);
  await page.waitForSelector('form[data-form=login]');
  await page.fill('input[name=correo]', 'ricardo.aliado@cliente.example');
  await page.fill('input[name=clave]', 'mala-clave');
  await page.click('form[data-form=login] button[type=submit]');
  await page.waitForSelector('.err');
  ok((await page.textContent('.err')).includes('Correo o contraseña incorrectos'), 'portal: error claro con contraseña mala');

  // Primer ingreso: pide crear la contraseña
  await page.evaluate(() => { window.SUPABASE_DEMO.db.cuentas_cliente.find((c) => c.cliente_id === 'cli-ricardo').debe_cambiar = true; });
  await page.fill('input[name=clave]', 'clave1234');
  await page.click('form[data-form=login] button[type=submit]');
  await page.waitForSelector('form[data-form=clave]');
  ok(true, 'portal: con contraseña temporal pide crear una propia');
  await page.fill('input[name=clave]', 'corta');
  await page.fill('input[name=clave2]', 'corta');
  await page.click('form[data-form=clave] button[type=submit]');
  ok((await page.textContent('.err')).includes('8 caracteres'), 'portal: la contraseña debe tener 8 caracteres');
  await page.fill('input[name=clave]', 'ricardo-2026-nueva');
  await page.fill('input[name=clave2]', 'ricardo-2026-nueva');
  await page.click('form[data-form=clave] button[type=submit]');
  await page.waitForSelector('.cx-kpis');
  ok((await page.textContent('h1')).includes('Ricardo'), 'portal: tras crear la contraseña entra y saluda por el nombre');

  // Lo que ve
  const kpis = await page.$$eval('.cx-kpi', (k) => k.map((x) => x.textContent));
  ok(kpis.length === 5 && kpis.some((t) => t.includes('Tu comisión')), 'portal: indicadores con su comisión (aliado con % configurado)');
  ok(kpis.some((t) => t.includes('Saldo pendiente')), 'portal: muestra el saldo pendiente');
  const nVentas = await page.$$eval('.cx-venta', (v) => v.length);
  ok(nVentas === 7, 'portal: Ricardo ve sus 7 ventas (no las de la parroquia)');
  ok(!(await page.textContent('body')).includes('Las Lajas'), 'portal: no aparece la venta de otro cliente');
  ok(!/costo|utilidad|proveedor/i.test(await page.textContent('main')), 'portal: no muestra costos, utilidad ni proveedores');
  ok(await page.$$eval('.cx-prox-c', (p) => p.length) >= 1, 'portal: muestra los próximos viajes');

  // Detalle de una venta
  await page.locator('.cx-venta-h', { hasText: 'Cancún' }).click();
  const det = await page.textContent('.cx-venta.abierta');
  ok(det.includes('Felipe Ejemplo') && det.includes('Natalia Ejemplo'), 'portal: el detalle muestra los viajeros');
  ok(det.includes('Vuelo') && det.includes('BOG-CUN-BOG'), 'portal: el detalle muestra los servicios');
  ok(det.includes('Saldo pendiente') && det.includes('Tu comisión'), 'portal: el detalle muestra pagos, saldo y comisión');

  // Filtros y búsqueda
  await page.click('[data-filtro=Cancelada]');
  ok(await page.$$eval('.cx-venta', (v) => v.length) === 1, 'portal: filtro de canceladas');
  await page.click('[data-filtro=viajar]');
  ok(await page.$$eval('.cx-venta', (v) => v.length) === 3, 'portal: filtro «Por viajar»');
  await page.click('[data-filtro=todas]');
  await page.fill('[data-busca]', 'natalia');
  ok(await page.$$eval('.cx-venta', (v) => v.length) === 1, 'portal: busca por viajero');
  await page.fill('[data-busca]', '');

  // Cuentas de cobro
  ok(await page.$$eval('.cx-cobros tbody tr', (t) => t.length) === 2, 'portal: ve sus cuentas de cobro');

  // Seguridad: con su sesión no lee nada del equipo ni de otros clientes
  const lect = await page.evaluate(async () => {
    const s = window.supabase.createClient('https://demo.local', 'demo');
    const r = async (t) => ((await s.from(t).select('*')).data || []).length;
    return { perfiles: await r('perfiles'), sedes: await r('sedes'), malla: await r('malla'), ventas_informe: await r('ventas_informe'), ventas: await r('ventas_cliente'), clientes: await r('clientes_ext'), grupos: await r('grupos') };
  });
  ok(lect.perfiles === 0 && lect.sedes === 0 && lect.malla === 0 && lect.grupos === 0, 'portal: una cuenta de cliente no lee datos del equipo');
  ok(lect.ventas_informe === 0, 'portal: no lee los informes de gestión');
  ok(lect.ventas === 7 && lect.clientes === 1, 'portal: solo lee sus ventas y su ficha');

  // Salir
  await page.click('[data-a=salir]');
  await page.waitForSelector('form[data-form=login]');
  ok(true, 'portal: sale');

  // Una cuenta del equipo no entra al portal
  await page.fill('input[name=correo]', 'andrea.rojas@caminos.example');
  await page.fill('input[name=clave]', 'clave1234');
  await page.click('form[data-form=login] button[type=submit]');
  const noCliente = await page.waitForFunction(() => /no es del portal/.test((document.querySelector('.login-card h2') || {}).textContent || ''), null, { timeout: 4000 }).then(() => true).catch(() => false);
  ok(noCliente, 'portal: una cuenta del equipo no ve el portal');

  // Celular sin desborde
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(BASE);
  await page.click('[data-demo]');
  await page.waitForSelector('.cx-kpis');
  const ancho = await page.evaluate(() => { const w = document.documentElement.scrollWidth; const anchos = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > 391).slice(0, 4).map((e) => e.className + ':' + Math.round(e.getBoundingClientRect().right)); return { w, anchos }; });
  ok(ancho.w <= 390, 'portal @390: sin desborde horizontal' + (ancho.w > 390 ? ' ' + JSON.stringify(ancho) : ''));

  ok(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await browser.close();
  console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nTodo OK');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('FALLO inesperado: ' + e.message); process.exit(1); });
