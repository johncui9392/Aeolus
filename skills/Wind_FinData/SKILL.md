---
name: Wind_FinData
description: 基于万得 Wind MCP 的自然语言金融数据查询，覆盖 A 股/港股/美股、基金、指数、债券、宏观指标等。需要 WIND_API_KEY。
metadata:
  {
    "openclaw": {
      "requires": {
        "env": ["WIND_API_KEY"],
        "bins": ["python3", "node"]
      }
    }
  }
---

# 万得金融数据查询（Aeolus）

## API Key

- 环境变量：`WIND_API_KEY`
- 访问 [https://aifinmarket.wind.com.cn](https://aifinmarket.wind.com.cn) 登录个人中心获取 `WIND_API_KEY`（[开发者概览](https://aifinmarket.wind.com.cn/#/user/overview)）
- Aeolus 左下角「用户中心」可添加/切换 Wind Key（与妙想 `EM_API_KEY` 分开管理）

## 实现说明

本目录内嵌 [wind-mcp-skill](https://gitee.com/wind_info/wind-skills) 的 Node CLI（`scripts/cli.mjs`），由 `scripts/get_data.py` 调用 `analytics_data.get_financial_data` 完成自然语言查数，输出说明文件与可选 Excel。

完整工具路由（行情/K 线/公告/宏观等）见上游 `SKILL.md`；Aeolus 当前技能入口固定为 NL 通用查数。

## 本地调试

```bash
# PowerShell
$env:WIND_API_KEY="your_key"
python skills/Wind_FinData/scripts/get_data.py --query "贵州茅台最新价"
```
