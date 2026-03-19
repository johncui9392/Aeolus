# Aeolus 启动脚本

Write-Host "🚀 启动 Aeolus..." -ForegroundColor Cyan
Write-Host ""

# 检查 key 配置：优先环境变量，其次项目根目录 EM_API_KEY.local
$repoRoot = $PSScriptRoot
$localKeyFile = Join-Path $repoRoot "EM_API_KEY.local"
$hasEnvKey = -not [string]::IsNullOrWhiteSpace($env:EM_API_KEY)
$hasLocalKey = $false

if (Test-Path $localKeyFile) {
    $localLines = Get-Content $localKeyFile | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith("#") }
    foreach ($line in $localLines) {
        if ($line -match "=") {
            $parts = $line.Split("=", 2)
            if ($parts.Count -eq 2 -and -not [string]::IsNullOrWhiteSpace($parts[1])) {
                $hasLocalKey = $true
                break
            }
        } elseif (-not [string]::IsNullOrWhiteSpace($line)) {
            $hasLocalKey = $true
            break
        }
    }
}

if (-not $hasEnvKey -and -not $hasLocalKey) {
    Write-Host "❌ 错误: 未检测到可用 API Key" -ForegroundColor Red
    Write-Host ""
    Write-Host "请先配置 API Key：" -ForegroundColor Yellow
    Write-Host "  1) 复制 EM_API_KEY.local.example 为 EM_API_KEY.local" -ForegroundColor Green
    Write-Host "  2) 打开 EM_API_KEY.local，将 # default=em_xxx 改为 default=你的key（去掉 #）" -ForegroundColor Green
    Write-Host ""
    Write-Host "或在当前终端设置环境变量：" -ForegroundColor Yellow
    Write-Host '  $env:EM_API_KEY="your_api_key_here"' -ForegroundColor Green
    Write-Host ""
    exit 1
}

if ($hasEnvKey) {
    Write-Host "✅ 已检测到环境变量 EM_API_KEY" -ForegroundColor Green
} else {
    Write-Host "✅ 已检测到 EM_API_KEY.local 配置" -ForegroundColor Green
}
Write-Host ""

# 检查 Node.js
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 错误: 未找到 Node.js" -ForegroundColor Red
    Write-Host "请先安装 Node.js: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Node.js 版本: $nodeVersion" -ForegroundColor Green

# 检查 pnpm
$pnpmVersion = pnpm --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 错误: 未找到 pnpm" -ForegroundColor Red
    Write-Host "请先安装 pnpm: npm install -g pnpm" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ pnpm 版本: $pnpmVersion" -ForegroundColor Green
Write-Host ""

# 检查依赖是否已安装
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 安装依赖..." -ForegroundColor Yellow
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 依赖安装失败" -ForegroundColor Red
        exit 1
    }
}

Write-Host "🌐 启动服务器..." -ForegroundColor Cyan
Write-Host ""
Write-Host "前端地址: http://localhost:3000" -ForegroundColor Green
Write-Host "后端地址: http://localhost:3001" -ForegroundColor Green
Write-Host ""
Write-Host "按 Ctrl+C 停止服务器" -ForegroundColor Yellow
Write-Host ""

# 启动应用
pnpm run dev
