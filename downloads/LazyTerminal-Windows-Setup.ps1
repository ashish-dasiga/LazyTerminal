# Lazy Terminal — Windows PC Companion Launcher
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  /\_/\  " -ForegroundColor White
Write-Host " ( o.o )   Lazy Terminal" -ForegroundColor White
Write-Host "  > ^ <    Windows PC Companion v1.0.0" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (Test-Path "$scriptDir\LazyTerminal-Windows-Setup.exe") {
    Write-Host "Launching Native Windows Companion Host..." -ForegroundColor Green
    Start-Process "$scriptDir\LazyTerminal-Windows-Setup.exe"
    exit 0
}

if (Test-Path "$scriptDir\LazyTerminal-Windows-Host.exe") {
    Write-Host "Launching Native Windows Companion Host..." -ForegroundColor Green
    Start-Process "$scriptDir\LazyTerminal-Windows-Host.exe"
    exit 0
}

if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "Launching Host Companion via npm..." -ForegroundColor Green
    npm run host
    exit 0
}

Write-Host "[ERROR] Standalone executable not found and Node.js/npm not detected." -ForegroundColor Red
Write-Host "Please download LazyTerminal-Windows-Setup.exe or install Node.js 20+ from https://nodejs.org/" -ForegroundColor Yellow
pause
