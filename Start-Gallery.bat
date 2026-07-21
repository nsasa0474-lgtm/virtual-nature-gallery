@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

if not exist "%~dp0dist\index.html" (
  echo.
  echo  [!] Missing gallery build: dist\index.html
  echo  Download a fresh ZIP from GitHub.
  echo.
  pause
  exit /b 1
)

where powershell >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [!] PowerShell not found. Need Windows 10/11.
  echo.
  pause
  exit /b 1
)

echo.
echo  Preparing photos...
echo.

if not exist "%~dp0dist\photos\" mkdir "%~dp0dist\photos"
if not exist "%~dp0dist\secret\" mkdir "%~dp0dist\secret"
robocopy "%~dp0public\photos" "%~dp0dist\photos" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul
robocopy "%~dp0public\secret" "%~dp0dist\secret" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul
if errorlevel 8 (
  echo  [!] Failed to copy photos into dist\
  pause
  exit /b 1
)

echo  Starting gallery (browser opens automatically)...
echo  Close this window to stop.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve-gallery.ps1" -Port 8765 -Root "%~dp0dist"
set "ERR=%ERRORLEVEL%"

if not "%ERR%"=="0" (
  echo.
  echo  [!] Failed to start. Code: %ERR%
  echo.
  pause
  exit /b %ERR%
)

endlocal
