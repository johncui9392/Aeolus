# Quick Start

## 1) Configure API Key

Get your API Key from Eastmoney OpenClaw:

- Open: `https://ai.eastmoney.com/mxClaw`
- Click `一键下载，获取apikey`

Copy `EM_API_KEY.local.example` to `EM_API_KEY.local`, then fill in:

```text
default=your_em_api_key
```

You can also manage keys from the UI: left sidebar → User → API Key 管理.

## 2) Setup & Start

```powershell
# 1. Initialize shared Python environment (one-time)
.\setup-python.ps1

# 2. Start frontend + backend together
.\start.ps1
```

`start.ps1` will automatically install `backend/` and `frontend/` dependencies on first run.

## Access

| Service  | URL                   |
| -------- | --------------------- |
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:3001 |

## Run Separately

```powershell
# Backend only
Set-Location backend
node server.js

# Frontend only
Set-Location frontend
pnpm run dev

# Build frontend for production
Set-Location frontend
pnpm run build
```

## Common Issues

### EM_API_KEY not set

Ensure `EM_API_KEY.local` exists with a valid key, or set in terminal:

```powershell
$env:EM_API_KEY="your_em_api_key"
```

### Port occupied

```powershell
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Python skill execution fails

Re-run setup:

```powershell
.\setup-python.ps1
```

### Adding a new Skill

1. Create a directory under `skills/`, e.g. `skills/MY_NewSkill/`
2. Add `skills/MY_NewSkill/manifest.json` (see existing skills for format)
3. Add `skills/MY_NewSkill/scripts/get_data.py`
4. Restart backend — the skill will appear in the UI automatically
