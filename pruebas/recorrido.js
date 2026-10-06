// Recorrido automático de la intranet con el Supabase simulado.
// Uso: servir la carpeta intranet/ (npx http-server -p 8765 .) y luego
//   node pruebas/recorrido.js [carpeta-de-capturas]
// Cualquier error de la página (pageerror) cuenta como fallo.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/pruebas/demo.html';
const OUT = process.argv[2] || 'capturas';
const fs = require('fs');
fs.mkdirSync(OUT, { recursive: true });

const fallos = [];
const ok = (c, msg) => { if (c) console.log('OK    ' + msg); else { console.log('FALLO ' + msg); fallos.push(msg); } };

async function entrar(page, correo, { primerIngreso } = {}) {
  await page.goto(BASE);
  await page.waitForSelector('form[data-form=login]');
  await page.click(`[data-demo="${correo}"]`);
  await page.fill('input[name=clave]', 'clave1234');
  await page.click('form[data-form=login] button[type=submit]');
  if (primerIngreso) {
    await page.waitForSelector('form[data-form=clave]');
    await page.fill('input[name=clave]', 'nueva-clave-2026');
    await page.fill('input[name=clave2]', 'nueva-clave-2026');
    await page.click('form[data-form=clave] button[type=submit]');
    await page.waitForSelector('[data-accion=aceptarDatos]');
    await page.click('[data-accion=aceptarDatos]');
  }
  await page.waitForSelector('header.top');
  await page.waitForSelector('.pass, .hello');
}
const pestañas = (page) => page.$$eval('.tabs button', (bs) => bs.map((b) => b.dataset.view));
async function ir(page, v) {
  await page.click(`.tabs [data-view="${v}"]`);
  await page.waitForFunction(() => !document.querySelector('.cargando'));
  await page.waitForTimeout(120);
}
async function captura(page, nombre) {
  await page.screenshot({ path: `${OUT}/${nombre}.png`, fullPage: true });
}
async function sinDesborde(page, etiqueta) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok(r.sw <= r.cw, `${etiqueta}: sin desborde horizontal (${r.sw} ≤ ${r.cw})`);
}

(async () => {
  const browser = await chromium.launch();
  const cuentas = [
    { correo: 'andrea.rojas@caminos.example', clave: 'gerencia', primerIngreso: true, esperadas: ['inicio', 'malla', 'comunicados', 'asistencia', 'informes', 'solicitudes', 'equipo'] },
    { correo: 'carolina.mendez@caminos.example', clave: 'directora', esperadas: ['inicio', 'malla', 'comunicados', 'asistencia', 'informes', 'solicitudes'] },
    { correo: 'julian.torres@caminos.example', clave: 'supervisor', esperadas: ['inicio', 'malla', 'comunicados', 'solicitudes', 'equipo'] },
    { correo: 'daniela.castro@caminos.example', clave: 'colaboradora', esperadas: ['inicio', 'malla', 'comunicados', 'solicitudes'] },
  ];
  for (const ancho of [1300, 390]) {
    for (const c of cuentas) {
      const page = await browser.newPage({ viewport: { width: ancho, height: ancho > 500 ? 900 : 844 } });
      const errores = [];
      page.on('pageerror', (e) => errores.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errores.push('consola: ' + m.text()); });
      await entrar(page, c.correo, { primerIngreso: c.primerIngreso });
      const tabs = await pestañas(page);
      ok(JSON.stringify(tabs) === JSON.stringify(c.esperadas), `${c.clave} @${ancho}: pestañas ${tabs.join(',')}`);
      for (const v of tabs) {
        await ir(page, v);
        if (v === 'malla' && c.clave !== 'colaboradora') {
          for (const mv of ['semana', 'fijo', 'turnos']) {
            await page.click(`[data-mvista="${mv}"]`);
            await page.waitForTimeout(80);
            await captura(page, `${ancho}-${c.clave}-malla-${mv}`);
            await sinDesborde(page, `${c.clave} @${ancho} malla ${mv}`);
          }
          await page.click('[data-mvista="semana"]');
          continue;
        }
        await captura(page, `${ancho}-${c.clave}-${v}`);
        await sinDesborde(page, `${c.clave} @${ancho} ${v}`);
      }
      await page.click('[data-accion=menu]');
      await page.click('.menu-pop [data-view=guia]');
      await page.waitForSelector('.guia');
      await captura(page, `${ancho}-${c.clave}-guia`);
      await sinDesborde(page, `${c.clave} @${ancho} guía`);
      ok(errores.length === 0, `${c.clave} @${ancho}: sin errores de página ${errores.length ? '→ ' + errores.join(' | ') : ''}`);
      await page.close();
    }
  }
  // Pantalla de acceso
  for (const ancho of [1300, 390]) {
    const page = await browser.newPage({ viewport: { width: ancho, height: 900 } });
    await page.goto(BASE);
    await page.waitForSelector('form[data-form=login]');
    await captura(page, `${ancho}-login`);
    await sinDesborde(page, `login @${ancho}`);
    await page.close();
  }
  await browser.close();
  console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nTodo OK');
  process.exit(fallos.length ? 1 : 0);
})();
