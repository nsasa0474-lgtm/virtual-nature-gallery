@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

where powershell >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [!] PowerShell не найден.
  echo  Нужна обычная Windows 10 или 11.
  echo.
  pause
  exit /b 1
)

echo.
echo  Запуск галереи...
echo.

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch-gallery.ps1"
set "ERR=%ERRORLEVEL%"

if not "%ERR%"=="0" (
  echo.
  echo  [!] Галерея завершилась с кодом %ERR%
  echo  Если окно сразу закрылось - запустите Start-Gallery.bat
  echo  и прочитайте текст ошибки выше.
  echo.
  pause
  exit /b %ERR%
)

endlocal
