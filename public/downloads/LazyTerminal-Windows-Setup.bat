@echo off
title Lazy Terminal — Windows PC Companion
color 0F
cls
echo ======================================================================
echo                 /\_/\  
echo                ( o.o )   Lazy Terminal
echo                 > ^ <    Windows PC Companion v1.0.0
echo ======================================================================
echo.
echo Launching Lazy Terminal Windows Companion...

cd /d "%~dp0"

if exist "LazyTerminal-Windows-Setup.exe" (
    start "" "LazyTerminal-Windows-Setup.exe"
    exit /b 0
)

if exist "LazyTerminal-Windows-Host.exe" (
    start "" "LazyTerminal-Windows-Host.exe"
    exit /b 0
)

where npm >nul 2>nul
if %errorlevel% equ 0 (
    npm run host
    exit /b 0
)

where node >nul 2>nul
if %errorlevel% equ 0 (
    if exist "companionServer.cjs" (
        node "companionServer.cjs"
        exit /b 0
    )
)

echo [ERROR] Standalone executable not found and Node.js/npm not detected.
echo Please run LazyTerminal-Windows-Setup.exe or install Node.js 20+ from https://nodejs.org/
pause
exit /b 1
