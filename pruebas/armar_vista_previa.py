#!/usr/bin/env python3
"""Arma un solo HTML de demostración (Supabase simulado + datos de ejemplo)
para mirar la intranet sin servidor, por ejemplo como artifact de claude.ai.

Uso:  python3 pruebas/armar_vista_previa.py SALIDA.html

Incrusta estilos, simulador, configuración de demostración, app.js y los
logos (como data URI). No sirve para producción: allí se publica index.html.
"""
import base64
import pathlib
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent


def leer(ruta):
    return (RAIZ / ruta).read_text(encoding="utf-8")


def data_svg(ruta):
    return "data:image/svg+xml;base64," + base64.b64encode((RAIZ / ruta).read_bytes()).decode()


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    salida = pathlib.Path(sys.argv[1])
    app = leer("assets/app.js")
    for archivo in ("assets/logo-caminos-blanco.svg", "assets/logo-caminos.svg"):
        app = app.replace(f"'{archivo}'", f"'{data_svg(archivo)}'")
    scripts = [leer("pruebas/supabase-simulado.js"),
               "window.INTRANET_CONFIG = { supabaseUrl: 'https://demo.local', supabaseKey: 'demo', demo: window.SUPABASE_DEMO, sinDescargas: true };",
               app]
    for s in scripts:
        if "</script" in s.lower():
            sys.exit("Un script contiene </script: no se puede incrustar")
    html = f"""<title>Intranet Caminos</title>
<meta name="description" content="Demostración de la intranet de Caminos con datos de ejemplo.">
<meta name="theme-color" content="#F25061">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap">
<style>
{leer("assets/estilos.css")}
{leer("assets/app.css")}
</style>
<div id="app"></div>
""" + "\n".join(f"<script>\n{s}\n</script>" for s in scripts) + "\n"
    salida.write_text(html, encoding="utf-8")
    print(f"{salida}: {len(html.encode()) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
