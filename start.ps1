# Aeolus start script

$repoRoot = $PSScriptRoot
$localKeyFile = Join-Path $repoRoot "EM_API_KEY.local"
$sharedPython = Join-Path $repoRoot "python\venv\Scripts\python.exe"
$hasEnvKey = -not [string]::IsNullOrWhiteSpace($env:EM_API_KEY)
$hasLocalKey = $false

Write-Host "Starting Aeolus..." -ForegroundColor Cyan
Write-Host ""

if (Test-Path $localKeyFile) {
    $localLines = Get-Content $localKeyFile | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith("#") }
    foreach ($line in $localLines) {
        if ($line -match "=") {
            $parts = $line.Split("=", 2)
            if ($parts.Count -eq 2 -and -not [string]::IsNullOrWhiteSpace($parts[1])) {
                $hasLocalKey = $true
                break
            }
        }
        elseif (-not [string]::IsNullOrWhiteSpace($line)) {
            $hasLocalKey = $true
            break
        }
    }
}

if (-not $hasEnvKey -and -not $hasLocalKey) {
    Write-Host "No usable API key found." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please configure an API key first:" -ForegroundColor Yellow
    Write-Host "  1. Copy EM_API_KEY.local.example to EM_API_KEY.local" -ForegroundColor Green
    Write-Host "  2. Edit EM_API_KEY.local and set: default=your_em_api_key" -ForegroundColor Green
    Write-Host ""
    Write-Host "Or set it in the current terminal:" -ForegroundColor Yellow
    Write-Host '  $env:EM_API_KEY="your_em_api_key"' -ForegroundColor Green
    Write-Host ""
    exit 1
}

if ($hasEnvKey) {
    Write-Host "Detected EM_API_KEY in environment." -ForegroundColor Green
}
else {
    Write-Host "Detected EM_API_KEY.local." -ForegroundColor Green
}
Write-Host ""

$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Node.js was not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}
Write-Host "Node.js: $nodeVersion" -ForegroundColor Green

$pnpmVersion = pnpm --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "pnpm was not found. Please install pnpm first." -ForegroundColor Red
    exit 1
}
Write-Host "pnpm: $pnpmVersion" -ForegroundColor Green
Write-Host ""

if (-not (Test-Path $sharedPython)) {
    Write-Host "Shared Python environment not found." -ForegroundColor Red
    Write-Host "Run .\setup-python.ps1 first." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
Write-Host "Detected shared Python environment." -ForegroundColor Green
Write-Host ""

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Dependency installation failed." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host ""

pnpm run dev
