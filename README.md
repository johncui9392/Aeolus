# Aeolus

![Aeolus Banner](docs/assets/banner.svg)

Aeolus 是一个**金融 Skill 聚合平台**，提供统一 Web 界面调用多种金融查询能力。采用插件化架构，新增技能无需改动任何现有代码。

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](#环境要求)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D8-F69220?logo=pnpm&logoColor=white)](#环境要求)
[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-blue)](.github/workflows/ci.yml)

## 功能特性

- **插件商店**：技能以插件形式注册（`manifest.json`），新增技能无需改代码
- **多技能支持**：`MX_FinData`、`MX_FinSearch`、`MX_MacroData`、`MX_StockPick`
- **纯 JSON 数据流**：结果直接返回结构化 JSON，不写本地文件，支持前端直接导出 Excel/CSV
- **Vibe Design UI**：基于 Material Design 3 动态配色体系，带 Spring 微交互动效
- **主题切换**：深色多主题，Design Token 驱动，一键切换
- **API Key 管理**：多条目管理，UI 内配置，无需重启服务

## 架构概览

```text
前端 (frontend/)  ←──── /api/* ────→  后端 (backend/)
React + Vite           JSON only      Express + Node.js
动态加载技能列表                        插件动态注册器
前端导出 Excel/CSV                     Python 执行 → JSON → 清理临时文件
useAuth hook (扩展点)                  auth middleware (扩展点)
```

- **前端**：`frontend/` — React + Vite + Tailwind + Framer Motion
- **后端**：`backend/` — Express，插件化路由，无状态
- **技能插件**：`skills/` — 每个技能一个目录，含 `manifest.json` + Python 脚本
- **临时目录**：`tmp/` — Python 输出的临时文件，读取后立即删除
- **API Key**：本地文件 `EM_API_KEY.local` + 环境变量（`EM_API_KEY`）

## 环境要求

- Node.js 18+
- pnpm 8+
- Python 3.10+
- Windows PowerShell（推荐）

## 快速开始

```powershell
# 1. 初始化 Python 环境（仅第一次）
.\setup-python.ps1

# 2. 配置 API Key
Copy-Item EM_API_KEY.local.example EM_API_KEY.local
# 编辑 EM_API_KEY.local，填入 default=your_em_api_key

# 3. 启动
.\start.ps1
```

详见 [QUICKSTART.md](QUICKSTART.md)。

## 目录结构

```text
Aeolus/
├── frontend/                  # 前端（可独立部署至 Vercel）
│   ├── src/
│   │   ├── App.jsx            # 主界面，动态加载技能
│   │   └── hooks/useAuth.js   # 可替换的鉴权 Hook
│   └── ...
├── backend/                   # 后端（可独立部署至 VPS/Render）
│   ├── server.js
│   ├── middleware/auth.js      # 可替换的鉴权中间件
│   └── services/
│       ├── skillRegistry.js   # 插件动态注册器
│       └── pythonRunner.js    # Python 执行 + JSON 解析 + 临时文件清理
├── skills/                    # 技能插件目录
│   └── MX_FinData/
│       ├── manifest.json      # 插件描述符
│       ├── scripts/get_data.py
│       └── SKILL.md
├── python/                    # 共享 Python 虚拟环境
├── tmp/                       # Python 临时输出（读后即删，.gitkeep 追踪目录）
├── docs/
├── .github/
├── package.json               # Monorepo 根协调器
├── setup-python.ps1
├── start.ps1
└── EM_API_KEY.local.example
```

## API 端点

| Method | Path | 说明 |
|---|---|---|
| `GET` | `/api/health` | 健康检查 |
| `GET` | `/api/skills` | 获取所有已注册技能（插件商店） |
| `POST` | `/api/query` | 执行技能查询，返回 JSON 数据 |
| `GET` | `/api/api-keys` | 读取 API Key 列表 |
| `POST` | `/api/api-keys` | 管理 API Key（add / setActive / delete） |

## 扩展新技能

只需三步，无需改任何现有代码：

1. 在 `skills/` 下新建目录，如 `skills/MY_NewSkill/`
2. 创建 `manifest.json`（参考现有技能格式）
3. 创建 `scripts/get_data.py`

重启 backend，前端插件商店自动展示新技能。

## 安全说明

- 请勿提交 `EM_API_KEY.local` 或任何真实密钥
- 发布前确认 `node_modules/`、`dist/`、`tmp/`、`python/venv/` 未进入仓库
- 安全问题请参阅 [SECURITY.md](SECURITY.md)

## 贡献

欢迎贡献，详见 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 许可证

MIT，详见 [LICENSE](LICENSE)。
