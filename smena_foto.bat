@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

where powershell >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [!] PowerShell не найден. Нужна Windows 10/11.
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0new_foto\" mkdir "%~dp0new_foto"

echo.
echo  Смена фото из папки new_foto...
echo.

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\replace-photos.ps1"
set "ERR=%ERRORLEVEL%"

echo.
if not "%ERR%"=="0" (
  echo  [!] Готово с ошибкой. Код: %ERR%
) else (
  echo  Можно запускать Запустить_галерею.bat
)
pause
exit /b %ERR%
