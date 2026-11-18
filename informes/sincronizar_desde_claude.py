# Intranet Caminos · tarea diaria de Claude → Informes de gestión.
# Va COMPLETO dentro de las instrucciones de la tarea programada (no descarga
# nada). Corre en COMPOSIO_REMOTE_WORKBENCH, que trae run_composio_tool().
# 1) LEE la hoja del gestor de reservas (GOOGLESHEETS_BATCH_GET: solo lectura).
# 2) Arma una fila por venta SIN datos personales (misma lógica que Codigo.gs).
# 3) La carga con aplicar_ventas(filas) en Supabase. Si la lectura parece
#    mala (hoja vacía o muchas menos ventas), no cambia nada.
# 4) Extranet de clientes: arma lo que cada cliente ve de SUS ventas (viajeros
#    solo por nombre, servicios sin costos, valor, pagos y comisión) y lo carga
#    con aplicar_extranet(clientes, ventas, cobros).
import json, math, re, unicodedata
from datetime import date

HOJA_ID = '1k32N3e4r5jS0iWvyPWsUGr6XLY7homB5sEhJIj9Bjbg'
PROYECTO = 'psclplnwvfksckogkcrz'
HOJAS = {'ventas': 'PIPELINE', 'servicios': 'SERVICIOS', 'pagos': 'CONTROL_PAGOS', 'pagosProv': 'PAGOS_PROVEEDORES',
         'asesores': 'ASESORES', 'costeos': 'PANEL_DE_COSTEOS', 'proveedores': 'PROVEEDORES',
         'clientes': 'CLIENTES', 'cobros': 'CUENTAS_COBRO_ALIADOS', 'pasajeros': 'PASAJEROS'}
EFECTIVAS = ('Confirmada', 'Facturado')
PERMITIDAS = {'GOOGLESHEETS_BATCH_GET', 'SUPABASE_BETA_RUN_SQL_QUERY'}  # ninguna escribe en Google


def herramienta(nombre, args):
    if nombre not in PERMITIDAS:
        raise RuntimeError('Herramienta no permitida: ' + nombre)
    r, e = run_composio_tool(nombre, args)  # noqa: F821
    if e or (isinstance(r, dict) and r.get('error')):
        raise RuntimeError(f'{nombre}: {e or r.get("error")}')
    return r.get('data', r)


def sql(consulta):
    return herramienta('SUPABASE_BETA_RUN_SQL_QUERY', {'ref': PROYECTO, 'query': consulta}).get('result', [])


def normal(s):
    s = unicodedata.normalize('NFD', '' if s is None else str(s))
    return re.sub(r'[\s_]+', '', ''.join(c for c in s if unicodedata.category(c) != 'Mn')).lower()


def texto(v):
    return '' if v is None else re.sub(r'\s+', ' ', str(v)).strip()


def redondo(n, d=2):
    return math.floor(n * 10 ** d + 0.5) / 10 ** d


def num(v):
    if isinstance(v, bool):
        return 0.0
    if isinstance(v, (int, float)):
        return float(v) if math.isfinite(v) else 0.0
    s = re.sub(r'[^\d.,-]', '', texto(v))
    if not s:
        return 0.0
    coma, punto = s.rfind(','), s.rfind('.')
    if coma > -1 and punto > -1:
        s = s.replace('.', '').replace(',', '.', 1) if coma > punto else s.replace(',', '')
    elif coma > -1:
        s = s.replace(',', '') if re.match(r'^-?\d{1,3}(,\d{3})+$', s) else s.replace(',', '.', 1)
    elif s.count('.') > 1 or re.match(r'^\d{1,3}\.\d{3}$', s):
        s = s.replace('.', '')
    m = re.match(r'^-?(\d+\.?\d*|\.\d+)', s)
    return float(m.group(0)) if m else 0.0


def valida(a, m, d):
    try:
        f = date(a, m, d)
    except ValueError:
        return None
    return f.isoformat() if 2000 <= a <= 2100 else None


def fecha(v):
    s = texto(v)
    m = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})', s)
    if m:
        return valida(int(m[3]), int(m[2]), int(m[1]))
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', s)
    return valida(int(m[1]), int(m[2]), int(m[3])) if m else None


def capital(s):
    s = s.lower()
    return s[:1].upper() + s[1:]


def recorrer(tabla):
    # Cada fila como función: f('Col1', 'Col2') = el primer valor no vacío de esas columnas
    if not tabla or len(tabla) < 2:
        return
    pos = {}
    for i, h in enumerate(tabla[0]):
        pos[normal(h)] = i
    for fila in tabla[1:]:
        def f(*nombres, fila=fila):
            for n in nombres:
                i = pos.get(normal(n))
                if i is not None and i < len(fila) and fila[i] not in ('', None):
                    return fila[i]
            return ''
        yield f


def indice(tabla, claves, valores):
    m = {}
    for f in recorrer(tabla):
        k, v = texto(f(*claves)), texto(f(*valores))
        if k and v:
            m[k.lower() if k.find('@') > 0 else k] = v
    return m


def construir_filas(t):
    asesores = indice(t['asesores'], ['Email', 'Correo'], ['Nombre'])
    planes = indice(t['costeos'], ['ID_Costeo'], ['Nombre_Plan'])
    proveedores = indice(t['proveedores'], ['ID Proveedor', 'ID_Proveedor'], ['Nombre Comercial', 'Razón Social'])
    por_venta = {}
    nuevo = lambda: {'valor': 0.0, 'costo': 0.0, 'tipos': {}, 'prov': {}, 'cobrado': 0.0, 'pagadoProv': 0.0}
    for f in recorrer(t['servicios']):
        vid = texto(f('ID_Venta'))
        if not vid:
            continue
        v = por_venta.setdefault(vid, nuevo())
        valor, costo = num(f('Gran_Total_Servicio', 'Gran_Total')), num(f('Total Proveedor', 'Total_Proveedor'))
        v['valor'] += valor
        v['costo'] += costo
        tipo = texto(f('Tipo_Servicio')) or 'Otros'
        tp = v['tipos'].setdefault(tipo, {'valor': 0.0, 'costo': 0.0})
        tp['valor'] += valor
        tp['costo'] += costo
        id_prov = texto(f('Proveedor'))
        if id_prov and costo:
            nombre = proveedores.get(id_prov) or 'Proveedor ' + id_prov[:6]
            v['prov'][nombre] = v['prov'].get(nombre, 0.0) + costo
    for f in recorrer(t['pagos']):
        vid, estado = texto(f('ID_Venta')), texto(f('Estado_Pago')).upper()
        if not vid or estado in ('ANULADO', 'PENDIENTE'):
            continue
        v = por_venta.setdefault(vid, nuevo())
        v['cobrado'] += num(f('Abono_Equivalente_COP')) or num(f('Monto'))
    for f in recorrer(t['pagosProv']):
        vid = texto(f('ID_Venta'))
        if not vid or texto(f('Estado_Pago_Prov')).lower() != 'pagado':
            continue
        v = por_venta.setdefault(vid, nuevo())
        v['pagadoProv'] += num(f('Monto')) or num(f('Costo_Neto'))
    filas, omitidas, vistos = [], 0, set()
    for f in recorrer(t['ventas']):
        vid, fe, estado = texto(f('ID_Venta')), fecha(f('Fecha_Registro')), texto(f('Estado'))
        if not vid or not fe or not estado or vid in vistos:
            if vid or estado:
                omitidas += 1
            continue
        vistos.add(vid)
        correo = texto(f('Agente')).lower()
        s = por_venta.get(vid) or nuevo()
        plan = texto(f('Paquete_Religioso'))
        filas.append({
            'id': vid[:60], 'asesora': (asesores.get(correo) or correo.split('@')[0] or '')[:80], 'fecha': fe,
            'estado': estado[:40], 'tipo_venta': texto(f('Tipo_Venta'))[:60], 'tipo_viaje': capital(texto(f('Tipo_De_Viaje')))[:40],
            'destino': texto(f('Destino'))[:120], 'plan': (planes.get(plan, '') if plan else '')[:160],
            'salida': fecha(f('Fecha_Ida')), 'regreso': fecha(f('Fecha_Regreso')),
            'pasajeros': max(0, min(10000, math.floor(num(f('Numero_Pasajeros_Estimados')) + 0.5))),
            'valor': redondo(s['valor']), 'costo': redondo(s['costo']), 'cobrado': redondo(s['cobrado']), 'pagado_prov': redondo(s['pagadoProv']),
            'seguimiento': (texto(f('Estado_Segundo_Seguimiento')) or texto(f('Estado_Pimer_Seguimiento', 'Estado_Primer_Seguimiento')))[:120],
            'servicios': [{'tipo': k[:60], 'valor': redondo(x['valor']), 'costo': redondo(x['costo'])} for k, x in s['tipos'].items()],
            'proveedores': [{'nombre': k[:80], 'costo': redondo(x)} for k, x in s['prov'].items()],
        })
    return filas, omitidas


def pct(v):
    # «10.00%» o 0.1 → 0.1; vacío → None
    t = texto(v)
    if not t:
        return None
    n = num(v)
    return redondo(n / 100 if ('%' in t or n > 1) else n, 4)


def construir_extranet(t):
    clientes = {}
    for f in recorrer(t['clientes']):
        cid = texto(f('ID_Cliente'))
        if not cid or cid in clientes:
            continue
        clientes[cid] = {'id': cid[:60], 'nombre': texto(f('Nombre_Empresa'))[:160], 'contacto': texto(f('Contacto'))[:160],
                         'correo': texto(f('Email')).lower()[:200], 'tipo': texto(f('Tipo_Cliente'))[:60],
                         'pct_terrestre': pct(f('Pct_Comision_Terrestre')), 'part_ta': pct(f('Part_TA_Aliado')),
                         'modalidad': texto(f('Modalidad_Comision_Default'))[:60]}
    nombres = {texto(f('ID_Pasajero')): texto(f('Nombre_Completo')) for f in recorrer(t['pasajeros']) if texto(f('ID_Pasajero'))}
    planes = indice(t['costeos'], ['ID_Costeo'], ['Nombre_Plan'])
    por_venta = {}
    for f in recorrer(t['servicios']):
        vid = texto(f('ID_Venta'))
        if not vid:
            continue
        v = por_venta.setdefault(vid, {'valor': 0.0, 'terrestre': 0.0, 'ta': 0.0, 'serv': {}, 'pax': []})
        valor = num(f('Gran_Total_Servicio', 'Gran_Total'))
        tipo = texto(f('Tipo_Servicio')) or 'Otros'
        v['valor'] += valor
        v['ta'] += num(f('Total TA', 'Total_TA'))
        if normal(tipo) == 'planterrestre':
            v['terrestre'] += valor
        detalle = ' · '.join(x for x in (texto(f('Ruta')), texto(f('Aerolínea')).replace(',', ', '), texto(f('Hotel_Seleccionado')),
                                         texto(f('Tipo_Acomodacion'))) if x)[:160]
        k = (tipo, detalle)
        v['serv'][k] = v['serv'].get(k, 0) + 1
        pid = texto(f('ID_Pasajero'))
        if pid and pid not in v['pax']:
            v['pax'].append(pid)
    cobrado = {}
    for f in recorrer(t['pagos']):
        vid, estado = texto(f('ID_Venta')), texto(f('Estado_Pago')).upper()
        if vid and estado not in ('ANULADO', 'PENDIENTE'):
            cobrado[vid] = cobrado.get(vid, 0.0) + (num(f('Abono_Equivalente_COP')) or num(f('Monto')))
    ventas, vistos = [], set()
    for f in recorrer(t['ventas']):
        vid, cid, fe, estado = texto(f('ID_Venta')), texto(f('ID_Cliente')), fecha(f('Fecha_Registro')), texto(f('Estado'))
        if not vid or not fe or not estado or cid not in clientes or vid in vistos:
            continue
        vistos.add(vid)
        s = por_venta.get(vid) or {'valor': 0.0, 'terrestre': 0.0, 'ta': 0.0, 'serv': {}, 'pax': []}
        ids = [x.strip() for x in re.split(r'[,;]', texto(f('Pasajeros_Viajando'))) if x.strip()] or s['pax']
        viajeros = [nombres[i][:120] for i in ids if nombres.get(i)][:60]
        c = clientes[cid]
        p_terr = pct(f('Pct_Comision_Terrestre_Venta'))
        p_ta = pct(f('Part_TA_Venta'))
        p_terr = c['pct_terrestre'] if p_terr is None else p_terr
        p_ta = c['part_ta'] if p_ta is None else p_ta
        comision = (p_terr or 0) * s['terrestre'] + (p_ta or 0) * s['ta'] if estado in EFECTIVAS else 0.0
        ventas.append({
            'id': vid[:60], 'cliente_id': cid, 'fecha': fe, 'estado': estado[:40], 'tipo_venta': texto(f('Tipo_Venta'))[:60],
            'tipo_viaje': capital(texto(f('Tipo_De_Viaje')))[:40], 'destino': texto(f('Destino'))[:120],
            'plan': planes.get(texto(f('Paquete_Religioso')), '')[:160], 'salida': fecha(f('Fecha_Ida')), 'regreso': fecha(f('Fecha_Regreso')),
            'pasajeros': max(len(viajeros), math.floor(num(f('Numero_Pasajeros_Estimados')) + 0.5)),
            'viajeros': viajeros,
            'servicios': [{'tipo': k[0][:60], 'detalle': k[1], 'cantidad': n} for k, n in s['serv'].items()],
            'valor': redondo(s['valor']), 'cobrado': redondo(cobrado.get(vid, 0.0)), 'comision': redondo(comision),
        })
    cobros = []
    for f in recorrer(t['cobros']):
        ccid, cid = texto(f('ID_Cuenta')), texto(f('ID_Cliente'))
        if ccid and cid in clientes:
            cobros.append({'id': ccid[:60], 'cliente_id': cid, 'periodo': texto(f('Periodo'))[:80], 'desde': fecha(f('Fecha_Inicio')),
                           'hasta': fecha(f('Fecha_Corte')), 'ventas': math.floor(num(f('Cantidad_Ventas')) + 0.5),
                           'total': redondo(num(f('Total_Comision'))), 'estado': texto(f('Estado'))[:40], 'enviada': fecha(f('Fecha_Envio'))})
    return list(clientes.values()), ventas, cobros


def sincronizar_extranet(t):
    clientes, ventas, cobros = construir_extranet(t)
    antes = int((sql('select count(*)::int as n from clientes_ext') or [{'n': 0}])[0]['n'])
    if antes >= 3 and len(clientes) < antes * 0.6:
        raise RuntimeError(f'Llegaron {len(clientes)} clientes y hay {antes}: parece un error de lectura, la extranet no se cambia.')
    datos = [json.dumps(x, ensure_ascii=False) for x in (clientes, ventas, cobros)]
    if any('$vj$' in d for d in datos):
        raise RuntimeError('Texto inesperado en los datos.')
    sql('select aplicar_extranet($vj${}$vj$::jsonb, $vj${}$vj$::jsonb, $vj${}$vj$::jsonb) as r'.format(*datos))
    return {'clientes': len(clientes), 'ventas_clientes': len(ventas), 'cuentas_cobro': len(cobros)}


def leer_hoja():
    d = herramienta('GOOGLESHEETS_BATCH_GET', {'spreadsheet_id': HOJA_ID, 'ranges': [f'{h}!A1:ZZ50000' for h in HOJAS.values()]})
    por_nombre = {vr.get('range', '').split('!')[0].strip("'"): vr.get('values', []) for vr in d.get('valueRanges', [])}
    return {k: por_nombre.get(h, []) for k, h in HOJAS.items()}


def sincronizar_ventas():
    t = leer_hoja()
    if len(t['ventas']) < 2:
        raise RuntimeError('La hoja PIPELINE llegó vacía: no se cambia nada.')
    filas, omitidas = construir_filas(t)
    antes = int((sql('select count(*)::int as n from ventas_informe') or [{'n': 0}])[0]['n'])
    if antes >= 20 and len(filas) < antes * 0.6:
        raise RuntimeError(f'Llegaron {len(filas)} ventas y hay {antes} en la intranet: parece un error de lectura, no se cambia nada.')
    datos = json.dumps(filas, ensure_ascii=False)
    if '$vj$' in datos:
        raise RuntimeError('Texto inesperado en los datos.')
    sql(f'select aplicar_ventas($vj${datos}$vj$::jsonb) as n')
    tot = sql("select count(*)::int as n, coalesce(sum(valor),0)::bigint as valor, coalesce(sum(valor-costo) filter "
              "(where estado in ('Confirmada','Facturado')),0)::bigint as utilidad from ventas_informe")[0]
    res = {'ventas': tot['n'], 'antes': antes, 'omitidas': omitidas, 'valor_total': tot['valor'], 'utilidad_realizada': tot['utilidad']}
    try:
        res['extranet'] = sincronizar_extranet(t)
    except Exception as e:  # la extranet no frena los informes de gestión
        res['extranet_error'] = str(e)[:300]
    return res


print(sincronizar_ventas())
