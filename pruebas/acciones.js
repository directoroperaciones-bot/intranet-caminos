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
  // Las pruebas asumen un día hábil con almuerzo: se fija el miércoles de esta semana a las 10:30 de Bogotá
  const miercoles = new Date();
  miercoles.setUTCDate(miercoles.getUTCDate() - ((miercoles.getUTCDay() + 6) % 7) + 2);
  miercoles.setUTCHours(15, 30, 0, 0);
  await page.clock.install({ time: miercoles });
  await page.clock.resume();
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

  // ---------- Recuperar contraseña ----------
  await page.goto(BASE);
  await page.waitForSelector('form[data-form=login]');
  await page.fill('input[name=correo]', 'felipe.moreno@caminos.example');
  await page.click('[data-accion=olvido]');
  await page.waitForSelector('form[data-form=olvido]');
  ok((await page.inputValue('input[name=correo]')) === 'felipe.moreno@caminos.example', 'recuperar: «¿Olvidaste tu contraseña?» abre el formulario con el correo escrito');
  await page.fill('input[name=correo]', 'nadie');
  await page.click('form[data-form=olvido] button[type=submit]');
  await page.waitForSelector('.err');
  ok((await page.textContent('.err')).includes('correo corporativo completo'), 'recuperar: valida el correo');
  await page.fill('input[name=correo]', 'no.existe@caminos.example');
  await page.click('form[data-form=olvido] button[type=submit]');
  await page.waitForFunction(() => /Revisa tu correo/.test(document.querySelector('.login-card').textContent));
  ok(true, 'recuperar: un correo sin cuenta recibe la misma respuesta (no revela quién existe)');
  await page.click('[data-accion=volverLogin]');
  await page.click('[data-accion=olvido]');
  await page.fill('input[name=correo]', 'no.existe@caminos.example');
  await page.click('form[data-form=olvido] button[type=submit]');
  await page.waitForSelector('.err');
  ok((await page.textContent('.err')).includes('Espera un minuto'), 'recuperar: no deja pedir otro enlace antes de un minuto');
  await page.fill('input[name=correo]', 'felipe.moreno@caminos.example');
  await page.click('form[data-form=olvido] button[type=submit]');
  await page.waitForSelector('[data-accion=abrirEnlaceDemo]');
  await page.click('[data-accion=abrirEnlaceDemo]');
  await page.waitForSelector('form[data-form=clave]');
  ok((await page.textContent('.login-card')).includes('Crea una contraseña nueva'), 'recuperar: el enlace del correo abre «Crea una contraseña nueva»');
  await page.fill('input[name=clave]', 'recuperada-2026');
  await page.fill('input[name=clave2]', 'recuperada-2026');
  await page.click('form[data-form=clave] button[type=submit]');
  await page.waitForSelector('header.top, [data-accion=aceptarDatos]');
  ok(await avisa('contraseña nueva'), 'recuperar: guarda la contraseña nueva y entra');
  if (await page.$('[data-accion=aceptarDatos]')) await page.click('[data-accion=aceptarDatos]');
  await page.waitForSelector('header.top');
  await page.click('[data-accion=menu]');
  await page.click('.menu-pop [data-accion=salir]');
  await page.waitForSelector('form[data-form=login]');
  await page.waitForTimeout(400); // salir vuelve a pintar la entrada al terminar
  await page.fill('input[name=correo]', 'felipe.moreno@caminos.example');
  await page.fill('input[name=clave]', 'recuperada-2026');
  await page.click('form[data-form=login] button[type=submit]');
  await page.waitForSelector('header.top');
  ok(true, 'recuperar: después entra con la contraseña nueva');
  await esperar();
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

  // ---------- Oficina: marcar solo desde la oficina ----------
  const LLAVE = 'caminos-intranet-equipo';
  await ir('oficina');
  ok((await page.textContent('.ofi-ip')).includes('190.25.14.7'), 'oficina: muestra la IP de la conexión');
  ok(await page.isDisabled('[data-accion=validarIp]'), 'oficina: el control de red no se activa sin IP registrada');
  await page.click('[data-accion=ipAgregar]');
  ok(await avisa('IP de la oficina registrada'), 'oficina: registra la IP de la oficina con un toque');
  await page.click('[data-accion=validarIp]');
  await esperar();
  ok((await page.getAttribute('[data-accion=validarIp]', 'aria-checked')) === 'true', 'oficina: activa «solo desde la red de la oficina»');
  ok(await page.isDisabled('[data-accion=validarEquipo]'), 'oficina: el control de computadores no se activa sin computadores');
  await page.click('[data-accion=autorizarEquipo]');
  ok(await avisa('Escribe un nombre'), 'oficina: pide nombre para el computador');
  await page.fill('#ofi-nombre', 'Recepción');
  await page.click('[data-accion=autorizarEquipo]');
  ok(await avisa('«Recepción» puede marcar'), 'oficina: autoriza este computador');
  ok((await page.textContent('#contenido')).includes('Este computador está autorizado como Recepción'), 'oficina: reconoce el computador autorizado');
  ok(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).llave.length === 64, LLAVE), 'oficina: el navegador guarda la llave');
  await page.click('[data-accion=validarEquipo]');
  await esperar();
  ok((await page.getAttribute('[data-accion=validarEquipo]', 'aria-checked')) === 'true', 'oficina: activa «solo desde computadores autorizados»');

  await entrar('daniela.castro@caminos.example');
  ok((await page.textContent('.pass-pie')).includes('computadores autorizados'), 'pase: avisa que solo se marca desde computadores autorizados');
  await page.evaluate((k) => { window.__llave = localStorage.getItem(k); localStorage.removeItem(k); }, LLAVE);
  await ir('malla'); await ir('inicio');
  ok((await page.textContent('.pass')).includes('Este equipo no está autorizado para marcar') && !(await page.$('.mark-btn')), 'pase: sin la llave (celular u otro equipo) no deja marcar');
  await page.evaluate((k) => localStorage.setItem(k, window.__llave), LLAVE);
  await ir('malla'); await ir('inicio');
  await page.click('.mark-btn');
  ok(await avisa('marcada a las'), 'pase: desde el computador autorizado y la red de la oficina sí marca');

  await entrar('andrea.rojas@caminos.example');
  await ir('oficina');
  ok((await page.textContent('table.perm')).includes('Aún no marca') === false, 'oficina: muestra la última marca del computador');
  await page.click('[data-accion=quitarEquipo]');
  await page.click('[data-accion=quitarEquipoSi]');
  ok(await avisa('Apaga el control 2'), 'oficina: no deja quitar el último computador con el control activo');
  await page.click('[data-accion=validarEquipo]');
  await esperar();
  await page.click('[data-accion=quitarEquipo]');
  await page.click('[data-accion=quitarEquipoSi]');
  ok(await avisa('Computador quitado'), 'oficina: quita un computador con confirmación');
  ok(await page.evaluate((k) => localStorage.getItem(k) === null, LLAVE), 'oficina: quitar este computador borra su llave');
  await page.click('[data-accion=ipQuitar]');
  ok(await avisa('Apaga el control 1'), 'oficina: no deja quitar la última IP con el control activo');
  await page.click('[data-accion=validarIp]');
  await esperar();
  await page.click('[data-accion=ipQuitar]');
  ok(await avisa('IP quitada'), 'oficina: quita la IP');

  {
  // ---------- Tarjeta: conciliación de la tarjeta de crédito ----------
  await ir('tarjeta');
  // Paso 1: gastos y soportes
  ok((await page.textContent('.tc-paso.on')).includes('Gastos y soportes'), 'tarjeta: abre en el paso 1, gastos y soportes');
  const kpiG = (f) => page.textContent(`.kpi[data-tcfiltrog="${f}"] .kpi-v`);
  const sinSopAntes = Number((await kpiG('sin_soporte')).trim());
  await page.click('form[data-form=tcGasto] button[type=submit]');
  ok(await avisa('Escribe el valor'), 'gastos: pide el valor');
  await page.setInputFiles('input[data-tcregarchivo]', { name: 'factura-almuerzo.png', mimeType: 'image/png', buffer: PNG });
  ok((await page.textContent('.tc-drop')).includes('factura-almuerzo.png') && !!(await page.$('.tc-drop img')), 'gastos: muestra la factura elegida');
  await page.fill('form[data-form=tcGasto] input[name=valor]', '150.000');
  await page.fill('form[data-form=tcGasto] input[name=descripcion]', 'Almuerzo con clientes de la empresa Andina');
  await page.selectOption('form[data-form=tcGasto] select[name=categoria_id]', { label: 'Atención a clientes' });
  await page.click('form[data-form=tcGasto] button[type=submit]');
  ok(await avisa('con su soporte'), 'gastos: guarda el gasto con su factura');
  await esperar();
  const filaG = page.locator('.tc-sec tbody tr', { hasText: 'clientes de la empresa Andina' });
  ok((await filaG.textContent()).includes('150.000') && (await filaG.locator('.tc-sop a').count()) === 1 && (await filaG.textContent()).includes('Esperando el extracto'), 'gastos: aparece en la lista con su soporte, esperando el extracto');
  ok(!(await page.$('.tc-drop img')) && (await page.inputValue('form[data-form=tcGasto] input[name=valor]')) === '', 'gastos: el formulario queda listo para el siguiente');
  await page.fill('form[data-form=tcGasto] input[name=valor]', '45000');
  await page.fill('form[data-form=tcGasto] input[name=descripcion]', 'Taxi aeropuerto');
  await page.click('form[data-form=tcGasto] button[type=submit]');
  ok(await avisa('Falta el soporte'), 'gastos: sin factura avisa que falta el soporte');
  await esperar();
  ok(Number((await kpiG('sin_soporte')).trim()) === sinSopAntes + 1, 'gastos: el indicador «Sin soporte» suma uno');
  await page.click('.kpi[data-tcfiltrog="sin_soporte"]');
  ok((await page.textContent('.tc-sec tbody')).includes('Taxi aeropuerto') && !(await page.textContent('.tc-sec tbody')).includes('empresa Andina'), 'gastos: el indicador filtra la lista');
  await page.locator('.tc-sec tbody tr', { hasText: 'Taxi aeropuerto' }).locator('input[data-tcsop]').setInputFiles({ name: 'taxi.png', mimeType: 'image/png', buffer: PNG });
  ok(await avisa('Soporte adjuntado'), 'gastos: adjunta la factura después');
  await esperar();
  ok(Number((await kpiG('sin_soporte')).trim()) === sinSopAntes, 'gastos: con la factura sale de «Sin soporte»');
  await page.click('.kpi[data-tcfiltrog="todos"]');

  // Paso 2: conciliar con el extracto
  await page.click('[data-tcpaso=conciliar]');
  await page.waitForSelector('.kpi[data-tcfiltro="todos"]');
  const kpi = (f) => page.textContent(`.kpi[data-tcfiltro="${f}"] .kpi-v`);
  const filaTc = (txt) => page.locator('#lista-tc tr', { hasText: txt });
  ok((await kpi('todos')).trim() === '14 %', 'tarjeta: indicador de avance (2 de 14 revisados)');
  await page.waitForSelector('#tc-vivo.on');
  ok(true, 'tarjeta: conexión en vivo activa');
  ok((await page.textContent('.kpi[data-tcfiltro="cuadre"]')).includes('Cuadra'), 'tarjeta: el saldo cuadra con el extracto');
  await filaTc('AVIANCA BOGOTA').locator('[data-accion=tcConciliar]').click();
  ok(await avisa('Conciliado con el registro'), 'tarjeta: concilia con el registro sugerido (toma su categoría)');
  await esperar();
  ok((await kpi('todos')).trim() === '21 %', 'tarjeta: el avance sube al instante');
  await filaTc('FACEBK').locator('[data-accion=tcConciliar]').click();
  ok(await avisa('Elige la categoría'), 'tarjeta: sin categoría no concilia');
  await filaTc('FACEBK').locator('select[data-tccampo$=":categoria_id"]').selectOption({ label: 'Publicidad y marketing' });
  await esperar();
  await filaTc('FACEBK').locator('[data-accion=tcConciliar]').click();
  ok(await avisa('Conciliado.'), 'tarjeta: con categoría, concilia');
  await esperar();
  await page.click('[data-accion=tcSugeridos]');
  ok(await avisa('movimientos conciliados'), 'tarjeta: «Conciliar sugeridos» concilia en bloque');
  await esperar();
  await filaTc('ALIEXPRESS').locator('[data-estado=no_reconocido]').click();
  ok(await avisa('no reconocido'), 'tarjeta: marca un cargo como no reconocido');
  await esperar();
  ok((await kpi('no_reconocidos')).replace(/\s/g, ' ').includes('1.250.000'), 'tarjeta: el indicador de no reconocidos suma el cargo');
  await page.click('.kpi[data-tcfiltro="sin_soporte"]');
  const sinSop = await page.$$('#lista-tc tr');
  ok(sinSop.length >= 1 && !(await page.textContent('#lista-tc')).includes('PAGO SUCURSAL'), `tarjeta: el indicador «Sin soporte» filtra la tabla (${sinSop.length})`);
  await page.locator('#lista-tc tr').first().locator('input[data-tcsop]').setInputFiles({ name: 'factura.png', mimeType: 'image/png', buffer: PNG });
  ok(await avisa('Soporte adjuntado'), 'tarjeta: adjunta la factura a un cargo');
  await esperar();
  ok((await page.$$('#lista-tc tr')).length === sinSop.length - 1, 'tarjeta: con factura sale de «Sin soporte»');
  await page.click('.kpi[data-tcfiltro="todos"]');

  // Importar filas pegadas desde Excel (una repetida, una con formato colombiano y un abono)
  await page.click('[data-accion=tcAbrir][data-panel=importar]');
  const desdeTc = await page.evaluate(() => document.querySelector('[data-tcsel=extracto] option:checked').textContent);
  ok(!!desdeTc, 'tarjeta: abre el panel de importación');
  const filaRep = await filaTc('LATAM AIRLINES').locator('td.tc-f').textContent();
  const meses = { ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06', jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12' };
  const [dRep, mRep] = filaRep.trim().split(' ');
  const anio = desdeTc.trim().slice(-4);
  const fechaRep = `${dRep.padStart(2, '0')}/${meses[mRep]}/${anio}`;
  await page.fill('textarea[data-tcimport]', `Fecha\tDescripción\tValor\n${fechaRep}\tLATAM AIRLINES CO\t1.320.400\n${fechaRep}\tHOTEL DECAMERON\t$ 2.480.000,00\n${fechaRep}\tABONO PSE\t500.000\ntotal\t\t`);
  await page.click('[data-accion=tcAnalizar]');
  await page.waitForSelector('.tc-cuenta');
  const cuenta = await page.textContent('.tc-cuenta');
  ok(cuenta.includes('2 movimientos listos') && cuenta.includes('1 repetido'), `tarjeta: reconoce columnas, formato de pesos y repetidos (${cuenta.replace(/\s+/g, ' ').trim()})`);
  await page.click('[data-accion=tcImportarSi]');
  ok(await avisa('2 movimientos importados'), 'tarjeta: importa los movimientos nuevos');
  await esperar();
  ok((await filaTc('ABONO PSE').textContent()).includes('−'), 'tarjeta: el abono queda como pago (negativo)');
  ok((await filaTc('HOTEL DECAMERON').textContent()).includes('2.480.000'), 'tarjeta: lee «$ 2.480.000,00» como dos millones cuatrocientos ochenta mil');

  // Subir en el paso 1 el gasto que corresponde al cargo importado
  await page.click('[data-tcpaso=gastos]');
  await page.fill('form[data-form=tcGasto] input[name=fecha]', `${anio}-${meses[mRep]}-${dRep.padStart(2, '0')}`);
  await page.fill('form[data-form=tcGasto] input[name=descripcion]', 'Hotel Cartagena · grupo de prueba');
  await page.fill('form[data-form=tcGasto] input[name=valor]', '2.480.000');
  await page.selectOption('form[data-form=tcGasto] select[name=categoria_id]', { label: 'Hoteles y alojamiento' });
  await page.click('form[data-form=tcGasto] button[type=submit]');
  ok(await avisa('coincide con un cargo'), 'tarjeta: el gasto subido coincide con el cargo del extracto');
  await esperar();
  ok((await page.$eval('select[data-tcmes]', (s) => s.value)) === `${anio}-${meses[mRep]}`, 'gastos: la lista salta al mes del gasto guardado');
  await page.click('[data-tcpaso=conciliar]');
  await esperar();
  ok((await filaTc('HOTEL DECAMERON').textContent()).includes('Coincide con'), 'tarjeta: el cargo muestra la sugerencia');

  // Cerrar
  ok(await page.isDisabled('[data-accion=tcCerrar]'), 'tarjeta: no se cierra con pendientes');
  for (let i = 0; i < 30 && await page.$('#lista-tc [data-accion=tcConciliar]'); i++) {
    const f = page.locator('#lista-tc tr', { has: page.locator('[data-accion=tcConciliar]') }).first();
    const sel = f.locator('select[data-tccampo$=":categoria_id"]');
    if (await sel.count() && !(await sel.inputValue())) { await sel.selectOption({ label: 'Otros' }); await esperar(); }
    await f.locator('[data-accion=tcConciliar]').click();
    await esperar();
  }
  ok((await kpi('todos')).trim() === '100 %', 'tarjeta: todo revisado, avance 100 %');
  await page.click('[data-accion=tcCerrar]');
  ok((await page.textContent('.tc-acc')).includes('no cuadra'), 'tarjeta: al cerrar avisa que el saldo no cuadra (entraron movimientos nuevos)');
  await page.click('[data-accion=tcCerrarSi]');
  ok(await avisa('Conciliación cerrada'), 'tarjeta: cierra la conciliación');
  await esperar();
  ok((await page.textContent('.tc-extracto')).includes('Cerrada') && !(await page.$('[data-accion=tcConciliar]')) && !(await page.$('select[data-tccampo]:not([disabled])')), 'tarjeta: cerrada, nada se edita');
  await page.click('[data-tcpest=resumen]');
  ok((await page.$$('.tc-bar')).length >= 4, 'tarjeta: resumen de gasto por categoría y por grupo');
  await page.click('[data-tcpest=agencia]');
  ok((await page.textContent('.tc-sec')).includes('Sin cargo en el extracto'), 'tarjeta: los registros sin cargo se señalan (seguro en tránsito)');
  await page.click('[data-tcpest=banco]');
  const [dTc] = await Promise.all([page.waitForEvent('download'), page.click('[data-accion=tcExportar]')]);
  const csvTc = require('fs').readFileSync(await dTc.path(), 'utf8');
  ok(csvTc.charCodeAt(0) === 0xFEFF && csvTc.includes('Saldo calculado') && csvTc.includes('HOTEL DECAMERON'), 'tarjeta: exporta la conciliación a Excel');
  await page.click('[data-accion=tcReabrir]');
  await page.click('[data-accion=tcReabrirSi]');
  ok(await avisa('reabierta'), 'tarjeta: la reabre');
  await esperar();
  }

  await ir('equipo');
  await page.click('[data-activar$="|desactivar"] >> nth=0');
  await page.click('[data-confirmar=si]');
  ok(await avisa('desactivada'), 'administración: desactiva una cuenta con confirmación');

  // ---------- Grupos ----------
  await ir('grupos');
  const enColumna = (col, nombre) => page.$$eval(`[data-soltar="${col}"] .kcard-t`, (bs, n) => bs.some((b) => b.textContent === n), nombre);
  ok(await enColumna('confirmado', 'Peregrinación Fátima y Lourdes'), 'grupos: el tablero muestra los grupos en su columna');
  await page.click('[data-accion=grupoNuevo]');
  await page.click('form[data-form=grupo] button[type=submit]');
  ok((await page.textContent('form[data-form=grupo] .err')).includes('nombre'), 'grupos: pide el nombre');
  await page.fill('form[data-form=grupo] input[name=nombre]', 'Prueba Medellín');
  await page.fill('form[data-form=grupo] input[name=destino]', 'Medellín');
  await page.fill('form[data-form=grupo] input[name=salida]', '2026-12-10');
  await page.fill('form[data-form=grupo] input[name=regreso]', '2026-12-08');
  await page.click('form[data-form=grupo] button[type=submit]');
  ok((await page.textContent('form[data-form=grupo] .err')).includes('regreso'), 'grupos: el regreso no puede ser antes de la salida');
  await page.fill('form[data-form=grupo] input[name=regreso]', '2026-12-13');
  await page.fill('form[data-form=grupo] input[name=pasajeros]', '15');
  await page.fill('form[data-form=grupo] textarea[name=alcance]', 'Bus y hotel');
  await page.click('form[data-form=grupo] button[type=submit]');
  ok(await avisa('creado'), 'grupos: crea un grupo');
  await esperar();
  ok(await enColumna('cotizando', 'Prueba Medellín'), 'grupos: el grupo nuevo empieza en Cotizando');
  const tarjeta = page.locator('.kcard', { hasText: 'Prueba Medellín' });
  ok((await tarjeta.textContent()).includes('4 días'), 'grupos: la tarjeta cuenta los días del viaje');
  await tarjeta.locator('[data-gmover$="|1"]').click();
  ok(await avisa('Confirmado'), 'grupos: la flecha mueve a la columna siguiente');
  await esperar();
  ok(await enColumna('confirmado', 'Prueba Medellín'), 'grupos: queda en Confirmado');
  await page.locator('.kcard', { hasText: 'Prueba Medellín' }).dragTo(page.locator('[data-soltar="en_viaje"]'));
  ok(await avisa('En viaje'), 'grupos: arrastrar la tarjeta la mueve de columna');
  await esperar();
  ok(await enColumna('en_viaje', 'Prueba Medellín'), 'grupos: queda en En viaje');
  await page.click('.kcard-t >> text=Prueba Medellín');
  await page.fill('form[data-form=grupo] input[name=destino]', 'Medellín y Guatapé');
  await page.click('form[data-form=grupo] button[type=submit]');
  ok(await avisa('guardados'), 'grupos: edita un grupo');
  await esperar();
  await page.click('[data-gvista=tiempo]');
  while (!(await page.textContent('.weeknav b')).includes('diciembre 2026')) { await page.click('[data-gmes="1"]'); }
  const barra = await page.textContent('.gantt-fila:has-text("Prueba Medellín") .gantt-barra');
  ok(barra.includes('10 dic') && barra.includes('13 dic'), 'grupos: la línea de tiempo muestra la barra del 10 al 13 de diciembre');
  await page.click('[data-gvista=tablero]');
  await page.click('[data-accion=calClave]');
  await esperar();
  ok(/^[0-9a-f]{48}$/.test((await page.textContent('.clave dd.mono')).trim()), 'grupos: la administración ve la clave del calendario una vez');
  await page.click('[data-accion=calCerrar]');
  await page.click('.kcard-t >> text=Prueba Medellín');
  await page.click('[data-gborrar=pedir]');
  await page.click('[data-gborrar=si]');
  ok(await avisa('eliminado'), 'grupos: elimina un grupo con confirmación');
  await esperar();
  ok(!(await enColumna('en_viaje', 'Prueba Medellín')), 'grupos: ya no aparece en el tablero');

  // Una colaboradora también crea y mueve grupos, y no ve el botón del calendario
  await entrar('daniela.castro@caminos.example');
  await ir('grupos');
  ok(!(await page.$('[data-accion=calClave]')), 'grupos: solo la administración ve «Conectar Google Calendar»');
  await page.click('[data-accion=grupoNuevo]');
  await page.fill('form[data-form=grupo] input[name=nombre]', 'Grupo de Daniela');
  await page.click('form[data-form=grupo] button[type=submit]');
  ok(await avisa('creado'), 'grupos: una colaboradora crea un grupo');
  await esperar();
  await page.locator('.kcard', { hasText: 'Colegio San José' }).locator('[data-gmover$="|1"]').click();
  ok(await avisa('En viaje'), 'grupos: una colaboradora mueve un grupo creado por otra persona');

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
