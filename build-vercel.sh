#!/usr/bin/env bash
# Construcción para Vercel: junta los aportes aprobados, descarga fuentes y mapa,
# y copia el sitio a dist/ (lo que Vercel publica).
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/compilar-aportes.mjs
bash scripts/preparar-recursos.sh || echo "Aviso: no se pudieron preparar fuentes/mapa; el sitio funciona igual."
rm -rf dist && mkdir dist
for f in index.html 404.html robots.txt css js data img libros vendor; do
  [ -e "$f" ] && cp -r "$f" dist/
done
echo "Sitio listo en dist/"
