@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [!] Node.js не найден в PATH.
  echo  Установите Node.js с https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0new_foto\" (
  mkdir "%~dp0new_foto"
)

echo.
echo  Смена фото галереи из папки new_foto…
echo.

node "%~dp0scripts\replace-photos.mjs"
set "ERR=%ERRORLEVEL%"

echo.
pause
exit /b %ERR%
