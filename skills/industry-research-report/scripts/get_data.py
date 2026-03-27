"""
行业研究报告生成脚本

功能：
- 根据用户输入的行业关键词，生成行业深度研究报告。
- 结果输出的行业研究报告内容：最终返回标题、正文、PDF/DOC附件、溯源信息。

需要配置EM_API_KEY。
"""

import asyncio
import json
import os
from pathlib import Path
import httpx
import base64
import argparse
import sys

# █████████████████████████████████████████████████████████████████████████
# ██                                                                  ██
# ██   ███████╗███╗   ███╗     █████╗ ██████╗ ██╗    ██╗ ██████╗       ██
# ██   ██╔════╝████╗ ████║    ██╔══██╗██╔══██╗██║    ██║██╔═══██╗      ██
# ██   █████╗  ██╔████╔██║    ███████║██████╔╝██║ █╗ ██║██║   ██║      ██
# ██   ██╔══╝  ██║╚██╔╝██║    ██╔══██║██╔═══╝ ██║███╗██║██║   ██║      ██
# ██   ███████╗██║ ╚═╝ ██║    ██║  ██║██║     ╚███╔███╔╝╚██████╔╝      ██
# ██   ╚══════╝╚═╝     ╚═╝    ╚═╝  ╚═╝╚═╝      ╚══╝╚══╝  ╚═════╝       ██
# ██                                                                  ██
# ██                ⚠️  EM API KEY CONFIGURATION REQUIRED ⚠️           ██
# ██                                                                  ██
# ██         YOU MUST SET THE ENVIRONMENT VARIABLE BEFORE RUNNING     ██
# ██                                                                  ██
# ██                    ENV VARIABLE: EM_API_KEY                      ██
# ██                                                                  ██
# ██          Example (Linux / macOS):                                ██
# ██              export EM_API_KEY="your_em_api_key"                 ██
# ██                                                                  ██
# ██          Example (Windows PowerShell):                           ██
# ██              $env:EM_API_KEY="your_em_api_key"                   ██
# ██                                                                  ██
# █████████████████████████████████████████████████████████████████████████


EM_API_KEY = os.environ.get("EM_API_KEY", "")

if not EM_API_KEY:
    raise RuntimeError(
        """

╔══════════════════════════════════════════════════════════════╗
║                      EM API KEY REQUIRED                     ║
╠══════════════════════════════════════════════════════════════╣
║  Environment variable EM_API_KEY is not set.                 ║
║                                                              ║
║  Please configure the environment variable first:            ║
║                                                              ║
║  Linux / macOS:                                              ║
║      export EM_API_KEY="your_em_api_key"                     ║
║                                                              ║
║  Windows PowerShell:                                         ║
║      $env:EM_API_KEY="your_em_api_key"                       ║
║                                                              ║
║  Then run the program again.                                 ║
╚══════════════════════════════════════════════════════════════╝

"""
    )


SKILL_NAME = "industry_research_report"
DEFAULT_OUTPUT_DIR = Path.cwd() / "miaoxiang" / SKILL_NAME
print('默认输出目录为：',DEFAULT_OUTPUT_DIR.absolute())
# MCP 服务器地址
MCP_URL = "https://ai-saas.eastmoney.com/proxy/app-robo-advisor-api/assistant/write/industry/research"


def _save_base64_file(b64_str: str, file_path: Path) -> bool:
    """将 base64 字符串解码后写入文件。"""
    if not b64_str:
        return False
    try:
        raw = base64.b64decode(b64_str)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(raw)
        return True
    except Exception as exc:
        print(f"[WARN] 保存附件失败 ({file_path.name}): {exc}", file=sys.stderr)
        return False


def run_cli() -> None:
    """命令行入口：从参数或 stdin 读取查询文本，执行并打印结果路径。"""

    parser = argparse.ArgumentParser(description='通过行业名称获取该行业的深度研究报告')

    # 添加query参数
    parser.add_argument('--query', type=str, help='自然语言查询，如「股价大于1000元的股票」', required=True)

    args = parser.parse_args()

    print(f"行业名称: {args.query}")

    if not args.query.strip():
        print("用法: python3 scripts/get_data.py --query \"行业名称\"")
        print("示例: 半导体 / 新能源汽车 / AI芯片 / 消费电子与智能家居")
        sys.exit(1)

    async def _main() -> None:
        output_dir = Path(os.environ.get(SKILL_NAME + "_OUTPUT_DIR", str(DEFAULT_OUTPUT_DIR)))
        r = await get_industry_research_report(args.query, output_dir=output_dir)
        if "error" in r:
            print(f"错误: {r['error']}", file=sys.stderr)
            sys.exit(2)

        print(json.dumps(r, ensure_ascii=False, indent=4))
        if r.get("description_path"):
            print(f"描述: {r['description_path']}")

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_main())
    finally:
        loop.close()


async def get_industry_research_report(query: str, output_dir: Path):
    """行业研究报告 异步调用函数"""

    result_data = {}

    if not isinstance(query, str) or len(query) > 500:
        result_data["error"] = "字数超出限制，请尝试其它主体。"
        return result_data

    try:
        async with httpx.AsyncClient(timeout=1200.0) as client:
            result = await client.post(
                MCP_URL,
                json={"query": query},
                headers={
                    "Content-Type": "application/json",
                    "em_api_key": EM_API_KEY,
                },
            )

            result.raise_for_status()
            
            result_data_api = result.json()
            
            title = result_data_api["data"]["title"]
            content = result_data_api["data"]["content"]
            share_url = result_data_api["data"]["shareUrl"]

            pdf_output_path = output_dir / f"{title}.pdf"
            pdf_saved = _save_base64_file(result_data_api["data"]["pdfBase64"], pdf_output_path)

            word_output_path = output_dir / f"{title}.docx"
            word_saved  = _save_base64_file(result_data_api["data"]["wordBase64"], word_output_path)

            if not word_saved or not pdf_saved:
                result_data["error"] = "保存附件失败"
                return result_data

            result_data["title"] = title
            result_data["truncated_text"] = content
            result_data["pdf_output_path"] = str(pdf_output_path)
            result_data["docx_output_path"] = str(word_output_path)
            result_data["share_url"] = share_url

            desc_output_path = output_dir / f"{title}_description.txt"
            desc_lines = [
                "行业研究报告结果说明",
                "=" * 40,
                f"行业名称: {query}",
                f"标题: {title}",
                f"PDF: {pdf_output_path}",
                f"DOCX: {word_output_path}",
                f"分享链接: {share_url}",
                "",
                "摘要内容:",
                str(content or ""),
            ]
            desc_output_path.write_text("\n".join(desc_lines), encoding="utf-8")
            result_data["description_path"] = str(desc_output_path)

            return result_data


    except Exception as e:
        print(f"调用工具时出错: {e}", file=sys.stderr)
        result_data["error"] = f"调用工具时出错: {e}"
        import traceback
        traceback.print_exc()
        return result_data


if __name__ == "__main__":
    run_cli()
