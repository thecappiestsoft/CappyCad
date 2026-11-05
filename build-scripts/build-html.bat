@echo off
rem CappyCad — sklada caly program w JEDEN plik HTML: dist\CappyCad.html
rem Plik dziala offline w kazdej nowej przegladarce: z dysku, pendrive'a lub serwera WWW.
rem
rem Uzycie z wiersza polecen:  build-html.bat [--artifact]
rem   --artifact  dodatkowo dist\CappyCad-artifact.html (do publikacji jako strona w Claude)
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Brak Node.js. Zainstaluj wersje 20 lub nowsza ^(LTS^): https://nodejs.org
  goto :error
)

echo === Instalowanie zaleznosci ===
if exist node_modules (
  call npm install --no-audit --no-fund || goto :error
) else (
  call npm ci --no-audit --no-fund || goto :error
)

echo === Skladanie pliku HTML ===
if /i "%~1"=="--artifact" (
  call npm run build:html -- --artifact || goto :error
) else (
  call npm run build:html || goto :error
)

echo.
echo Gotowe: %CD%\dist\CappyCad.html
start "" "%CD%\dist"
pause
exit /b 0

:error
echo.
echo BLAD - przerwano. Przeczytaj komunikat powyzej.
pause
exit /b 1
