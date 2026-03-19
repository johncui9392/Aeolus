# Aeolus

![Aeolus Banner](docs/assets/banner.svg)

Aeolus 是一个金融 Skills 聚合平台，提供统一 Web 界面来调用多种金融查询能力（金融数据、金融资讯、宏观数据、选股/选基金）。

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](#环境要求)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D8-F69220?logo=pnpm&logoColor=white)](#环境要求)
[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-blue)](.github/workflows/ci.yml)

## 功能特性

- 多技能统一入口：`MX_FinData`、`MX_FinSearch`、`MX_MacroData`、`MX_StockPick`
- 查询历史与结果预览（文本/CSV/Excel）
- 金融资讯结果自动结构化展示（新闻卡片）
- 用户中心支持主题切换与 API Key 管理
- API Key 多条目管理（当前 provider: `mx`）

## 架构概览

- 前端：React + Vite + Tailwind（`src/`）
- 后端：Express（`server/index.js`）
- 技能运行：统一 Python 环境 + Python skills（`python/` + `skills/`）
- 结果落盘：`history/`
- API Key 管理：本地文件 + 环境变量（当前 `EM_API_KEY`）

## 环境要求

- Node.js 18+
- pnpm 8+
- Windows PowerShell（推荐）
- Python 3.10+（统一安装在项目根目录 `python/venv/`）

## 快速开始

1. 安装前端依赖

```powershell
pnpm install
```

2. 初始化统一 Python 环境

```powershell
.\setup-python.ps1
```

3. 配置 API Key（必做）

- 复制 `EM_API_KEY.local.example` 为 `EM_API_KEY.local`
- 将示例行改为：

```text
default=你的_em_api_key
```

4. 启动应用

```powershell
.\start.ps1
```

或直接：

```powershell
pnpm run dev
```

## 常用命令

```powershell
pnpm run dev         # 前后端联调
pnpm run dev:server  # 仅后端
pnpm run dev:client  # 仅前端
pnpm run build       # 构建前端
pnpm run preview     # 预览构建结果
```

## 目录结构

```text
Aeolus/
├── src/                   # 前端 React
├── server/                # 后端 Express API
├── python/                # 统一 Python 环境与依赖
├── skills/                # Python skills 脚本
├── history/               # 查询输出目录（运行后生成）
├── .github/               # CI / Issue / PR 模板
├── EM_API_KEY.local.example
├── start.ps1
└── README.md
```

## API 端点（简表）

| Method | Path | 说明 |
|---|---|---|
| `POST` | `/api/query` | 执行技能查询 |
| `GET` | `/api/file-content` | 获取文件预览内容（文本/CSV/Excel） |
| `GET` | `/api/download` | 下载查询结果文件 |
| `GET` | `/api/query-history-from-files` | 从 `history/` 聚合历史记录 |
| `GET` | `/api/api-keys` | 读取 API Key 列表与当前激活项 |
| `POST` | `/api/api-keys` | 管理 API Key（添加/切换/删除） |
| `GET` | `/api/health` | 健康检查 |

## 安全说明

- 请勿提交 `EM_API_KEY.local` 或任何真实密钥
- 建议在 fork/公开前检查历史提交，确保未泄露密钥
- 发布前请确认本地产物未进入仓库：`node_modules/`、`dist/`、`history/`、`miaoxiang/`、`python/venv/`、`skills/**/venv/`
- 如发现安全问题，请参阅 `SECURITY.md`

## 贡献

欢迎贡献，详见 `CONTRIBUTING.md` 与 `CODE_OF_CONDUCT.md`。

## 许可证

MIT，详见 `LICENSE`。
