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
echo [1/3] Checking Node.js environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is required to run the PC Companion.
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

echo [2/3] Starting Lazy Terminal Windows Companion daemon...
cd /d "%~dp0\..\.."
start http://localhost:3000

echo [3/3] Launching Host Server on port 3000...
echo.
echo Press Ctrl+C in this window to stop the host server.
echo.
node server.js 2>nul || npx tsx server.ts
pause
