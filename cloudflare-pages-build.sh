#!/usr/bin/env bash
# Cloudflare Pages: publikuj wyłącznie pliki strony i publiczne księgi.
# backend/ oraz pliki konfiguracyjne Workera nie są kopiowane na stronę.
set -euo pipefail

mkdir -p dist
cp   index.html app.js styles.css spine.css manuscript-themes.css   biblioteka.html biblioteka.js biblioteka.css   zarzadzanie.html panel.js panel.css   api-config.js   dist/

# Publiczny katalog kronik i treści — wymagane w bibliotece.
cp -R books dist/

# Opcjonalne publiczne obrazy / zasoby graficzne, jeśli zostaną dodane.
if [ -d assets ]; then
  cp -R assets dist/
fi

printf 'Cloudflare Pages: gotowe, pliki publiczne zapisano w dist/\n'
