"""
万得 Wind 自然语言查数（Aeolus 适配层）。

通过 wind-mcp-skill 的 analytics_data.get_financial_data 接口查询，
将 MCP 返回整理为描述文件供 Aeolus 解析展示。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

WIND_API_KEY = (os.environ.get("WIND_API_KEY") or "").strip()

if not WIND_API_KEY:
    raise RuntimeError(
        """

╔══════════════════════════════════════════════════════════════╗
║                   WIND API KEY REQUIRED                      ║
╠══════════════════════════════════════════════════════════════╣
║  Environment variable WIND_API_KEY is not set.               ║
║                                                              ║
║  请在 Aeolus 用户中心配置 Wind API Key，或：                 ║
║                                                              ║
║  Windows PowerShell:                                         ║
║      $env:WIND_API_KEY="your_wind_api_key"                   ║
║                                                              ║
║  获取地址: https://aifinmarket.wind.com.cn/#/user/overview   ║
╚══════════════════════════════════════════════════════════════╝

"""
    )

SKILL_ROOT = Path(__file__).resolve().parent.parent
CLI_PATH = SKILL_ROOT / "scripts" / "cli.mjs"


def _default_output_dir() -> Path:
    return Path.cwd() / "miaoxiang" / "Wind_FinData"


def _normalize_question(query: str) -> str:
    """Wind NL 入参禁止空格，用标点或直接连接替代。"""
    q = query.strip()
    if not q:
        raise ValueError("缺少查询文本")
    return re.sub(r"\s+", "", q)


def _run_wind_call(question: str) -> Tuple[int, str, str]:
    params = json.dumps({"question": question, "lang": "CNS"}, ensure_ascii=False)
    cmd = [
        "node",
        str(CLI_PATH),
        "call",
        "analytics_data",
        "get_financial_data",
        params,
    ]
    env = {**os.environ, "WIND_API_KEY": WIND_API_KEY}
    proc = subprocess.run(
        cmd,
        cwd=str(SKILL_ROOT),
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return proc.returncode, proc.stdout or "", proc.stderr or ""


def _parse_error_envelope(stdout: str) -> str:
    try:
        data = json.loads(stdout)
    except json.JSONDecodeError:
        return stdout.strip() or "Wind 调用失败"
    err = data.get("error") if isinstance(data, dict) else None
    if isinstance(err, dict):
        code = err.get("code") or "UNKNOWN"
        action = err.get("agent_action") or err.get("hint") or ""
        return f"[{code}] {action}".strip()
    return stdout.strip() or "Wind 调用失败"


def _extract_text_payload(result: Any) -> str:
    if isinstance(result, str):
        return result
    if not isinstance(result, dict):
        return json.dumps(result, ensure_ascii=False, indent=2)

    content = result.get("content")
    if isinstance(content, list):
        parts: List[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(str(item.get("text") or ""))
        if parts:
            return "\n".join(parts)

    for key in ("text", "data", "result"):
        if key in result and result[key] is not None:
            val = result[key]
            if isinstance(val, (dict, list)):
                return json.dumps(val, ensure_ascii=False, indent=2)
            return str(val)

    return json.dumps(result, ensure_ascii=False, indent=2)


def _try_parse_inner_json(text: str) -> Any:
    t = text.strip()
    if not t:
        return None
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        return None


def _table_block_to_rows(block: Dict[str, Any]) -> Optional[List[Dict[str, Any]]]:
    """Wind analytics 返回 columns + rows 二维数组时转为 dict 行。"""
    columns = block.get("columns")
    raw_rows = block.get("rows")
    if not isinstance(raw_rows, list) or not raw_rows:
        return None
    headers: List[str] = []
    if isinstance(columns, list) and columns:
        for i, col in enumerate(columns):
            if isinstance(col, dict) and col.get("name"):
                headers.append(str(col["name"]))
            else:
                headers.append(f"列{i + 1}")
    if not headers and isinstance(raw_rows[0], list):
        headers = [f"列{i + 1}" for i in range(len(raw_rows[0]))]
    out: List[Dict[str, Any]] = []
    for row in raw_rows:
        if isinstance(row, dict):
            out.append({str(k): v for k, v in row.items()})
        elif isinstance(row, list):
            out.append({headers[i] if i < len(headers) else f"列{i + 1}": row[i] for i in range(len(row))})
    return out or None


def _rows_from_payload(payload: Any) -> Optional[List[Dict[str, Any]]]:
    if isinstance(payload, list) and payload and isinstance(payload[0], dict):
        if "columns" in payload[0] and "rows" in payload[0]:
            return _table_block_to_rows(payload[0])
        return payload
    if not isinstance(payload, dict):
        return None

    if "columns" in payload and "rows" in payload:
        return _table_block_to_rows(payload)

    nested = payload.get("data")
    if isinstance(nested, dict):
        blocks = nested.get("data")
        if isinstance(blocks, list):
            for block in blocks:
                if isinstance(block, dict) and "rows" in block:
                    rows = _table_block_to_rows(block)
                    if rows:
                        return rows

    for key in ("rows", "data", "items", "records", "table"):
        val = payload.get(key)
        if isinstance(val, list) and val and isinstance(val[0], dict):
            return val
    return None


def _write_outputs(query: str, result_text: str, output_dir: Path) -> Tuple[Path, Optional[Path]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    suffix = uuid.uuid4().hex[:8]
    desc_path = output_dir / f"Wind_FinData_{suffix}_description.txt"
    data_path: Optional[Path] = None

    inner = _try_parse_inner_json(result_text)
    rows = _rows_from_payload(inner) if inner is not None else None

    lines = [
        "万得 Wind 金融数据查询结果",
        "=" * 40,
        f"查询内容: {query}",
        f"描述文件: {desc_path}",
        "",
        "数据来源于万得 Wind 金融数据服务",
        "",
        "--- 查询结果 ---",
        "",
        result_text,
    ]

    if rows:
        try:
            import pandas as pd

            data_path = output_dir / f"Wind_FinData_{suffix}.xlsx"
            df = pd.DataFrame(rows)
            df.to_excel(data_path, index=False, sheet_name="数据")
            lines.insert(6, f"数据文件: {data_path}")
            lines.insert(7, f"行数: {len(rows)}")
        except Exception as exc:
            lines.append(f"\n(未能导出 Excel: {exc})")

    desc_path.write_text("\n".join(lines), encoding="utf-8")
    return desc_path, data_path


def run_query(query: str, output_dir: Optional[Path] = None) -> None:
    if not CLI_PATH.is_file():
        raise FileNotFoundError(f"未找到 Wind CLI: {CLI_PATH}")

    question = _normalize_question(query)
    out_dir = output_dir or _default_output_dir()

    code, stdout, stderr = _run_wind_call(question)
    if code != 0:
        msg = _parse_error_envelope(stdout)
        if stderr.strip():
            msg = f"{msg}\n{stderr.strip()}"
        raise RuntimeError(msg)

    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Wind 返回非 JSON: {exc}\n{stdout[:500]}") from exc

    result_text = _extract_text_payload(payload)
    desc_path, data_path = _write_outputs(query, result_text, out_dir)

    if data_path:
        print(f"文件: {data_path}")
    print(f"描述: {desc_path}")
    if data_path:
        try:
            import pandas as pd

            print(f"行数: {len(pd.read_excel(data_path))}")
        except Exception:
            pass


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="万得 Wind 自然语言查数")
    parser.add_argument("query", nargs="?", help="查询问句")
    parser.add_argument("--query", dest="query_opt", help="查询问句（显式参数）")
    args = parser.parse_args()

    query = (args.query_opt or args.query or "").strip()
    if not query:
        parser.print_help(sys.stderr)
        sys.exit(1)

    try:
        run_query(query)
    except Exception as exc:
        print(f"错误: {exc}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
