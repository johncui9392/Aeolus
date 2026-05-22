# 万得 Wind 数据源

Aeolus 通过 [wind-skills](https://gitee.com/wind_info/wind-skills)（万得官方技能仓库）接入 Wind 能力。**无需**在 Aeolus 外再执行 `npx skills add`，相关脚本已内嵌在 `skills/` 目录。

| 界面名称 | 目录 | 说明 |
|----------|------|------|
| 万得金融数据查询 | `Wind_FinData/` | MCP 自然语言查数 |
| 盘后复盘 | `Wind_PostMarketDebrief/` | Alice `post-market-debrief` |
| 个股投资逻辑研究 | `Wind_EquityInvestmentThesis/` | Alice `equity-investment-thesis` |
| A股主线识别 | `Wind_ASharePrimaryTheme/` | Alice `a-share-primary-theme-identification` |
| 市场状态切换 | `Wind_MarketRegimeSwitch/` | Alice `market_regime_switch_skill` |
| 全球市场主题检测 | `Wind_ThemeDetector/` | 本地 Python 扫描（FINVIZ/ETF，可选 `FINVIZ_API_KEY` / `FMP_API_KEY`） |

Alice 类技能共用运行时 `skills/wind-alice-runtime/`（`wind-alice.mjs`），单次分析可能需数分钟，默认超时 30 分钟（`WIND_ALICE_TIMEOUT_SEC`）。

## 获取 API Key

1. 打开 [Wind 金融 AI 市场](https://aifinmarket.wind.com.cn)
2. 登录后进入 **个人中心**（开发者中心 / 用户概览）
3. 创建或复制 **WIND_API_KEY**

直达链接（登录后）：<https://aifinmarket.wind.com.cn/#/user/overview>

## 配置方式

任选其一即可，与妙想 `EM_API_KEY` **分开管理**。

### 方式一：本地文件（推荐）

```powershell
Copy-Item WIND_API_KEY.local.example WIND_API_KEY.local
```

编辑 `WIND_API_KEY.local`，在注释下方写入 Key（不要引号、不要首尾空格）：

```text
default=你的_WIND_API_KEY
```

或只写一行 Key（与 `EM_API_KEY.local` 相同写法）：

```text
你的_WIND_API_KEY
```

### 方式二：Aeolus 界面

1. 启动 Aeolus（根目录 `pnpm dev` 或 `.\start.ps1`）
2. 左下角 **用户中心** → **API Key 管理**
3. 切换到 **「万得 Wind」** 标签
4. 粘贴 Key → **保存并切换**

### 方式三：环境变量（临时）

```powershell
$env:WIND_API_KEY="你的_WIND_API_KEY"
```

## 使用方式

### 在 Aeolus Web 中使用

1. 确认后端已启动（`http://localhost:3001/api/health` 返回 `ok`）
2. 打开前端 `http://localhost:5173`
3. 技能来源选择 **「Wind 万得」**（或 **全部**）
4. 选中 **万得金融数据查询**
5. 输入自然语言问句，例如：
   - `贵州茅台最新价和涨跌幅`
   - `沪深300指数最近一个月走势`
   - `易方达蓝筹精选最新净值`
6. 点击 **Execute** 执行

结果以表格（Excel 结构）或说明文本展示，数据来源于万得 Wind。

### 命令行调试

需已安装 **Node.js**（Wind CLI 为 Node 脚本）。

```powershell
$env:WIND_API_KEY="你的_WIND_API_KEY"
python skills/Wind_FinData/scripts/get_data.py --query "贵州茅台最新价"
```

输出文件默认在 `miaoxiang/Wind_FinData/`（该目录已在 `.gitignore` 中忽略）。

## 与东方财富（妙想）技能的区别

| 项目 | 东方财富妙想 | 万得 Wind |
|------|----------------|-----------|
| 环境变量 / 本地文件 | `EM_API_KEY` / `EM_API_KEY.local` | `WIND_API_KEY` / `WIND_API_KEY.local` |
| Key 申请 | [ai.eastmoney.com/mxClaw](https://ai.eastmoney.com/mxClaw) | [aifinmarket.wind.com.cn](https://aifinmarket.wind.com.cn) |
| 界面筛选 Tag | **东方财富** | **Wind 万得** |
| 技能数量 | 多数 `skills/` 插件 | 6 个 Wind 插件（见上表） |
| 运行时 | Python 脚本 | Python 包装 + Node `cli.mjs`（MCP） |

两类 Key **互不通用**；使用 Wind 技能前只需配置 `WIND_API_KEY`。

## 实现说明（开发者）

- `skills/Wind_FinData/manifest.json`：`apiKeyProvider: "wind"`，`vendor: "wind"`
- `scripts/get_data.py`：调用 `analytics_data.get_financial_data` 自然语言查数
- `scripts/cli.mjs`、`references/`：来自万得 `wind-mcp-skill`，随仓库分发
- 后端 `POST /api/query` 按技能的 `apiKeyProvider` 注入 `WIND_API_KEY`

### 主题检测（可选 Key）

```powershell
$env:FINVIZ_API_KEY="..."   # FINVIZ Elite，更快更全
$env:FMP_API_KEY="..."       # 估值等指标增强
python skills/Wind_ThemeDetector/scripts/get_data.py --query "关注AI与能源"
```

首次使用请重新运行 `.\setup-python.ps1` 以安装 `requests`、`yfinance` 等依赖。

扩展更多 Wind 工具可参考上游 [wind-skills](https://gitee.com/wind_info/wind-skills) 与各技能目录下的 `SKILL.md`。

## 常见问题

### 提示 WIND_API_KEY 未设置

- 检查 `WIND_API_KEY.local` 是否有一行有效 Key，或用户中心 **万得 Wind** 是否已保存
- 修改 Key 文件后**重启后端**（或重新 `pnpm dev`）

### 插件商店看不到万得技能

- 确认 `skills/Wind_FinData/manifest.json` 存在
- 查看后端启动日志是否有 `[SkillRegistry] ✓ Loaded: wind_findata`

### 查询失败 / KEY_MISSING

- Key 是否来自万得个人中心且未过期
- 本机能否访问 `mcp.wind.com.cn`（公司网络 / 代理）

### 与 Cursor `npx skills add` 的关系

`npx skills add ... wind-mcp-skill` 将技能安装到 `~/.agents/skills/`，供 **Cursor Agent** 使用。  
Aeolus 已在 `skills/Wind_FinData/` **内嵌** 同款 CLI，**无需**再执行 `npx skills add` 即可在 Aeolus 内查数。

## 安全

- 勿提交 `WIND_API_KEY.local` 或真实 Key（已在 `.gitignore`）
- 文档与示例仅使用占位符
