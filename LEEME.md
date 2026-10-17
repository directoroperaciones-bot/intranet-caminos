# Intranet Caminos

Intranet del equipo de Caminos, construida con el *Manual técnico · Intranet corporativa (versión final)* y con el sistema de diseño de Caminos (el mismo de Caminos Documentos: coral `#F25061`, Poppins, logo con la estrella, fondo hueso, botones con radio 10).

**Qué trae:** acceso con correo corporativo y contraseña, **grupos de viaje** (tablero de cinco columnas, línea de tiempo y calendario compartido de Google), pase de jornada para marcar asistencia, malla de horarios (horario fijo + cambios puntuales + turnos), comunicados con confirmación de lectura, asistencia del día, informe mensual de gerencia con exportación a Excel, solicitudes de vacaciones, permisos e incapacidades, administración de cuentas y una guía de uso según el rol.

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

## 3. Pruebas hechas

- **Permisos en Postgres** (`supabase/pruebas/correr.sh`): 169 reglas en verde (con las 25 de grupos y la clave del calendario, y las 20 de marcar solo desde la oficina). Marcas solo con `marcar()`, orden de los pasos, bloqueo por IP, malla por sede, supervisor sin poderes de gerencia, comunicados por destinatario, solicitudes por revisor, ausencias aprobadas, `anon` sin acceso.
- **Interfaz** (`pruebas/recorrido.js`): 4 roles × 2 anchos (1300 px y 390 px), cada pestaña (Grupos en tablero y línea de tiempo) sin desborde horizontal y sin errores de página.
- **Acciones** (`pruebas/acciones.js`): 98 verificaciones (incluye recuperar contraseña, la pestaña Oficina y crear, mover, arrastrar, editar y borrar grupos), entre ellas que el informe cuadra con un cálculo manual independiente y que el CSV sale con BOM, `;` y `\r\n`.

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
4. **Edge Function** `crear-usuario` con *Verify JWT* activo (`supabase functions deploy crear-usuario`). Probarla sin sesión: debe responder 401.
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
