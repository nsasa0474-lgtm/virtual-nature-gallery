@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

if not exist "%~dp0new_foto\" mkdir "%~dp0new_foto"

echo.
echo  Смена фото галереи из папки new_foto…
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\replace-photos.ps1"
set "ERR=%ERRORLEVEL%"

echo.
pause
exit /b %ERR%
