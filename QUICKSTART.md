# Quick Start

## 1) Configure API Key

Copy `EM_API_KEY.local.example` to `EM_API_KEY.local`, then set:

```text
default=your_em_api_key
```

You can also manage keys from the UI: left sidebar -> User Center -> API Key 管理.

## 2) Start

Run:

```powershell
pnpm install
.\setup-python.ps1
.\start.ps1
```

This will:
- install frontend dependencies
- create the shared Python environment under `python/venv/`
- start frontend and backend

## Access

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Common Issues

### EM_API_KEY not set

- Ensure `EM_API_KEY.local` exists and contains a valid first line.
- Or set environment variable in the same terminal session:

```powershell
$env:EM_API_KEY="your_em_api_key"
```

### Port occupied

```powershell
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Python skill execution fails

- Check the shared Python environment under `python/venv/`.
- Re-run:

```powershell
.\setup-python.ps1
```

- Verify script path and runtime permissions.
