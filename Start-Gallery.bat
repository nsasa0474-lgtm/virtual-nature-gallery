@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [!] Node.js not found in PATH.
  echo  Install Node.js from https://nodejs.org and try again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [!] npm not found in PATH.
  echo  Reinstall Node.js from https://nodejs.org ^(include npm^).
  echo.
  pause
  exit /b 1
)

echo.
echo  Preparing gallery...
echo.

node "%~dp0scripts\ensure-ready.mjs"
if errorlevel 1 (
  echo.
  echo  [!] Failed to prepare the build.
  echo.
  pause
  exit /b 1
)

echo.
echo  Starting gallery...
echo.

node "%~dp0serve.mjs"
set "ERR=%ERRORLEVEL%"

if not "%ERR%"=="0" (
  echo.
  echo  [!] Server exited with error: %ERR%
  echo.
  pause
  exit /b %ERR%
)

endlocal
