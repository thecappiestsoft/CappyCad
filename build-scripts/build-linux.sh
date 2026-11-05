#!/usr/bin/env bash
# CappyCad — budowanie wersji na Linuksa.
# Wynik w folderze release/:
#   .deb (Debian, Ubuntu, Mint), .AppImage (dowolny Linux), .tar.gz,
#   .pkg.tar.xz (Arch, Manjaro) — tylko gdy zainstalowany jest program bsdtar (pakiet libarchive / libarchive-tools).
#
# Użycie:  ./build-linux.sh            (z testem)
#          ./build-linux.sh --skip-tests
source "$(dirname "$0")/scripts/launcher-common.sh"

check_node
install_deps
run_tests

step "Budowanie interfejsu"
npm run build

TARGETS="deb AppImage tar.gz"
if command -v bsdtar >/dev/null 2>&1; then
  TARGETS="$TARGETS pacman"
else
  echo "(pakiet dla Arch Linux pominięty — zainstaluj bsdtar: sudo apt install libarchive-tools / sudo pacman -S libarchive)"
fi

step "Pakowanie: $TARGETS"
npx electron-builder --linux $TARGETS

finish "$(pwd)/release"
