# Aeolus start script

# 强制终端使用 UTF-8，解决中文乱码
chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$repoRoot = $PSScriptRoot
$localKeyFile = Join-Path $repoRoot "EM_API_KEY.local"
$windKeyFile = Join-Path $repoRoot "WIND_API_KEY.local"
$sharedPython = Join-Path $repoRoot "python\venv\Scripts\python.exe"
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$hasEnvKey = -not [string]::IsNullOrWhiteSpace($env:EM_API_KEY)
$hasWindEnvKey = -not [string]::IsNullOrWhiteSpace($env:WIND_API_KEY)
$hasLocalKey = $false
$hasWindLocalKey = $false

Write-Host "Aeolus" -ForegroundColor Cyan
Write-Host "Financial Skill Platform" -ForegroundColor DarkCyan
Write-Host ""

# ── API Key 检查 ───────────────────────────────────────────
function Test-KeyFile($path) {
    if (-not (Test-Path $path)) { return $false }
    $lines = Get-Content $path -Encoding UTF8 | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith("#") }
    foreach ($line in $lines) {
        if ($line -match "=") {
            $parts = $line.Split("=", 2)
            if ($parts.Count -eq 2 -and -not [string]::IsNullOrWhiteSpace($parts[1])) { return $true }
        } elseif (-not [string]::IsNullOrWhiteSpace($line)) { return $true }
    }
    return $false
}

$hasLocalKey = Test-KeyFile $localKeyFile
$hasWindLocalKey = Test-KeyFile $windKeyFile

if (-not $hasEnvKey -and -not $hasLocalKey -and -not $hasWindEnvKey -and -not $hasWindLocalKey) {
    Write-Host "[ERROR] 未配置任何 API Key" -ForegroundColor Red
    Write-Host ""
    Write-Host "妙想技能: 复制 EM_API_KEY.local.example -> EM_API_KEY.local" -ForegroundColor Green
    Write-Host "万得技能: 复制 WIND_API_KEY.local.example -> WIND_API_KEY.local" -ForegroundColor Green
    Write-Host "或在 Aeolus 用户中心添加 Key" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

if ($hasEnvKey) { Write-Host "[OK] EM_API_KEY (环境变量)" -ForegroundColor Green }
elseif ($hasLocalKey) { Write-Host "[OK] EM_API_KEY.local" -ForegroundColor Green }
else { Write-Host "[--] 妙想 EM_API_KEY 未配置（仅万得技能时可忽略）" -ForegroundColor DarkYellow }

if ($hasWindEnvKey) { Write-Host "[OK] WIND_API_KEY (环境变量)" -ForegroundColor Green }
elseif ($hasWindLocalKey) { Write-Host "[OK] WIND_API_KEY.local" -ForegroundColor Green }
else { Write-Host "[--] 万得 WIND_API_KEY 未配置（仅用妙想技能时可忽略）" -ForegroundColor DarkYellow }

# ── 运行环境检查 ────────────────────────────────────────────
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] 未找到 Node.js，请先安装。" -ForegroundColor Red; exit 1
}
Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green

$pnpmVersion = pnpm --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] 未找到 pnpm，请运行: npm install -g pnpm" -ForegroundColor Red; exit 1
}
Write-Host "[OK] pnpm $pnpmVersion" -ForegroundColor Green

if (-not (Test-Path $sharedPython)) {
    Write-Host "[ERROR] 未找到 Python 环境: $sharedPython" -ForegroundColor Red
    Write-Host "请先运行: .\setup-python.ps1" -ForegroundColor Yellow
    Write-Host ""; exit 1
}
Write-Host "[OK] Python 环境 (python/venv)" -ForegroundColor Green
Write-Host ""

# ── 依赖检查（首次自动安装）────────────────────────────────
if (-not (Test-Path (Join-Path $backendDir "node_modules"))) {
    Write-Host "安装 backend 依赖..." -ForegroundColor Yellow
    Push-Location $backendDir; pnpm install; Pop-Location
    if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] backend 依赖安装失败" -ForegroundColor Red; exit 1 }
}

if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Host "安装 frontend 依赖..." -ForegroundColor Yellow
    Push-Location $frontendDir; pnpm install; Pop-Location
    if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] frontend 依赖安装失败" -ForegroundColor Red; exit 1 }
}

# 确保 tmp/ 目录存在
$tmpDir = Join-Path $repoRoot "tmp"
if (-not (Test-Path $tmpDir)) {
    New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
}

# ── 启动（直接用 concurrently，保留完整编码）───────────────
Write-Host "Frontend : http://localhost:5173" -ForegroundColor Cyan
Write-Host "Backend  : http://localhost:3001" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host ""

Set-Location $repoRoot
$env:FORCE_COLOR = "1"
pnpm run dev
