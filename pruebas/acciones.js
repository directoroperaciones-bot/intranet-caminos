// Pruebas de acciones con el Supabase simulado (una sola página: los datos
// viven en memoria, así que se cambia de cuenta saliendo y entrando).
// Uso: servir intranet/ en :8765 y correr  node pruebas/acciones.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/pruebas/demo.html';

const fallos = [];
const ok = (c, msg) => { if (c) console.log('OK    ' + msg); else { console.log('FALLO ' + msg); fallos.push(msg); } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4/58BCBgYGBgYGBgYGAD/DwkBAPpVq+gAAAAASUVORK5CYII=', 'base64');

let page;
(async () => {
  const browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1300, height: 900 }, acceptDownloads: true });
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const esperar = () => page.waitForFunction(() => !document.querySelector('.cargando') && !document.querySelector('[aria-busy="true"]'));
  // Espera un aviso que contenga el texto (los avisos anteriores pueden seguir visibles)
  const avisa = (txt) => page.waitForFunction((t) => { const e = document.querySelector('#toast.show'); return !!e && e.textContent.includes(t); }, txt, { timeout: 5000 }).then(() => true, () => false);
  async function entrar(correo) {
    if (await page.$('header.top')) {
      await page.click('[data-accion=menu]');
      await page.click('.menu-pop [data-accion=salir]');
    } else {
      await page.goto(BASE);
    }
    await page.waitForSelector('form[data-form=login]');
    await page.click(`[data-demo="${correo}"]`); // un toque entra directo
    await page.waitForSelector('header.top, form[data-form=clave], [data-accion=aceptarDatos]');
    if (await page.$('form[data-form=clave]')) {
      await page.fill('input[name=clave]', 'nueva-clave-2026');
      await page.fill('input[name=clave2]', 'nueva-clave-2026');
      await page.click('form[data-form=clave] button[type=submit]');
      await page.waitForSelector('[data-accion=aceptarDatos]');
    }
    if (await page.$('[data-accion=aceptarDatos]')) await page.click('[data-accion=aceptarDatos]');
    await page.waitForSelector('header.top');
    await esperar();
  }
  async function ir(v) { await page.click(`.tabs [data-view="${v}"]`); await esperar(); }

  // ---------- Acceso ----------
  await page.goto(BASE);
  await page.waitForSelector('form[data-form=login]');
  await page.fill('input[name=correo]', 'daniela.castro@caminos.example');
  await page.fill('input[name=clave]', 'mala');
  await page.click('form[data-form=login] button[type=submit]');
  await page.waitForSelector('.err');
  ok((await page.textContent('.err')).includes('Correo o contraseña incorrectos'), 'login: error traducido');
  ok((await page.inputValue('input[name=correo]')) === 'daniela.castro@caminos.example', 'login: conserva el correo tras el error');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.name === 'clave'), 'login: enfoca la contraseña');
  await page.fill('input[name=correo]', 'laura.gomez@caminos.example');
  await page.fill('input[name=clave]', 'clave1234');
  await page.click('form[data-form=login] button[type=submit]');
  await page.waitForFunction(() => /desactivada/.test((document.querySelector('.err') || {}).textContent || ''));
  ok(true, 'login: cuenta desactivada avisa');

  // ---------- Colaboradora: marcar, confirmar comunicado, pedir permiso ----------
  await entrar('daniela.castro@caminos.example');
  ok(await page.isVisible('.alerta'), 'inicio: franja de comunicados pendientes');
  ok((await page.textContent('.mark-btn')).includes('Marcar entrada'), 'pase: el botón ofrece marcar la entrada');
  await page.click('.mark-btn');
  ok(await avisa('Entrada marcada'), 'pase: aviso al marcar');
  await esperar();
  ok(await page.$eval('.legs .leg', (l) => l.classList.contains('done')), 'pase: la entrada queda marcada');
  ok((await page.textContent('.mark-btn')).includes('Salir a almorzar'), 'pase: el siguiente paso es el almuerzo');
  ok(await page.isVisible('.legs .leg .chip'), 'pase: etiqueta de la entrada (a tiempo o tarde)');
  await page.click('[data-marcar=salida_almuerzo].mark-btn');
  await esperar();
  ok((await page.textContent('.mark-btn')).includes('Marcar regreso'), 'pase: luego el regreso');

  await ir('comunicados');
  const badgeAntes = await page.$('.tabs [data-view=comunicados] .badge');
  ok(!!badgeAntes, 'comunicados: insignia roja con pendientes');
  await page.click('[data-leer]');
  await page.waitForFunction(() => !document.querySelector('[data-leer]'));
  ok(!(await page.$('.tabs [data-view=comunicados] .badge')), 'comunicados: confirmar quita la insignia');
  await page.fill('[data-buscar=com]', 'sabado');
  await page.waitForTimeout(50);
  ok((await page.$$('#lista-com .note')).length === 1 && !!(await page.$('#lista-com mark')), 'comunicados: el buscador ignora tildes y resalta');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.dataset.buscar === 'com'), 'comunicados: el buscador no pierde el foco');

  await ir('solicitudes');
  await page.click('[data-soltipo=permiso]');
  const fecha = await page.evaluate(() => { const d = new Date(Date.now() + 9 * 864e5); return d.toISOString().slice(0, 10); });
  await page.fill('form[data-form=sol] input[name=desde]', fecha);
  await page.fill('form[data-form=sol] input[name=hasta]', fecha);
  await page.fill('form[data-form=sol] input[name=hora_desde]', '15:00');
  await page.fill('form[data-form=sol] input[name=hora_hasta]', '17:00');
  await page.fill('form[data-form=sol] textarea[name=motivo]', 'Cita odontológica');
  await page.setInputFiles('[data-archivos=sol]', { name: 'orden.png', mimeType: 'image/png', buffer: PNG });
  await page.click('form[data-form=sol] button[type=submit]');
  ok(await avisa('Solicitud enviada'), 'solicitudes: se envía un permiso por horas con soporte');
  await esperar();
  ok((await page.textContent('.grid-sol')).includes('15:00–17:00'), 'solicitudes: aparece en «Mis solicitudes» con sus horas');

  // ---------- Supervisor: aprobar, malla, turnos, cuentas ----------
  await entrar('julian.torres@caminos.example');
  await ir('solicitudes');
  const porAprobar = await page.$$eval('.sol-sec', (s) => s[0].textContent);
  ok(porAprobar.includes('Daniela Castro') && porAprobar.includes('Valentina Ruiz'), 'revisor: ve los permisos y vacaciones por aprobar');
  await page.click('[data-lbsol]');
  ok(await page.isVisible('.lightbox'), 'revisor: abre el soporte en el visor');
  await page.keyboard.press('Escape');
  ok(!(await page.$('.lightbox')), 'visor: se cierra con Escape');
  const idDaniela = await page.$$eval('[data-revisar]', (bs) => { const b = bs.find((x) => x.closest('.sol').textContent.includes('Daniela') && x.closest('.sol').textContent.includes('15:00')); return b.dataset.revisar.split('|')[0]; });
  await page.fill(`[data-coment="${idDaniela}"]`, 'Que te vaya bien');
  await page.click(`[data-revisar="${idDaniela}|1"]`);
  ok(await avisa('aprobada'), 'revisor: aprueba con comentario');
  await esperar();

  await ir('malla');
  const celdas = await page.$$('button.celda');
  ok(celdas.length >= 7 * 6, `malla: el supervisor tiene ${celdas.length} celdas editables`);
  await page.click('button.celda[data-editar*="a0000000-0000-4000-8000-000000000006"]');
  await page.waitForSelector('select.shift');
  ok(await page.evaluate(() => document.activeElement.matches('select.shift')), 'malla: la celda se vuelve selector con foco');
  // El primer Escape puede cerrar la lista desplegable; el siguiente devuelve la celda a chip
  await page.keyboard.press('Escape');
  if (await page.$('select.shift')) await page.keyboard.press('Escape');
  ok(!(await page.$('select.shift')), 'malla: Escape la devuelve a chip');
  const id = await page.getAttribute('button.celda[data-editar*="a0000000-0000-4000-8000-000000000006"]', 'data-editar');
  await page.click(`button.celda[data-editar="${id}"]`);
  await page.selectOption('select.shift', { label: '8:00–17:30 · Turno 3 · alm 13:00' });
  await esperar();
  await page.waitForSelector(`button.celda.cambio[data-editar="${id}"]`);
  ok(true, 'malla: elegir un turno crea un cambio puntual con borde');
  await page.click(`button.celda[data-editar="${id}"]`);
  ok((await page.$$eval('select.shift option', (os) => os[0].textContent)).includes('Volver al horario fijo'), 'malla: primera opción «Volver al horario fijo»');
  await page.selectOption('select.shift', '__base');
  await esperar();
  await page.waitForFunction((i) => { const b = document.querySelector(`button.celda[data-editar="${i}"]`); return b && !b.classList.contains('cambio'); }, id);
  ok(true, 'malla: volver al horario fijo borra el cambio');
  await page.click('[data-mvista=turnos]');
  const antes = (await page.$$('table.turnos tbody tr')).length;
  await page.click('[data-accion=agregarTurno]');
  await esperar();
  const nombres5 = await page.$$eval('table.turnos input[data-turno$="|nombre"]', (is) => is.map((i) => i.value));
  ok((await page.$$('table.turnos tbody tr')).length === antes + 1 && nombres5.includes('Turno 5'), 'turnos: «Agregar turno» crea Turno 5');
  const nombreTurno = await page.$('input[data-turno$="|nombre"][value="Turno 5"]');
  await nombreTurno.fill('Turno tarde');
  await page.keyboard.press('Tab');
  ok(await avisa('Turno guardado'), 'turnos: el nombre se guarda al salir del campo');

  await ir('equipo');
  const roles = await page.$$eval('form[data-form=cuenta] select[name=rol] option', (os) => os.map((o) => o.value));
  ok(JSON.stringify(roles) === '["colaborador"]', 'equipo: el supervisor solo crea colaboradores');
  await page.fill('form[data-form=cuenta] input[name=nombre]', 'Mariana Prueba');
  await page.fill('form[data-form=cuenta] input[name=correo]', 'mariana.prueba@caminos.example');
  await page.selectOption('form[data-form=cuenta] select[name=area_id]', { label: 'Ventas' });
  await page.click('form[data-form=cuenta] button[type=submit]');
  await page.waitForSelector('.clave');
  const clave = (await page.textContent('.clave dd.mono')).trim();
  ok(/^[A-HJ-NP-Za-km-np-z2-9]{10}$/.test(clave), `equipo: contraseña temporal de 10 caracteres sin confusos (${clave})`);
  const fila = await page.$$eval('#lista-equipo tr', (trs) => trs.map((t) => t.textContent));
  ok(fila.some((t) => t.includes('Carolina') && t.includes('Solo administración')), 'equipo: el supervisor no toca directoras');
  ok(fila.some((t) => t.includes('Julián') && t.includes('Tu cuenta')), 'equipo: su propia cuenta queda bloqueada');
  const tabla = await page.$eval('.tablewrap', (w) => ({ sw: w.scrollWidth, cw: w.clientWidth }));
  ok(tabla.sw <= tabla.cw, `equipo: la tabla cabe sin desbordarse (${tabla.sw} ≤ ${tabla.cw})`);
  await page.click('[data-accion=cerrarClave]');

  // ---------- Nueva cuenta: primer ingreso ----------
  await page.click('[data-accion=menu]');
  await page.click('.menu-pop [data-accion=salir]');
  await page.waitForSelector('form[data-form=login]');
  await page.fill('input[name=correo]', 'mariana.prueba@caminos.example');
  await page.fill('input[name=clave]', clave);
  await page.click('form[data-form=login] button[type=submit]');
  await page.waitForSelector('form[data-form=clave]');
  await page.fill('input[name=clave]', 'corta');
  await page.fill('input[name=clave2]', 'corta');
  await page.click('form[data-form=clave] button[type=submit]');
  ok((await page.textContent('.err')).includes('8 caracteres'), 'primer ingreso: exige 8 caracteres');
  await page.fill('input[name=clave]', 'mariana-2026');
  await page.fill('input[name=clave2]', 'mariana-2026');
  await page.click('form[data-form=clave] button[type=submit]');
  await page.waitForSelector('[data-accion=aceptarDatos]');
  await page.click('[data-accion=aceptarDatos]');
  await page.waitForSelector('.pass');
  ok((await page.textContent('.pass')).includes('No tienes turno asignado hoy'), 'primer ingreso: sin horario fijo, «Puedes marcar igual»');

  // ---------- Directora: publicar comunicado con imagen ----------
  await entrar('carolina.mendez@caminos.example');
  await ir('comunicados');
  await page.fill('form[data-form=com] input[name=titulo]', 'Capacitación del jueves');
  await page.fill('form[data-form=com] textarea[name=cuerpo]', 'Nos vemos a las 3:00 p. m.\nTraigan sus dudas del Gestor de reservas.');
  await page.selectOption('form[data-form=com] select[name=destino]', { label: 'Área: Ventas' });
  ok((await page.textContent('form[data-form=com]')).includes('Lo recibirán 4 personas'), 'publicar: cuenta destinatarios del área');
  await page.setInputFiles('[data-archivos=com]', { name: 'agenda.png', mimeType: 'image/png', buffer: PNG });
  ok((await page.$$('.compose .thumb.prev')).length === 1, 'publicar: vista previa de la imagen');
  await page.click('form[data-form=com] button[type=submit]');
  ok(await avisa('Comunicado publicado'), 'publicar: aviso de publicado');
  await esperar();
  const nota = await page.$('.note:has-text("Capacitación del jueves")');
  ok(!!nota && (await nota.textContent()).includes('Confirmado por 0 de 4'), 'publicar: seguimiento de confirmación');
  await (await nota.$('.thumb')).click();
  ok(await page.isVisible('.lightbox img'), 'publicar: la miniatura abre el visor');
  await page.keyboard.press('Escape');
  await page.click('.note:has-text("Capacitación del jueves") [data-comf^="borrar:"]');
  ok(await page.isVisible('.note:has-text("Capacitación del jueves") .confirmar'), 'eliminar: pide confirmación en la página');
  await page.click('.note:has-text("Capacitación del jueves") [data-comf=cancelar]');

  await ir('asistencia');
  ok((await page.$$('.kpis.four .kpi')).length === 4, 'asistencia: 4 indicadores');

  // ---------- Gerencia: informes, módulo, cuentas ----------
  await entrar('andrea.rojas@caminos.example'); // arranca con primer ingreso: entrar() completa clave y datos
  await ir('informes');
  const meses = await page.$$eval('select[data-inf=mes] option', (os) => os.map((o) => o.value));
  await page.selectOption('select[data-inf=mes]', meses[1]);
  await esperar();
  await page.waitForSelector('table.rep tbody tr');
  const filas = (await page.$$('table.rep tbody tr')).length;
  ok(filas >= 6, `informes: ${filas} personas en el mes anterior`);
  const punt = await page.textContent('.kpi.hero b');
  ok(/\d+,\d %/.test(punt), `informes: puntualidad con un decimal (${punt})`);
  const minTarde = await page.$$eval('table.rep tbody tr', (trs) => trs.reduce((a, t) => a + +t.children[3].textContent, 0));
  const kpiTarde = await page.$$eval('.kpis.six .kpi small', (s) => s[1].textContent);
  ok(kpiTarde.startsWith(minTarde + ' min'), `informes: los minutos tarde de la tabla suman el indicador (${minTarde})`);
  // Cálculo manual independiente, directo de los datos sembrados
  const manual = await page.evaluate((mes) => {
    const db = window.SUPABASE_DEMO.db;
    const toMin = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
    const dow = (f) => { const g = new Date(f + 'T12:00:00Z').getUTCDay(); return g || 7; };
    const inicio = db.configuracion.find((c) => c.clave === 'inicio_horarios').valor.fecha;
    const dias = new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).getUTCDate();
    let jornadas = 0, tardes = 0, min = 0, sinMarcar = 0;
    for (const p of db.perfiles) {
      for (let d = 1; d <= dias; d++) {
        const f = `${mes}-${String(d).padStart(2, '0')}`;
        if (f < inicio) continue;
        const cambio = db.malla.find((m) => m.persona_id === p.id && m.fecha === f);
        let tid;
        if (cambio) tid = cambio.turno_id;
        else {
          const base = db.horario_base.filter((h) => h.persona_id === p.id);
          if (!p.activo || !base.length) continue;
          const hb = base.find((h) => h.dia === dow(f));
          tid = hb ? hb.turno_id : 6;
        }
        const t = db.turnos.find((x) => x.id === tid);
        if (!t.entrada) continue;
        if (db.solicitudes.some((s) => s.persona_id === p.id && s.estado === 'aprobada' && !s.hora_desde && s.desde <= f && s.hasta >= f)) continue;
        const e = db.marcas.find((m) => m.persona_id === p.id && m.fecha === f && m.tipo === 'entrada');
        if (!e) { sinMarcar++; continue; }
        jornadas++;
        const local = Math.floor((new Date(e.hora).getTime() / 60000 - 300) % 1440 + 1440) % 1440; // Bogotá UTC−5
        const tarde = local - toMin(t.entrada);
        if (tarde > 5) { tardes++; min += tarde; }
      }
    }
    return { jornadas, tardes, min, sinMarcar, punt: ((jornadas - tardes) / jornadas * 100).toFixed(1).replace('.', ',') + ' %' };
  }, meses[1]);
  const kpis = await page.$$eval('.kpis.six .kpi', (ks) => ks.map((k) => k.querySelector('b').textContent.trim()));
  ok(punt === manual.punt && kpis[1] === String(manual.tardes) && kpis[4] === String(manual.sinMarcar) && minTarde === manual.min,
    `informes: cuadra con el cálculo manual (${manual.jornadas} jornadas, ${manual.tardes} tardes, ${manual.min} min, ${manual.sinMarcar} sin marcar, ${manual.punt})`);
  await page.click('[data-orden=nombre]');
  const nombres = await page.$$eval('table.rep tbody th', (t) => t.map((x) => x.textContent.trim()));
  ok(JSON.stringify(nombres) === JSON.stringify(nombres.slice().sort((a, b) => a.localeCompare(b, 'es'))), 'informes: ordena por persona');
  await page.click('table.rep tbody th .enlace');
  ok(await page.isVisible('.detail'), 'informes: detalle por persona');
  await page.hover('.chartbox rect.hit >> nth=3');
  ok(await page.isVisible('#tip'), 'informes: tooltip de la gráfica');
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('[data-accion=exportar]')]);
  const ruta = await descarga.path();
  const csv = require('fs').readFileSync(ruta, 'utf8');
  ok(csv.charCodeAt(0) === 0xFEFF && csv.includes('Persona;Correo;Sede;Área;Jornadas') && csv.includes('\r\n'), `informes: CSV con BOM, «;» y \\r\\n (${descarga.suggestedFilename()})`);

  await ir('solicitudes');
  await page.click('[data-accion=moduloSol]');
  await esperar();
  ok((await page.textContent('.modcard')).includes('Apagado'), 'gerencia: apaga el módulo de solicitudes');
  await page.click('[data-accion=moduloSol]');
  await esperar();

  await ir('equipo');
  await page.click('[data-activar$="|desactivar"] >> nth=0');
  await page.click('[data-confirmar=si]');
  ok(await avisa('desactivada'), 'administración: desactiva una cuenta con confirmación');

  ok(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await browser.close();
  console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nTodo OK');
  process.exit(fallos.length ? 1 : 0);
})().catch(async (e) => {
  console.error('FALLO inesperado:', e.message.split('\n')[0]);
  if (page) {
    const estado = await page.evaluate(() => ({ html: (document.getElementById('app') || {}).innerHTML.slice(0, 300), hash: location.hash })).catch(() => null);
    console.error('Estado de la página:', JSON.stringify(estado));
    await page.screenshot({ path: 'fallo.png', fullPage: true }).catch(() => {});
  }
  process.exit(1);
});
