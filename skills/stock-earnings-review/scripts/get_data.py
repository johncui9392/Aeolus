import argparse
import asyncio
import json
import uuid
from pathlib import Path
from typing import Any, Dict

from call_review_api import call_review_api
from common import default_output_root
from normalize_report_period import choose_report_option_by_model, fetch_report_options
from validate_entity import validate_entity


async def query_stock_earnings_review(query: str, output_dir: Path) -> Dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)

    result: Dict[str, Any] = {
        "query": query,
        "description_path": None,
        "row_count": 0,
    }

    try:
        entity = await validate_entity(query)
        options = await fetch_report_options(entity)
        matched = choose_report_option_by_model(options)
        review = await call_review_api(
            entity=entity,
            report_date=matched.report_date,
            attachment_dir=str(output_dir / "attachments"),
            debug=False,
        )
    except Exception as exc:
        result["error"] = f"业绩点评执行失败: {exc!s}"
        return result

    unique_suffix = uuid.uuid4().hex[:8]
    desc_path = output_dir / f"stock_earnings_review_{unique_suffix}_description.txt"
    lines = [
        "上市公司业绩点评结果说明",
        "=" * 40,
        f"查询内容: {query}",
        f"实体: {entity.secu_name or entity.secu_code}",
        f"emCode: {entity.em_code}",
        f"报告期: {matched.report_date}",
        f"标题: {review.get('title') or ''}",
        f"分享链接: {review.get('shareUrl') or ''}",
        f"PDF: {(review.get('files') or {}).get('pdf') or ''}",
        f"WORD: {(review.get('files') or {}).get('word') or ''}",
        f"DATASHEET: {(review.get('files') or {}).get('dataSheet') or ''}",
        "",
        "内容摘要:",
        str(review.get("content") or ""),
    ]
    desc_path.write_text("\n".join(lines), encoding="utf-8")

    result["description_path"] = str(desc_path)
    result["row_count"] = 1
    result["title"] = review.get("title")
    return result


def run_cli() -> None:
    parser = argparse.ArgumentParser(description="上市公司业绩点评")
    parser.add_argument("--query", required=True, help="自然语言查询，例如：贵州茅台 业绩点评")
    args = parser.parse_args()

    async def _main() -> None:
        out_dir = default_output_root()
        r = await query_stock_earnings_review(args.query.strip(), out_dir)
        if "error" in r:
            print(f"错误: {r['error']}")
            raise SystemExit(2)
        print(f"描述: {r['description_path']}")
        print(f"行数: {r['row_count']}")

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_main())
    finally:
        loop.close()


if __name__ == "__main__":
    run_cli()
