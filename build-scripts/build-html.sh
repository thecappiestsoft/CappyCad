#!/usr/bin/env bash
# CappyCad — składa cały program w JEDEN plik HTML: dist/CappyCad.html
# Plik działa offline w każdej nowej przeglądarce: z dysku, pendrive'a lub serwera WWW.
# Działa na Linuksie i macOS (na macOS można też kliknąć build-html.command).
#
# Użycie:  ./build-html.sh
#          ./build-html.sh --artifact   (dodatkowo dist/CappyCad-artifact.html — do publikacji jako strona w Claude)
source "$(dirname "$0")/scripts/launcher-common.sh"

check_node
install_deps

step "Składanie pliku HTML"
EXTRA=""
for arg in "$@"; do [ "$arg" = "--artifact" ] && EXTRA="-- --artifact"; done
npm run build:html $EXTRA

finish "$(pwd)/dist/CappyCad.html"
