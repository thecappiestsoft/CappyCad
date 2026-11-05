#!/usr/bin/env bash
# CappyCad — budowanie wersji na macOS (uruchom dwukrotnym kliknięciem w Finderze).
# Wynik w folderze release/: CappyCad-<wersja>-macOS-arm64.zip (Apple M1–M4) i -x64.zip (Intel).
# Aplikacja jest podpisana ad-hoc (bez płatnego certyfikatu Apple) — przy pierwszym uruchomieniu:
# prawy przycisk → Otwórz.
#
# Jeśli macOS nie pozwala uruchomić tego pliku: w Terminalu  chmod +x build-macos.command
# Użycie z Terminala:  ./build-macos.command [--skip-tests]
source "$(dirname "$0")/scripts/launcher-common.sh"

[ "$(uname)" = "Darwin" ] || fail "Ten skrypt działa na macOS. Na Linuksie użyj build-linux.sh."

check_node
install_deps
run_tests

step "Budowanie interfejsu i pakowanie aplikacji macOS (Intel + Apple Silicon)"
npm run dist:mac

finish "$(pwd)/release"
open release
read -r -p "Naciśnij Enter, aby zamknąć okno…" _ || true
