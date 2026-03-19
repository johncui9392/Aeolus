# Aeolus Python environment bootstrap

$repoRoot = $PSScriptRoot
$pythonDir = Join-Path $repoRoot "python"
$venvDir = Join-Path $pythonDir "venv"
$requirementsFile = Join-Path $pythonDir "requirements.txt"
$venvPython = Join-Path $venvDir "Scripts\python.exe"

Write-Host "Initializing Aeolus Python environment..." -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $requirementsFile)) {
    Write-Host "Requirements file not found: $requirementsFile" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Path $pythonDir -Force | Out-Null

$hasPyLauncher = $null -ne (Get-Command py -ErrorAction SilentlyContinue)
$hasPythonCmd = $null -ne (Get-Command python -ErrorAction SilentlyContinue)

if (-not $hasPyLauncher -and -not $hasPythonCmd) {
    Write-Host "Python 3.10+ was not found. Please install Python first." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $venvPython)) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    if ($hasPyLauncher) {
        & py -3 -m venv $venvDir
    }
    else {
        & python -m venv $venvDir
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create virtual environment." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Upgrading pip..." -ForegroundColor Yellow
& $venvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to upgrade pip." -ForegroundColor Red
    exit 1
}

Write-Host "Installing shared dependencies..." -ForegroundColor Yellow
& $venvPython -m pip install -r $requirementsFile
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install Python dependencies." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Python environment is ready." -ForegroundColor Green
Write-Host "Python: $venvPython" -ForegroundColor Green
