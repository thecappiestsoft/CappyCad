#!/usr/bin/env bash
# Wspólne kroki skryptów budowania dla macOS i Linuksa (dołączane przez build-*.sh / build-*.command).
# Nie uruchamiaj bezpośrednio.
set -euo pipefail

# Przejście do katalogu projektu (folder, w którym leży wywołany skrypt)
cd "$(dirname "$0")"

SKIP_TESTS=0
for arg in "$@"; do
  [ "$arg" = "--skip-tests" ] && SKIP_TESTS=1
done

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$1"; exit 1; }

check_node() {
  step "Sprawdzanie Node.js"
  command -v node >/dev/null 2>&1 || fail "Brak Node.js. Zainstaluj wersję 20 lub nowszą: https://nodejs.org (wersja LTS)."
  local major
  major=$(node -p 'process.versions.node.split(".")[0]')
  [ "$major" -ge 20 ] || fail "Node.js $(node -v) jest za stary — potrzebna wersja 20 lub nowsza: https://nodejs.org"
  echo "Node.js $(node -v), npm $(npm -v)"
}

install_deps() {
  step "Instalowanie zależności (pierwszy raz trwa kilka minut — pobiera m.in. Electron)"
  if [ -d node_modules ]; then
    npm install --no-audit --no-fund
  else
    npm ci --no-audit --no-fund
  fi
}

run_tests() {
  if [ "$SKIP_TESTS" = "1" ]; then
    echo "(test pominięty: --skip-tests)"
    return
  fi
  step "Test dymny (otworzy się okno programu na ok. 15 s)"
  npm test
}

finish() {
  printf '\n\033[1;32m✔ Gotowe. Pliki: %s\033[0m\n' "$1"
}
