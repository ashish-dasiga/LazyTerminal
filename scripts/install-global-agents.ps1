# Optional: copy the shared agent definitions into your Windows Antigravity global agent directory.
# Run from the extracted pack root in PowerShell. This does not replace repository-level rules.
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot '..\.agents\agents'
$target = Join-Path $HOME '.gemini\config\agents'
if (-not (Test-Path $source)) { throw "Could not find agent definitions at: $source" }
New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item -Path (Join-Path $source '*') -Destination $target -Recurse -Force
Write-Host "Copied Lazy Terminal agents to $target"
Write-Host "Open Antigravity CLI and run /agents to verify discovery."
Write-Host "Project-specific rules still belong in the Lazy Terminal repository."
