@echo off
title Lazy Terminal — Windows PC Companion
color 0F
cls
echo ======================================================================
echo                 /\_/\  
echo                ( o.o )   Lazy Terminal
echo                 ^> ^ ^<    Windows PC Companion v1.0.0
echo ======================================================================
echo.
echo Launching Lazy Terminal Windows Companion GUI...

cd /d "%~dp0"

if exist "LazyTerminal-Windows-Setup.exe" (
    start "" "LazyTerminal-Windows-Setup.exe"
    exit /b 0
)

where python >nul 2>nul
if %errorlevel% equ 0 (
    start "" python "%~dp0lazy_terminal_companion.py"
    exit /b 0
)

where py >nul 2>nul
if %errorlevel% equ 0 (
    start "" py "%~dp0lazy_terminal_companion.py"
    exit /b 0
)

echo [ERROR] Neither standalone executable nor Python 3 found.
echo Please install Python 3.10+ from https://www.python.org/
pause
exit /b 1
