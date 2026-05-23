"""Tushare Pro 查数适配层（Aeolus Web）。官方 Skill: waditu-tushare/skills"""

from __future__ import annotations

import argparse
import os
import re
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

TUSHARE_TOKEN = (os.environ.get("TUSHARE_TOKEN") or "").strip()


def _require_token() -> None:
    if TUSHARE_TOKEN:
        return
    raise RuntimeError(
        """

╔══════════════════════════════════════════════════════════════╗
║                  TUSHARE TOKEN REQUIRED                      ║
╠══════════════════════════════════════════════════════════════╣
║  请在 Aeolus 用户中心配置 Tushare Token，或设置 TUSHARE_TOKEN ║
║  注册获取: https://tushare.pro/register                       ║
╚══════════════════════════════════════════════════════════════╝

"""
    )


def _guess_ts_code(query: str) -> str | None:
    q = query.strip()
    m = re.search(r"\b(\d{6})\b", q)
    if m:
        code = m.group(1)
        return f"{code}.SH" if code.startswith("6") else f"{code}.SZ"
    aliases = {
        "贵州茅台": "600519.SH",
        "宁德时代": "300750.SZ",
        "比亚迪": "002594.SZ",
        "沪深300": "000300.SH",
        "科创50": "000688.SH",
    }
    for name, ts in aliases.items():
        if name in q:
            return ts
    return None


def _fetch_daily(ts_code: str, days: int = 30):
    import tushare as ts

    pro = ts.pro_api(TUSHARE_TOKEN)
    end = datetime.now().strftime("%Y%m%d")
    start = (datetime.now() - timedelta(days=days + 30)).strftime("%Y%m%d")
    df = pro.daily(ts_code=ts_code, start_date=start, end_date=end)
    if df is None or df.empty:
        return None
    return df.sort_values("trade_date", ascending=False).head(days)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Tushare 金融数据")
    parser.add_argument("query", nargs="?", help="自然语言问句")
    parser.add_argument("--query", dest="query_opt")
    args = parser.parse_args()
    query = (args.query_opt or args.query or "").strip()
    if not query:
        parser.print_help(sys.stderr)
        sys.exit(1)

    _require_token()
    ts_code = _guess_ts_code(query)
    if not ts_code:
        raise RuntimeError("未能从问句中识别股票/指数代码，请包含 6 位代码或常见名称（如 贵州茅台）")

    df = _fetch_daily(ts_code)
    if df is None or df.empty:
        raise RuntimeError(f"Tushare 未返回数据（{ts_code}），请检查 Token 权限与积分")

    out_dir = Path.cwd() / "miaoxiang" / "Tushare_FinData"
    out_dir.mkdir(parents=True, exist_ok=True)
    suffix = uuid.uuid4().hex[:8]
    xlsx_path = out_dir / f"Tushare_{ts_code.replace('.', '_')}_{suffix}.xlsx"
    df.to_excel(xlsx_path, index=False)

    desc_path = out_dir / f"Tushare_{suffix}_description.txt"
    preview = df.head(10).to_string(index=False)
    desc_path.write_text(
        "\n".join([
            f"Tushare Pro · {ts_code}",
            "=" * 40,
            f"查询: {query}",
            "",
            "最近交易日行情（预览）：",
            preview,
            "",
            f"完整数据见附件 Excel（{len(df)} 行）",
            "",
            "官方 Agent Skill: npx skills add https://github.com/waditu-tushare/skills --skill tushare-data -y",
        ]),
        encoding="utf-8",
    )

    print(f"描述: {desc_path}")
    print(str(xlsx_path.resolve()))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"错误: {exc}", file=sys.stderr)
        sys.exit(2)
