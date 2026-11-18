# =====================================================================
# Intranet Caminos · Tarea diaria de Claude → Informes de gestión
# Corre dentro del entorno de Python de Composio (COMPOSIO_REMOTE_WORKBENCH),
# que trae run_composio_tool(). Hace lo mismo que informes/Codigo.gs, pero
# sin instalar nada en Google:
#   1. LEE la hoja del gestor de reservas con GOOGLESHEETS_BATCH_GET
#      (solo lectura: no usa ninguna herramienta que escriba en Google).
#   2. Arma el resumen por venta con la MISMA función de Codigo.gs
#      (construirFilas_), sin datos personales.
#   3. Lo carga en Supabase con aplicar_ventas(filas) (migración 017).
# Uso (lo hace la tarea programada):
#   exec(urllib.request.urlopen(URL_DE_ESTE_ARCHIVO).read().decode())
#   print(sincronizar_ventas())
# =====================================================================
import json
import os
import subprocess
import tempfile
import urllib.request

HOJA_ID = '1k32N3e4r5jS0iWvyPWsUGr6XLY7homB5sEhJIj9Bjbg'
PROYECTO = 'psclplnwvfksckogkcrz'
CODIGO_GS = 'https://raw.githubusercontent.com/directoroperaciones-bot/intranet-caminos/main/informes/Codigo.gs'
HOJAS = {
    'ventas': 'PIPELINE', 'servicios': 'SERVICIOS', 'pagos': 'CONTROL_PAGOS', 'pagosProv': 'PAGOS_PROVEEDORES',
    'asesores': 'ASESORES', 'costeos': 'PANEL_DE_COSTEOS', 'proveedores': 'PROVEEDORES',
}
# Solo estas herramientas; ninguna escribe en Google
_PERMITIDAS = {'GOOGLESHEETS_BATCH_GET', 'SUPABASE_BETA_RUN_SQL_QUERY'}


def _herramienta(nombre, args):
    if nombre not in _PERMITIDAS:
        raise RuntimeError('Herramienta no permitida: ' + nombre)
    r, e = run_composio_tool(nombre, args)  # noqa: F821 (lo da el entorno de Composio)
    if e:
        raise RuntimeError(f'{nombre}: {e}')
    if isinstance(r, dict) and r.get('error'):
        raise RuntimeError(f'{nombre}: {r["error"]}')
    return r.get('data', r) if isinstance(r, dict) else r


def _sql(consulta):
    d = _herramienta('SUPABASE_BETA_RUN_SQL_QUERY', {'ref': PROYECTO, 'query': consulta})
    return d.get('result', []) if isinstance(d, dict) else d


def _leer_hoja():
    d = _herramienta('GOOGLESHEETS_BATCH_GET', {'spreadsheet_id': HOJA_ID, 'ranges': [f'{h}!A1:ZZ50000' for h in HOJAS.values()]})
    por_nombre = {}
    for vr in d.get('valueRanges', []):
        nombre = vr.get('range', '').split('!')[0].strip("'")
        por_nombre[nombre] = vr.get('values', [])
    return {k: por_nombre.get(h, []) for k, h in HOJAS.items()}


def _construir(tablas):
    codigo = urllib.request.urlopen(CODIGO_GS, timeout=30).read().decode()
    with tempfile.TemporaryDirectory() as d:
        for nombre, txt in (('Codigo.gs', codigo), ('tablas.json', json.dumps(tablas, ensure_ascii=False))):
            with open(os.path.join(d, nombre), 'w', encoding='utf-8') as f:
                f.write(txt)
        js = ("const fs=require('fs'),vm=require('vm'),ctx={};vm.createContext(ctx);"
              "vm.runInContext(fs.readFileSync(process.argv[1]+'/Codigo.gs','utf8'),ctx);"
              "const r=ctx.construirFilas_(JSON.parse(fs.readFileSync(process.argv[1]+'/tablas.json','utf8')));"
              "process.stdout.write(JSON.stringify(r));")
        p = subprocess.run(['node', '-e', js, d], capture_output=True, text=True, timeout=120)
    if p.returncode != 0:
        raise RuntimeError('No se pudo armar el resumen: ' + p.stderr[:500])
    return json.loads(p.stdout)


def sincronizar_ventas():
    tablas = _leer_hoja()
    if len(tablas['ventas']) < 2:
        raise RuntimeError('La hoja PIPELINE llegó vacía: no se cambia nada.')
    res = _construir(tablas)
    filas = res['filas']
    antes = int((_sql('select count(*)::int as n from ventas_informe') or [{'n': 0}])[0]['n'])
    # Protección: si de pronto llegan muchas menos ventas, es más probable un error de lectura
    if antes >= 20 and len(filas) < antes * 0.6:
        raise RuntimeError(f'Llegaron {len(filas)} ventas y hay {antes} en la intranet: parece un error de lectura, no se cambia nada.')
    datos = json.dumps(filas, ensure_ascii=False)
    if '$vj$' in datos:
        raise RuntimeError('Texto inesperado en los datos.')
    _sql(f'select aplicar_ventas($vj${datos}$vj$::jsonb) as n')
    tot = _sql("select count(*)::int as n, coalesce(sum(valor),0)::bigint as valor, "
               "coalesce(sum(valor-costo) filter (where estado in ('Confirmada','Facturado')),0)::bigint as utilidad from ventas_informe")[0]
    return {'ventas': tot['n'], 'antes': antes, 'omitidas': res['omitidas'], 'valor_total': tot['valor'], 'utilidad_realizada': tot['utilidad']}
