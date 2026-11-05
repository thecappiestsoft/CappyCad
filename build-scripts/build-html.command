#!/usr/bin/env bash
# CappyCad — jeden plik HTML (macOS: uruchom dwukrotnym kliknięciem w Finderze).
# Wynik: dist/CappyCad.html. Szczegóły w build-html.sh.
"$(dirname "$0")/build-html.sh" "$@"
status=$?
[ $status -eq 0 ] && open "$(dirname "$0")/dist"
read -r -p "Naciśnij Enter, aby zamknąć okno…" _ || true
exit $status
