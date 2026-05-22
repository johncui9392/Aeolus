# Quick Start

## 1) Configure API Keys

Aeolus 支持两类数据源，Key **分开配置**：

### 东方财富妙想（多数技能）

- 打开：<https://ai.eastmoney.com/mxClaw>
- 获取 `EM_API_KEY`

```powershell
Copy-Item EM_API_KEY.local.example EM_API_KEY.local
```

```text
default=your_em_api_key
```

### 万得 Wind（万得金融数据查询）

- 打开：<https://aifinmarket.wind.com.cn>
- 登录 **个人中心**，获取 `WIND_API_KEY`  
  （直达：<https://aifinmarket.wind.com.cn/#/user/overview>）

```powershell
Copy-Item WIND_API_KEY.local.example WIND_API_KEY.local
```

```text
default=your_wind_api_key
```

也可在 UI：**用户中心 → API Key 管理**，用 **妙想 EM** / **万得 Wind** 标签分别添加。

详细说明：[docs/WIND_DATA_SOURCE.md](docs/WIND_DATA_SOURCE.md)

## 2) Setup & Start

```powershell
# 1. Initialize shared Python environment (one-time)
.\setup-python.ps1

# 2. Start frontend + backend together
.\start.ps1
```

`start.ps1` 会检查是否至少配置了一类 API Key，并自动安装依赖。

根目录也可使用：

```powershell
pnpm dev
```

同时启动后端 `http://localhost:3001` 与前端 `http://localhost:5173`。

## Access

| Service  | URL                   |
| -------- | --------------------- |
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:3001 |

## Using Wind skills

1. 打开前端，在技能区选择 **Wind 万得** 或 **全部**
2. 点击 **万得金融数据查询**
3. 输入问句（例：`贵州茅台最新价`）→ **Execute**

需已配置 `WIND_API_KEY`，且本机已安装 **Node.js**（万得 MCP CLI 依赖）。

## Run Separately

```powershell
# Backend only
pnpm dev:backend

# Frontend only
pnpm dev:frontend
```

## Common Issues

### EM_API_KEY not set

妙想技能需要 `EM_API_KEY.local` 或环境变量：

```powershell
$env:EM_API_KEY="your_em_api_key"
```

### WIND_API_KEY not set

万得技能需要 `WIND_API_KEY.local` 或环境变量：

```powershell
$env:WIND_API_KEY="your_wind_api_key"
```

### Backend not connected

确认根目录 `pnpm dev` 或 `.\start.ps1` 已启动，且终端有 `[backend] Aeolus API Server http://localhost:3001`。

### Port occupied

```powershell
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Python skill execution fails

```powershell
.\setup-python.ps1
```

### Adding a new Skill

1. Create `skills/MY_NewSkill/manifest.json` + `scripts/get_data.py`
2. 万得类技能设置 `"apiKeyProvider": "wind"`, `"vendor": "wind"`
3. Restart backend
