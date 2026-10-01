#!/usr/bin/env bash
# Descarga las fuentes y Leaflet para servirlos desde el propio sitio
# (sin Google Fonts ni CDNs: nadie externo ve las visitas).
# Lo ejecuta automáticamente la acción de GitHub al publicar.
# Para probar en tu computadora: bash scripts/preparar-recursos.sh
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
(
  cd "$TMP"
  npm init -y >/dev/null
  npm install --no-audit --no-fund --silent \
    leaflet@1.9.4 \
    @fontsource/cormorant-garamond@5 \
    @fontsource/inter@5 \
    @fontsource/literata@5
)
rm -rf vendor && mkdir -p vendor/leaflet vendor/fonts
cp -r "$TMP/node_modules/leaflet/dist/"* vendor/leaflet/
for f in cormorant-garamond inter literata; do
  mkdir -p "vendor/fonts/$f"
  cp -r "$TMP/node_modules/@fontsource/$f/files" "vendor/fonts/$f/"
  cp "$TMP/node_modules/@fontsource/$f/"*.css "vendor/fonts/$f/"
done
cat > vendor/fonts.css <<'CSS'
@import url("fonts/inter/400.css");
@import url("fonts/inter/500.css");
@import url("fonts/inter/600.css");
@import url("fonts/inter/700.css");
@import url("fonts/cormorant-garamond/500.css");
@import url("fonts/cormorant-garamond/600.css");
@import url("fonts/cormorant-garamond/500-italic.css");
@import url("fonts/literata/400.css");
@import url("fonts/literata/500.css");
@import url("fonts/literata/400-italic.css");
CSS
echo "Recursos listos en vendor/"
