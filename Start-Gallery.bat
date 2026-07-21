@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

where powershell >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [!] PowerShell not found. Need Windows 10/11.
  echo.
  pause
  exit /b 1
)

echo.
echo  Starting gallery...
echo.

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch-gallery.ps1"
set "ERR=%ERRORLEVEL%"

if not "%ERR%"=="0" (
  echo.
  echo  [!] Gallery exited with code %ERR%
  echo  Run again and read the error message above.
  echo.
  pause
  exit /b %ERR%
)

endlocal
