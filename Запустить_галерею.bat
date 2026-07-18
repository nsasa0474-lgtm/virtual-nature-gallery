@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

if not exist "%~dp0dist\index.html" (
  echo.
  echo  [!] Сборка не найдена: dist\index.html
  echo.
  echo  Один раз выполните в этой папке:
  echo    npm install
  echo    npm run download-photos
  echo    npm run build
  echo.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [!] Node.js не найден в PATH.
  echo  Установите Node.js с https://nodejs.org и повторите запуск.
  echo.
  pause
  exit /b 1
)

echo.
echo  Запуск галереи...
echo.

node "%~dp0serve.mjs"
set "ERR=%ERRORLEVEL%"

if not "%ERR%"=="0" (
  echo.
  echo  [!] Сервер завершился с ошибкой: %ERR%
  echo.
  pause
  exit /b %ERR%
)

endlocal
