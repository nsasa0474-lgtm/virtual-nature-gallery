@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

if not exist "%~dp0dist\index.html" (
  echo.
  echo  [!] Не найдена готовая галерея: dist\index.html
  echo  Скачайте свежий ZIP с GitHub или попросите автора обновить репозиторий.
  echo.
  pause
  exit /b 1
)

where powershell >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [!] PowerShell не найден. Нужна обычная Windows 10/11.
  echo.
  pause
  exit /b 1
)

echo.
echo  Подготовка фото…
echo.

REM Фото лежат в public\ — копируем в dist\ перед запуском (Node.js не нужен)
if not exist "%~dp0dist\photos\" mkdir "%~dp0dist\photos"
if not exist "%~dp0dist\secret\" mkdir "%~dp0dist\secret"
robocopy "%~dp0public\photos" "%~dp0dist\photos" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul
robocopy "%~dp0public\secret" "%~dp0dist\secret" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul
if errorlevel 8 (
  echo  [!] Не удалось скопировать фото в dist\
  pause
  exit /b 1
)

echo  Запуск галереи (браузер откроется сам)...
echo  Закройте это окно, чтобы остановить.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve-gallery.ps1" -Port 8765 -Root "%~dp0dist"
set "ERR=%ERRORLEVEL%"

if not "%ERR%"=="0" (
  echo.
  echo  [!] Не удалось запустить. Код: %ERR%
  echo.
  pause
  exit /b %ERR%
)

endlocal
