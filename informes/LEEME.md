# Informes de gestión: el gestor de reservas en la intranet

La pestaña **Gestión** de la intranet (solo gerencia y administración) es un tablero de ventas. Muestra indicadores, la evolución por mes, los estados, el desempeño por asesora, la cartera, el tipo de venta, los destinos, los servicios, los proveedores, el seguimiento de las ventas no cerradas y las próximas salidas. Todos los datos salen del **gestor de reservas de AppSheet**, es decir, de la hoja de Google `1k32N3e4r5jS0iWvyPWsUGr6XLY7homB5sEhJIj9Bjbg`.

## Cómo llegan los datos

**Hoy (desde el 18 de noviembre de 2026): una tarea automática de Claude, todos los días a las 6 a. m. (hora de Bogotá).** Corre con el modelo Sonnet y no hay que instalar nada en Google. Usa las conexiones de Claude: Google Sheets solo para leer y Supabase para escribir el resumen. Corre `informes/sincronizar_desde_claude.py`, que lee la hoja con `GOOGLESHEETS_BATCH_GET`. Arma el resumen con la misma función de `Codigo.gs`, sin datos personales, y lo carga con `aplicar_ventas` (migración 017). Si la hoja llega vacía, o con muchas menos ventas que las que hay en la intranet, no cambia nada y avisa. La tarea se ve, se pausa o se corre a mano en claude.ai, en las tareas programadas. Se llama «Actualizar informes de gestión».

**Botón «Actualizar» de la pestaña Gestión:** despierta la misma tarea en el momento, sin esperar a las 6 a. m. Mientras el agente trabaja (unos minutos), arriba dice «Actualizando desde el gestor de reservas…». La pantalla se recarga sola al terminar. Se puede pedir una vez cada 10 minutos (otro clic mientras corre no pide otra), y la gerencia lo usa. Cómo funciona por dentro: la base llama a la tarea por internet con `pg_net` (migración 018), usando la «Fire URL» y el token de la tarea, guardados cifrados en Vault. Nadie los puede leer desde la intranet. **Para conectarlo (una vez, administración):**

1. En claude.ai/code/routines, abre «Actualizar informes de gestión» → **Editar** → en **Trigger** toca **+** → **API** → **Generate token**. El token se ve una sola vez.
2. En la intranet: **Gestión → Conexión con el gestor de reservas → Conectar el botón**. Pega la **Fire URL** y el **token** y toca **Conectar el botón**.

Si el token se regenera en claude.ai, el anterior deja de servir: hay que pegar el nuevo. Sin conectar, «Actualizar» solo recarga los datos guardados.

**Opcional, si se quieren datos cada 10 minutos:** el programa de Google (Apps Script) de abajo. Hace lo mismo, gratis.


Con el programa de Google, cada **10 minutos**:

1. **Lee** la hoja con el permiso «ver hojas de cálculo» (`spreadsheets.readonly`). Con ese permiso no puede cambiar ni borrar nada en la hoja, aunque quisiera.
2. Arma **una fila por venta**, sin datos personales. Lleva asesora, fecha de registro, estado, tipo de venta y de viaje, destino, plan, fechas de viaje, número de pasajeros y valores. No lleva clientes, solicitantes, nombres de pasajeros ni teléfonos.
3. La manda a la intranet con la clave `CLAVE_VENTAS`. La intranet reemplaza el resumen anterior; una venta que ya no está en la hoja sale del informe. En la base solo queda la huella de la clave.
4. La pantalla abierta se actualiza sola. Arriba dice cuándo fue la última sincronización y avisa si pasó más de un día sin datos nuevos.

### Cómo se calcula cada dato

Son las mismas cuentas del tablero «Resumen Asesores» de AppSheet, comparadas peso por peso el 18 de noviembre de 2026.

| Dato | Cálculo |
| --- | --- |
| Valor de una venta | Suma del `Gran_Total_Servicio` de sus servicios (hoja SERVICIOS) |
| Costo | Suma del `Total Proveedor` de sus servicios |
| Ventas efectivas | Estado **Confirmada** o **Facturado** |
| Utilidad realizada | Valor − costo de las ventas efectivas |
| Margen | Utilidad realizada ÷ valor de las ventas efectivas |
| Conversión | Ventas efectivas ÷ ventas registradas (en número) |
| Cobrado | Abonos de CONTROL_PAGOS (`Abono_Equivalente_COP`), sin los anulados ni los pendientes |
| Pagado a proveedores | PAGOS_PROVEEDORES con estado «Pagado» |
| Mes | Mes de la `Fecha_Registro` de la venta |
| Asesora | `Agente` (correo) traducido a nombre con la hoja ASESORES |
| Plan | `Paquete_Religioso` traducido con PANEL_DE_COSTEOS (`Nombre_Plan`) |
| Seguimiento | `Estado_Segundo_Seguimiento` o, si está vacío, el primero |

## Instalación del programa de Google (opcional, unos 10 minutos)

Hazla con la cuenta que **puede ver** la hoja del gestor de reservas (la misma que usa AppSheet o una con acceso de lectura). El paso 1 necesita una cuenta de **administración** en la intranet.

### 1. Clave del script

En la intranet, entra a **Gestión** y baja hasta **Conexión con el gestor de reservas**. Toca **Crear la clave del script** y luego **Copiar**. La clave se muestra una sola vez. Si se pierde, se crea otra con el mismo botón y la anterior deja de servir.

### 2. Programa de Google

1. Abre [script.google.com](https://script.google.com) y toca **Nuevo proyecto**. Ponle de nombre «Informes Caminos».
2. Borra lo que trae `Código.gs` y pega todo el contenido de `informes/Codigo.gs`.
3. En **Configuración del proyecto** (la rueda), activa «Mostrar el archivo de manifiesto appsscript.json». Vuelve al editor, abre `appsscript.json` y reemplaza su contenido por el de `informes/appsscript.json`.

### 3. Propiedades del script

En **Configuración del proyecto → Propiedades del script**, agrega:

| Propiedad | Valor |
| --- | --- |
| `SUPABASE_URL` | La dirección del proyecto, la misma de `assets/config.js` (`https://….supabase.co`) |
| `SUPABASE_KEY` | La llave **publicable**, la misma de `assets/config.js`. Nunca la secreta: el programa se niega a usarla |
| `CLAVE_VENTAS` | La clave del paso 1 |
| `HOJA_ID` | Opcional. Solo si el gestor de reservas cambia de hoja. Si no está, se usa `1k32N3e4r5jS0iWvyPWsUGr6XLY7homB5sEhJIj9Bjbg` |

### 4. Encender

En el editor, elige la función **`instalar`** y toca **Ejecutar**. Google pide permisos:

- ver tus hojas de cálculo (**solo lectura**),
- conectarse a un servicio externo (la intranet),
- ejecutarse solo (cada 10 minutos).

Acéptalos; si sale «Google no verificó esta app», toca *Configuración avanzada → Ir a Informes Caminos*. Al terminar, el registro dice cuántas ventas se mandaron y la pestaña **Gestión** muestra la hora de la sincronización.

- **Para detenerlo:** ejecuta `desinstalar`. El tablero se queda con la última vuelta.
- **Si cambian el nombre de una columna en AppSheet:** el programa busca las columnas por su nombre. Si una cambia, ese dato llega vacío. Hay que ajustar el nombre en `Codigo.gs`.
- **Probar sin Google:** `node informes/probar.js` corre el programa con una hoja simulada (26 pruebas).
