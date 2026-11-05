@echo off
rem CappyCad — budowanie wersji na Windows (uruchom dwukrotnym kliknięciem).
rem Wynik w folderze release\:
rem   CappyCad-<wersja>-Windows-Setup.exe       instalator (skrót w menu Start, pliki .cappycad)
rem   CappyCad-<wersja>-Windows-x64-portable.zip wersja bez instalacji
rem
rem Użycie z wiersza poleceń:  build-windows.bat [--skip-tests]
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo === Sprawdzanie Node.js ===
where node >nul 2>nul
if errorlevel 1 (
  echo Brak Node.js. Zainstaluj wersje 20 lub nowsza ^(LTS^): https://nodejs.org
  goto :error
)
for /f "delims=." %%v in ('node -p "process.versions.node"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
  echo Node.js jest za stary - potrzebna wersja 20 lub nowsza: https://nodejs.org
  goto :error
)
node -v

echo.
echo === Instalowanie zaleznosci (pierwszy raz trwa kilka minut) ===
if exist node_modules (
  call npm install --no-audit --no-fund || goto :error
) else (
  call npm ci --no-audit --no-fund || goto :error
)

if /i "%~1"=="--skip-tests" (
  echo ^(test pominiety: --skip-tests^)
) else (
  echo.
  echo === Test dymny ^(otworzy sie okno programu na ok. 15 s^) ===
  call npm test || goto :error
)

echo.
echo === Budowanie instalatora i wersji przenosnej ===
call npm run dist:win || goto :error

echo.
echo Gotowe. Pliki sa w folderze: %CD%\release
start "" "%CD%\release"
pause
exit /b 0

:error
echo.
echo BLAD - budowanie przerwane. Przeczytaj komunikat powyzej.
pause
exit /b 1
