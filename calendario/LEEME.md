# Grupos en Google Calendar

Los grupos con fechas de la intranet aparecen solos en un calendario compartido de Google llamado **«Grupos Caminos»**. Cada grupo es un evento de todo el día, desde la salida hasta el regreso, con el color de su columna:

| Columna | Color en Google |
| --- | --- |
| Cotizando | Azul claro (y «(cotizando)» en el título) |
| Confirmado | Verde |
| Documentación lista | Amarillo |
| En viaje | Rojo |
| Finalizado | Gris |

El evento trae destino, fechas, pasajeros, responsable y alcance. Las **notas internas no salen** de la intranet. Un programa gratis de Google (Apps Script) revisa la intranet **cada 10 minutos**: crea, cambia o borra los eventos. Los cambios se hacen siempre en la intranet; si alguien cambia un evento en Google, se pierde en la siguiente vuelta.

## Instalación (una sola vez, unos 15 minutos)

El calendario es de la cuenta **directoroperaciones@agenciacaminos.com.co** (decisión del 13 de octubre de 2026): con ella se hacen los pasos 3 y 4. El paso 2 necesita una cuenta de **administración** en la intranet.

**Ya hecho el 13 de octubre de 2026:** la migración 009 está en el proyecto `intranet-caminos` (paso 1) y el calendario «Grupos Caminos» ya existe en la cuenta directoroperaciones@agenciacaminos.com.co (parte del paso 3). Faltan los pasos 2, 3 y 4.

| Dato | Valor |
| --- | --- |
| Identificador del calendario | `c_d71d5f8e35f888ace68df1f21428f8fe0e6c22d57a3b69d5be5d4b407f12328b@group.calendar.google.com` |

### 1. Base de datos

En Supabase → *SQL Editor*, pega y corre `supabase/migrations/009_grupos.sql`. Si la base se instala desde cero, `supabase/instalar_todo.sql` ya la incluye.

### 2. Clave del calendario

En la intranet, entra a **Grupos → Conectar Google Calendar** y toca **Copiar**. La clave se muestra una sola vez. Si se pierde, se crea otra con el mismo botón; la anterior deja de servir.

### 3. Programa de Google

1. Abre [script.google.com](https://script.google.com) con la cuenta de la empresa y toca **Nuevo proyecto**. Ponle de nombre «Grupos Caminos».
2. Borra lo que trae `Código.gs` y pega todo el contenido de `calendario/Codigo.gs`.
3. En **Configuración del proyecto** (la rueda), activa «Mostrar el archivo de manifiesto appsscript.json». Vuelve al editor, abre `appsscript.json` y reemplaza su contenido por el de `calendario/appsscript.json`.
4. En **Configuración del proyecto → Propiedades del script**, agrega cuatro propiedades:

| Propiedad | Valor |
| --- | --- |
| `SUPABASE_URL` | La dirección del proyecto, la misma de `assets/config.js` (`https://….supabase.co`) |
| `SUPABASE_KEY` | La llave **publicable**, la misma de `assets/config.js`. Nunca la secreta: el programa se niega a usarla |
| `CLAVE_CALENDARIO` | La clave del paso 2 |
| `CALENDARIO_ID` | El identificador del calendario de la tabla de arriba. Si se deja vacía, `crearCalendario` crea uno nuevo |

5. Como el calendario ya existe, no hace falta `crearCalendario`. Elige la función **`instalar`** y toca **Ejecutar**. Google pide permiso: acepta con la cuenta de la empresa. Hace la primera vuelta y deja la revisión cada 10 minutos. En el registro debe salir «Listo: se sincroniza cada 10 minutos».

### 4. Compartir el calendario con el equipo

En [Google Calendar](https://calendar.google.com), en «Mis calendarios», abre los tres puntos de **Grupos Caminos** → **Configuración y uso compartido** → **Compartir con personas o grupos específicos**. Agrega el correo de cada colaborador con el permiso **«Ver todos los detalles de los eventos»**. Cada persona recibe un correo; al aceptarlo, los grupos aparecen en su agenda, en el computador y en el celular.

Para alguien nuevo en el equipo solo se repite este paso.

## Si algo falla

- **«La clave del calendario no sirve»:** se creó otra clave en la intranet. Copia la nueva (paso 2) y cámbiala en `CLAVE_CALENDARIO`.
- **«Faltan propiedades del proyecto»:** revisa los cuatro nombres del paso 3.4, en mayúsculas.
- Para detener la sincronización, ejecuta **`desinstalar`**. Los eventos que ya están se quedan.
- En **Ejecuciones** (menú izquierdo del proyecto) se ve cada vuelta y sus errores. Google también avisa por correo si una vuelta falla.

## Pruebas

`node calendario/probar.js` prueba `Codigo.gs` con un calendario y una intranet simulados: crea, actualiza y borra eventos, no toca eventos ajenos y avisa con una clave vencida o una llave secreta. La función `grupos_calendario` y la clave tienen sus pruebas de permisos en `supabase/pruebas/03_grupos.sql`.
