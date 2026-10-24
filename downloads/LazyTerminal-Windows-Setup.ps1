# Lazy Terminal — Windows PC Companion Launcher
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  /\_/\  " -ForegroundColor White
Write-Host " ( o.o )   Lazy Terminal" -ForegroundColor White
Write-Host "  > ^ <    Windows PC Companion v1.0.0" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (Test-Path "$scriptDir\LazyTerminal-Windows-Setup.exe") {
    Write-Host "Launching Native Windows Companion GUI..." -ForegroundColor Green
    Start-Process "$scriptDir\LazyTerminal-Windows-Setup.exe"
    exit 0
}

if (Get-Command python -ErrorAction SilentlyContinue) {
    Write-Host "Launching Python Tkinter Companion GUI..." -ForegroundColor Green
    Start-Process python -ArgumentList "`"$scriptDir\lazy_terminal_companion.py`""
    exit 0
}

Write-Host "[ERROR] Neither standalone executable nor Python 3 found." -ForegroundColor Red
Write-Host "Please download the .EXE installer or install Python 3.10+ from https://www.python.org/" -ForegroundColor Yellow
pause
