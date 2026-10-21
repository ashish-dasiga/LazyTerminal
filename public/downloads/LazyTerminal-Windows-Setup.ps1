# Lazy Terminal — Windows PC Companion Launcher
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  /\_/\  " -ForegroundColor White
Write-Host " ( o.o )   Lazy Terminal" -ForegroundColor White
Write-Host "  > ^ <    Windows PC Companion v1.0.0" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is required to run the PC Companion." -ForegroundColor Red
    Write-Host "Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/2] Opening browser to Lazy Terminal..." -ForegroundColor Green
Start-Process "http://localhost:3000"

Write-Host "[2/2] Starting Host Companion Server on port 3000..." -ForegroundColor Green
Write-Host "Press Ctrl+C to terminate the companion daemon.`n" -ForegroundColor DarkGray

npx tsx server.ts
