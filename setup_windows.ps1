$ErrorActionPreference = 'Stop'
Write-Host '=== Hotel Performance System setup ===' -ForegroundColor Cyan
Set-Location $PSScriptRoot

if (!(Test-Path '.\backend\venv')) {
  Set-Location '.\backend'
  python -m venv venv
  Set-Location '..'
}

& '.\backend\venv\Scripts\python.exe' -m pip install --upgrade pip
& '.\backend\venv\Scripts\python.exe' -m pip install -r '.\backend\requirements.txt'

if (!(Test-Path '.\backend\.env')) { Copy-Item '.\backend\.env.example' '.\backend\.env' }

Set-Location '.\frontend'
npm install
Set-Location '..'

Write-Host 'Setup completed.' -ForegroundColor Green
Write-Host 'Run backend:  .\run_backend.ps1'
Write-Host 'Run frontend: .\run_frontend.ps1'
