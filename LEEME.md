# Intranet Caminos

Intranet del equipo de Caminos, construida con el *Manual técnico · Intranet corporativa (versión final)* y con el sistema de diseño de Caminos (el mismo de Caminos Documentos: coral `#F25061`, Poppins, logo con la estrella, fondo hueso, botones con radio 10).

**Qué trae:** acceso con correo corporativo y contraseña, **grupos de viaje** (tablero de cinco columnas, línea de tiempo y calendario compartido de Google), pase de jornada para marcar asistencia, malla de horarios (horario fijo + cambios puntuales + turnos), comunicados con confirmación de lectura, asistencia del día, informe de asistencia de gerencia por rango de fechas (mes, trimestre, año, últimos días o fechas libres) con exportación a Excel del resumen y del detalle por día, solicitudes de vacaciones, permisos e incapacidades, **viáticos y legalización de gastos de viaje** (solicitud, presupuesto y aprobación de gerencia, gastos con soporte, revisión y saldo), menú agrupado (Inicio · Comunicados · Viajes · Personal · Administración), administración de cuentas y una guía de uso según el rol.

**Accesos a las herramientas (tarjetas en Inicio):**

| Herramienta | Dónde abre |
| --- | --- |
| Gestor de reservas | App de AppSheet `GESTORDERESERVAS-CAMINOS2` |
| Caminos Documentos | `https://claude.ai/artifact/WPzKkP7MwdKBaGrrGVpZ1Y` |
| Cotizador OMNIAXIS | Hoja de Google «Cotizador_OMNIAXIS_Plantilla_Maestra» |

Se cambian o se agregan en la tabla `herramientas` (un `insert` o `update`), sin tocar código.

---

## 0. Publicación en GitHub Pages

- **Sitio:** https://directoroperaciones-bot.github.io/intranet-caminos/
- **Demostración:** https://directoroperaciones-bot.github.io/intranet-caminos/pruebas/demo.html
- **Repositorio:** https://github.com/directoroperaciones-bot/intranet-caminos (público, rama `main`, carpeta raíz). Es una copia de esta carpeta: cada cambio se hace aquí, se prueba y se copia allá (`cp -a intranet/. ../intranet-caminos/`), cambiando antes el `?v=` de `index.html`.

La carpeta se publica tal cual como un sitio estático (rama `main`, carpeta raíz, con `.nojekyll`). Mientras `assets/config.js` diga `PENDIENTE`, la página principal muestra «La intranet se está preparando» y un botón a la demostración. En cuanto se ponen la URL y la llave publicable de Supabase, la misma dirección pasa a ser la intranet real; no cambia el enlace del equipo.

## 1. Ver la demostración

`pruebas/demo.html` es la intranet completa con un Supabase **simulado en memoria** y datos **de ejemplo** (personas ficticias con correo `@caminos.example`). Al recargar, todo vuelve a empezar.

```bash
cd intranet
npx http-server -p 8765 .
# abrir http://localhost:8765/pruebas/demo.html
```

En la pantalla de acceso hay botones con las cuentas de prueba, que entran directo (gerencia y administración, directora de operaciones, supervisor, colaboradora). La contraseña de todas es `clave1234`. Cada cuenta entra con un toque. El primer ingreso (cambio de contraseña y autorización de datos) se ve al crear una cuenta nueva desde Equipo y entrar con ella.

Para un solo archivo sin servidor: `python3 pruebas/armar_vista_previa.py salida.html`.

## 2. Estructura

```
intranet/
├── index.html                ← página real (supabase-js + config + app, con ?v=)
├── assets/
│   ├── estilos.css           ← sistema de diseño de Caminos
│   ├── app.css               ← piezas de la intranet
│   ├── config.js             ← URL y llave PUBLICABLE de Supabase (PENDIENTE)
│   ├── app.js                ← toda la aplicación
│   ├── logo-caminos.svg, logo-caminos-blanco.svg, estrella.svg, favicon.svg
├── supabase/
│   ├── migrations/001 … 008  ← base de datos (ver tabla abajo)
│   ├── instalar_todo.sql     ← todas en un archivo (bash supabase/unir.sh)
│   ├── functions/crear-usuario/index.ts
│   └── pruebas/              ← 144 pruebas de permisos en Postgres local
└── pruebas/
    ├── demo.html, supabase-simulado.js
    ├── recorrido.js          ← cada rol, cada pestaña, escritorio y celular
    ├── acciones.js           ← marcar, publicar, aprobar, malla, cuentas, informes
    ├── jornada.js            ← entrada temprana autorizada y medición de la salida
    ├── viaticos.js           ← viáticos y legalización de gastos de viaje
    └── armar_vista_previa.py
```

### Migraciones

Como Caminos es un cliente nuevo, se fusionaron las del manual (el manual lo permite):

| Archivo | Equivale en el manual |
| --- | --- |
| `001_esquema.sql` | 001 (con `rol_t` que ya incluye `supervisor`) |
| `002_archivos.sql` | 002 |
| `003_datos_iniciales.sql` | 003 — **la única que se personaliza** |
| `004_ausencias_y_soportes.sql` | 004 |
| `005_permisos_servicio.sql` | 005 |
| `006_supervisor.sql` | 006 a 010 |
| `007_horario_fijo.sql` | 011 |
| `008_ver_solicitudes.sql` | Corrección propia: la regla de lectura de solicitudes usa la fila y no vuelve a consultar la tabla (sin esto, enviar una solicitud fallaba en Supabase real) |
| `009_grupos.sql` | Propia: grupos de viaje (todo el equipo activo los crea, mueve y borra), clave y lectura para Google Calendar (`calendario/LEEME.md`) |
| `010_marcar_desde_oficina.sql` | Seguridad propia: IP real del cliente (no se puede falsificar), computadores autorizados y funciones para la pestaña Oficina |
| `011_conciliacion.sql` | Propia: conciliación de la tarjeta de crédito (solo gerencia): tarjetas, extractos, movimientos del banco, registros de la agencia, categorías, cierre del periodo, soportes privados y tiempo real |
| `012_grupos_parroquia.sql` | Propia: parroquia de cada grupo (tablero, línea de tiempo con filtro por parroquia, y Google Calendar) |
| `013_latido.sql` | Propia: `latido()` para que el plan gratis de Supabase no pause el proyecto (la llama `.github/workflows/mantener-activa.yml` cada día) |
| `014_grupos_columnas.sql` | Propia: siete columnas en Grupos (Cotización / costeo, Propuesta comercial, Aprobado parroquia, Gestión comercial, Ejecución grupo, En destino, Finalizado) |
| `015_horario_rotativo.sql` | Propia: horario fijo que rota por semanas (semana A, B…; ciclo de 2 a 4 semanas desde un lunes) |
| `016_informes_gestion.sql` | Propia: informes de gestión. Resumen de ventas del gestor de reservas (sin datos personales), solo para gerencia; lo escribe el script `informes/Codigo.gs` con su clave |
| `017_ventas_aplicar.sql` | Propia: `aplicar_ventas(filas)`, la carga del resumen de ventas que usa la tarea diaria de Claude (solo el servidor puede llamarla) |
| `018_ventas_boton.sql` | Propia: botón «Actualizar» de Gestión. Despierta la tarea de Claude con `pg_net`; la Fire URL y el token van cifrados en Vault; una vez cada 10 minutos |
| `019_extranet.sql` | Propia: extranet de clientes (`clientes/`). Tablas `clientes_ext`, `ventas_cliente`, `cobros_cliente` y `cuentas_cliente`: cada cliente lee solo sus filas. Carga con `aplicar_extranet`, solo el servidor. Las tablas del equipo que leía cualquier sesión pasan a ser solo del personal activo |
| `020_cuentas_cobro.sql` | Propia: cuentas de cobro de aliados (plantilla CUENTA_COBRO_ALIADO). `generar_cuenta_cobro` exige ventas facturadas, con número de factura, en modalidad Retorno, facturadas en el periodo y no cobradas antes. `estado_cuenta_cobro`: enviada, pagada o anulada; anular libera las ventas |
| `021_ajustes_jornada.sql` | Propia: entrada temprana autorizada. Si alguien marca la entrada 30 min o más antes de su turno, `ajustar_jornada` guarda el motivo, la nueva hora de salida (o que no cambia) y quién lo autorizó (gerencia, dirección o supervisión). El informe mide la salida contra esa hora. Agrega a `tolerancias` `salida_min` (5) y `temprano_min` (30) sin tocar las existentes |
| `022_solo_gerente.sql` | Propia: solo el rol «gerente» es gerencia (`es_gerencia`, `lidera_sede`). La marca de administración ya no da acceso a Gestión, Tarjeta, Oficina ni a todas las sedes; solo sirve para administrar cuentas, sedes y áreas |
| `023_viaticos.sql` | Propia: viáticos y legalización de gastos de viaje. Tablas `viaticos` y `viatico_gastos`, carpeta privada `viaticos` para los soportes. Flujo con funciones: `solicitar_viatico`, `asignar_viatico`, `aprobar_viatico`, `rechazar_viatico`, `enviar_legalizacion`, `no_aceptar_gasto`, `revisar_legalizacion` (cierra con el saldo) y `anular_viatico`. Cada quien ve los suyos; la gerencia, todos; nadie se aprueba a sí mismo |
| `024_informe_tarjeta.sql` | Propia: informe de la conciliación de la tarjeta por correo. Tabla `tc_envios` (quién envió, cuándo, a quién, avance y si salió); solo la gerencia la lee y solo el servidor escribe. La envía la Edge Function `enviar-informe-tarjeta` |

## 3. Pruebas hechas

- **Permisos en Postgres** (`supabase/pruebas/correr.sh`): 399 reglas en verde (con las 11 del registro de envíos del informe de la tarjeta, las 44 de viáticos y legalización, las 5 de «solo el gerente ve todo», las 18 de la entrada temprana autorizada, las 23 de las cuentas de cobro, con las 44 de los informes de gestión y su botón, las 33 de la extranet de clientes, con las 28 de grupos (con la parroquia) y la clave del calendario, las 20 de marcar solo desde la oficina y las 32 de la conciliación de la tarjeta). Marcas solo con `marcar()`, orden de los pasos, bloqueo por IP, malla por sede, supervisor sin poderes de gerencia, comunicados por destinatario, solicitudes por revisor, ausencias aprobadas, `anon` sin acceso.
- **Interfaz** (`pruebas/recorrido.js`): 4 roles × 2 anchos (1300 px y 390 px), cada pestaña (Grupos en tablero y línea de tiempo) sin desborde horizontal y sin errores de página.
- **Viáticos** (`pruebas/viaticos.js`): 37 verificaciones (menú agrupado, solicitar, registrar gastos con soporte, enviar, aprobar, rechazar, no aceptar un gasto, devolver, saldo, formato imprimible, asignar y celular).
- **Jornada** (`pruebas/jornada.js`): 25 verificaciones con el reloj fijo (ventana de entrada temprana, salida ajustada, tiempo adicional, vista de la líder e informe).
- **Acciones** (`pruebas/acciones.js`): 232 verificaciones (incluye el envío del informe de la tarjeta por correo, el informe de asistencia por rango de fechas y su detalle por día, los filtros cruzados del tablero de gestión, recuperar contraseña, la pestaña Oficina, los gastos y la conciliación de la tarjeta y crear, mover, arrastrar, editar y borrar grupos), entre ellas que el informe cuadra con un cálculo manual independiente y que el CSV sale con BOM, `;` y `\r\n`.

```bash
# Postgres local (usuario postgres)
PGHOST=… PGPORT=… PGUSER=postgres bash supabase/pruebas/correr.sh
# Interfaz (con el servidor de la sección 1 corriendo)
node pruebas/recorrido.js capturas
node pruebas/acciones.js
# Programa de Google Calendar (sin Google)
node calendario/probar.js
```

Lo que el simulador **no** cubre: los permisos de `service_role` y la Edge Function real. Crear una cuenta en el Supabase real de Caminos es parte obligatoria de la prueba final (manual §13.4).

## 3b. Recuperar contraseña

En la entrada hay un botón **«¿Olvidaste tu contraseña?»**. La persona escribe su correo y Supabase le envía un enlace de un solo uso que vence en 1 hora; al abrirlo, la intranet le pide la contraseña nueva dos veces y entra.

- La respuesta es la misma exista o no la cuenta (nadie puede averiguar qué correos están registrados). Las cuentas desactivadas no pueden usar el enlace.
- Un enlace vencido o ya usado lleva a pedir uno nuevo. Supabase no deja pedir otro para el mismo correo antes de 60 segundos.
- El enlace vuelve a la dirección de la intranet, que está en *Site URL* y en *Redirect URLs*.
- **Correo de salida:** mientras Supabase use su correo de prueba, solo envía a los miembros de la organización de Supabase y máximo 2 por hora. Para el equipo hay que configurar SMTP propio (Google Workspace: `smtp.gmail.com`, puerto 465, con una contraseña de aplicación) en *Authentication → Emails → SMTP Settings*. Después se pega la plantilla `supabase/correos/recuperar_contrasena.html` y se sube el límite de correos por hora.

## 3c. Marcar solo desde la oficina (pestaña Oficina, gerencia)

Dos controles que se activan por separado:

1. **Solo desde la red de la oficina.** Desde un computador de la oficina, la gerencia toca «Registrar como IP de la oficina» y activa el control. Con datos del celular o desde la casa no se puede marcar. La IP se lee de `cf-connecting-ip` (la pone Cloudflare): antes se leía el primer valor de `x-forwarded-for`, que el navegador puede inventar. Requiere IP fija del proveedor de internet.
2. **Solo desde computadores autorizados.** En cada computador de la oficina, la gerencia entra con su cuenta y toca «Autorizar este computador». El navegador guarda una llave de 64 caracteres; en la base solo queda su huella SHA-256 (columna que nadie puede leer). Sin la llave (celulares, computadores personales) no se marca. Cada marca guarda qué computador se usó.

Límites: ninguna página web detecta con certeza un programa de acceso remoto (AnyDesk, TeamViewer, Escritorio remoto). Eso se controla en los computadores: sin esos programas, sin permisos de administrador para los asesores y con esos sitios bloqueados en el router.

## 3d. Conciliación de la tarjeta de crédito (pestaña Tarjeta, gerencia)

Dos pasos:

1. **Gastos y soportes** (el día a día): cada vez que se paga con la tarjeta, se sube la foto o el PDF de la factura con el valor, la fecha, qué se pagó, la categoría y el grupo de viaje. Indicadores: gastos del mes, sin soporte, por conciliar y ya en el extracto. Un gasto sin factura se puede guardar y completar después.
2. **Conciliar con el extracto** (cuando llega): crear el extracto (datos de su primera página), importar los movimientos (filas pegadas desde Excel o el CSV del banco), cruzarlos con los gastos subidos, revisar lo que quede, marcar lo no reconocido (reclamo al banco) o personal (cobro a la persona), comprobar el cuadre y cerrar.

- **Indicadores arriba**: avance, por conciliar, sin soporte, no reconocidos, intereses y cargos, y cuadre con el extracto (saldo anterior + cargos − pagos = total a pagar). Cada indicador filtra la tabla.
- **Cruce automático**: mismo valor y hasta 5 días de diferencia; los pagos y los cargos del banco (intereses, cuota de manejo, comisiones) se concilian solos con «Conciliar sugeridos».
- **Importación**: detecta columnas por su nombre (o por su contenido si no hay encabezado), separador (tabulador, `;` o `,`), formatos de fecha (`03/10/2026`, `2026-10-03`, `3-oct-2026`) y de pesos (`$ 1.234.567`, `1,234,567.89`, `(1.000)`), el tipo de movimiento y los repetidos. CSV en UTF-8 o Latin-1.
- **Tiempo real**: la pantalla se suscribe a los cambios de `tc_movimientos`, `tc_registros` y `tc_extractos` (publicación `supabase_realtime`); un cambio hecho en otro equipo aparece sin recargar.
- **Cierre**: solo sin pendientes. Cerrado, la base no deja editar nada (disparador), salvo reabrir. Las facturas van al depósito privado `conciliacion`, con enlaces firmados de 1 hora.
- De la tarjeta solo se guardan los **últimos 4 dígitos**.
- **Informe por correo**: el botón **«Enviar informe por correo»** (junto a «Exportar a Excel», con la conciliación abierta o cerrada) abre una ventana con los destinatarios, el asunto, el adjunto, una nota opcional y la **vista previa del correo**. Al tocar «Enviar informe» le llega a **Yenny Huerfano** (`financiero@agenciacaminos.com.co`) y a **Jhon Guataquira** (`director@agenciacaminos.com.co`): estado y avance, resumen del extracto y cuadre, lo que hay que revisar (por conciliar, sin factura, no reconocidos, personales, intereses), gasto por categoría y por grupo, los movimientos que piden atención y el **CSV completo adjunto** (el mismo de «Exportar a Excel»). La respuesta del correo va a quien lo envió. Si la conciliación sigue abierta, la ventana lo avisa y el informe sale con el avance de ese momento.
  - Los destinatarios están **fijos en la Edge Function** `enviar-informe-tarjeta` (constante `DESTINATARIOS`); el navegador no los puede cambiar. Para cambiarlos se edita esa constante y `TC_INFORME_PARA` en `app.js` (solo se muestra) y se vuelve a publicar la función.
  - Solo la gerencia lo envía; cada envío queda en `tc_envios` y la pantalla muestra «Enviado el …». El mismo extracto no se reenvía antes de 1 minuto (evita el doble clic).
  - **Instalación:** migración `024`, `supabase functions deploy enviar-informe-tarjeta` (con *Verify JWT*) y los secretos `SMTP_USUARIO` (la cuenta de Google Workspace que envía), `SMTP_CLAVE` (su contraseña de aplicación) y, si se quiere, `SMTP_REMITENTE` («Intranet Caminos <…>»). Usa `smtp.gmail.com` por el puerto 465 (Supabase bloquea 25 y 587). Es la misma cuenta del pendiente 1b.

## 3f. Informes de gestión (pestaña Gestión, gerencia)

Tablero de ventas con los datos del gestor de reservas de AppSheet (la hoja se lee todos los días a las 6 a. m. con una tarea automática de Claude; nunca se modifica). Instalación y fórmulas en `informes/LEEME.md`.

- **Filtros sincronizados:** mes, asesora, estado, tipo de venta y tipo de viaje arriba. Además, tocar una columna, un estado, una barra o una asesora filtra **todo** el tablero. Cada gráfica sigue mostrando las otras opciones de su propio filtro, atenuadas, con la elegida resaltada.
- **Medir por:** valor, número de ventas o utilidad; cambia todas las gráficas a la vez.
- **Indicadores:** ventas registradas, efectivas (confirmadas y facturadas), utilidad realizada con margen, conversión, ticket promedio y pasajeros, con la tendencia por mes y la comparación con el mes anterior cuando hay un mes elegido.
- **Actualizar:** despierta en el momento la tarea de Claude que lee el gestor de reservas. Se conecta una vez en «Conexión con el gestor de reservas».
- **Exportar a Excel:** baja el detalle filtrado en CSV.

## 3g. Extranet de clientes (portal en `clientes/`)

Los clientes de AppSheet (aliados freelance y parroquias, hoja **CLIENTES**) entran a **`…/intranet-caminos/clientes/`** con su correo y ven **solo sus ventas**: estado, destino, fechas, viajeros (solo nombres), servicios (sin costos), valor, pagos, saldo, su comisión y sus cuentas de cobro. Nunca ven costos, utilidad de Caminos ni proveedores: esos datos ni siquiera llegan a sus tablas.

- **Cómo se le da acceso a un cliente:** en la intranet, **Equipo → Clientes (extranet)** (solo administración) → **Crear acceso**. Usa el correo que el cliente tiene en AppSheet y muestra una contraseña temporal una sola vez, con el mensaje listo para copiar y enviar. Al entrar, el cliente crea la suya. Desde ahí también se da una contraseña nueva y se desactiva o reactiva el acceso.
- **Si un cliente no tiene correo en AppSheet**, no se puede crear su acceso: se agrega el correo en la hoja CLIENTES y se toca «Actualizar» en Gestión.
- **Sus ventas** son las que en PIPELINE tienen su `ID_Cliente`.
- **Comisión:** `% terrestre × valor de los servicios «Plan Terrestre» + % TA × Total TA`, solo en ventas confirmadas o facturadas. Los porcentajes salen de CLIENTES (`Pct_Comision_Terrestre`, `Part_TA_Aliado`); si la venta trae los suyos (`Pct_Comision_Terrestre_Venta`, `Part_TA_Venta`), mandan esos. Si el cliente no tiene porcentajes, el portal no muestra comisión.
- **Datos al día:** la misma tarea de Claude de las 6 a. m., y el botón «Actualizar» de Gestión, traen también los datos de la extranet.
- **Cuentas creadas** por la Edge Function `crear-cliente` (solo administración). Una cuenta de cliente no ve nada del equipo: las tablas del equipo exigen ser personal activo. Si un cliente entra por error a la intranet, se le indica su portal.
- **Cuentas de cobro:** el aliado le cobra a Caminos la comisión de **varias ventas en un solo documento**, con el diseño de la plantilla `CUENTA_COBRO_ALIADO_MENSUAL_CAMINOS`. La genera la gerencia (**Gestión → Cuentas de cobro de aliados → Nueva cuenta de cobro**) o el aliado en su portal (**Tus cuentas de cobro → Generar cuenta de cobro**): se elige el periodo y se marcan las ventas. Solo entran ventas **facturadas, con número de factura, en modalidad «Retorno», facturadas dentro del periodo y que no estén en otra cuenta**. Numeración `CC-AAAAMM-NNNN`. El botón **PDF** abre el documento para imprimir o guardar como PDF. La gerencia la marca como enviada o pagada; anular libera las ventas, y el aliado solo puede anular las suyas que aún no se han enviado. Los datos del documento (NIT, dirección, banco, cuenta, titular) salen de la hoja CLIENTES, y el documento guarda una foto de ellos al generarse. Las cuentas se guardan en la intranet: la hoja de AppSheet no se modifica.
- **Pruebas:** `node pruebas/clientes.js` (portal) y la parte «extranet» de `pruebas/acciones.js`. Demostración: `pruebas/clientes-demo.html`.

## 3e. Que el servidor no se apague

El plan gratis de Supabase **pausa el proyecto tras 7 días sin uso**: la intranet muestra «No hay conexión con el servidor» hasta que alguien lo reactiva en supabase.com (botón *Restore*, tarda unos minutos). Pasó el 3 de noviembre de 2026.

- **Prevención gratis:** la tarea de GitHub `.github/workflows/mantener-activa.yml` llama cada día a `latido()` (solo devuelve la hora; no toca datos). Si falla, GitHub avisa por correo. GitHub apaga las tareas programadas de un repositorio público tras 60 días sin cambios: si eso pasa, se reactiva en *Actions → Mantener activa → Enable workflow*.
- **Solución definitiva:** el plan Pro de Supabase (USD 25 al mes) no pausa nunca y suma copias de seguridad diarias. Recomendado cuando el equipo use la intranet a diario.
- Cuando el equipo marque asistencia todos los días, el proyecto no llega a pausarse.

## 4. Pendientes y decisiones

Decisiones tomadas (13 de octubre de 2026):

- **Texto de tratamiento de datos:** redactado (Ley 1581 de 2012): responsable, datos, finalidades, datos sensibles de incapacidad, almacenamiento en Supabase (Estados Unidos), derechos y contacto. Está en `MARCA.datos`. Conviene que lo revise un asesor legal.
- **Sedes y áreas:** solo Bogotá, con Gerencia, Ventas, Operaciones y Contabilidad. No hay más.
- **Horarios y turnos:** los carga la dirección de operaciones desde la pantalla Malla. Los 5 turnos de ejemplo (M, T, S, D, V) se pueden editar o eliminar.

| # | Qué falta | Dónde va |
| --- | --- | --- |
| 1 | **Número de RNT** para el pie de página (llega después) | `MARCA.registro` en `app.js` |
| 1b | **SMTP propio** para que los correos de recuperación lleguen a todo el equipo | Supabase → Authentication → Emails |
| 2 | **Personas**: nombre, correo corporativo, área y rol | Pantalla Equipo |
| 3 | Tolerancias y meta de puntualidad (hoy 5 min, 5 min y 95 %) | Tabla `configuracion` |
| 4 | ¿Se usarán las solicitudes? ¿Quién las revisa? | Pantalla Solicitudes (gerencia) |
| 5 | IP pública de la oficina (fase final, en sitio) | `sedes.ips_oficina` + `validar_ip` |

Otros puntos para confirmar:

- El enlace del Gestor de reservas se dejó sin los parámetros de primer uso (`newUser`, `onboarding`) para que abra directo en la vista INICIO.
- Caminos Documentos es un artifact de claude.ai: cada persona necesita poder abrirlo con su cuenta de Claude.

## 5. Puesta en marcha (resumen del manual §10 y §12)

1. **Supabase** con la cuenta dueña: proyecto `intranet-caminos` en la región de América más cercana. En *Security*: dejar la Data API, **apagar «Automatically expose new tables»** y activar RLS automático.
2. Pegar `supabase/instalar_todo.sql` en el SQL Editor (o `supabase db push` con las migraciones).
3. **Auth**: apagar el registro abierto, contraseña mínima de 8, *Site URL* = dirección de la intranet.
4. **Edge Functions** `crear-usuario`, `crear-cliente` y `enviar-informe-tarjeta` con *Verify JWT* activo (la última necesita los secretos SMTP de §3d): `supabase functions deploy <nombre>`. Probarlas sin sesión: deben responder 401.
5. **Primera administradora**: *Authentication → Users → Add user* (Auto Confirm) y luego:
   ```sql
   insert into perfiles (id, nombre, correo, sede_id, area_id, rol, es_admin)
   select id, '‹Nombre›', email, 1, 1, 'gerente', true from auth.users where email = '‹correo›';
   ```
6. Copiar la Project URL y la llave **publicable** a `assets/config.js`. Nunca la llave de servicio.
7. **GitHub Pages**: repositorio público `intranet-caminos` con el contenido de esta carpeta (sin `pruebas/` ni `supabase/pruebas/` si se prefiere), *Settings → Pages → main / (root)*.
8. Crear las cuentas desde **Equipo**, cargar turnos y horario fijo, y fijar `configuracion.inicio_horarios` en el día de arranque.

**En cada publicación** se cambia el `?v=` de los cuatro enlaces de `index.html`; la página detecta la versión nueva y recarga sola una vez.

## 6. Decisiones de diseño

- **Tema claro único**, como Caminos Documentos y como pide el manual (el primer prototipo del manual se rechazó por oscuro).
- El **pase de jornada** es un pase de abordar: talón coral con la ruta Entrada → Salida y un avión, y los pasos ENT · ALM · REG · SAL como códigos de aeropuerto.
- Las superficies coral con texto blanco pequeño (pantalla de acceso y talón del pase) usan un coral un tono más profundo (`#D63B4D`) para cumplir contraste AA. El coral de marca se mantiene en botones, acentos y logo.
- Los colores de turno (`f0`…`f9`) son tintes suaves; el coral queda reservado para el borde de los cambios puntuales.
- Confirmaciones (eliminar, cancelar, desactivar) dentro de la página, sin ventanas del navegador.
