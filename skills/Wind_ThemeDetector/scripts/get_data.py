"""
万得 Wind 主题检测（theme-detector）Aeolus 适配层。

调用内嵌 theme_detector.py，将 Markdown 报告写入描述文件供前端展示。
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Optional, Tuple

SKILL_ROOT = Path(__file__).resolve().parent.parent
DETECTOR_SCRIPT = SKILL_ROOT / "scripts" / "theme_detector.py"
DEFAULT_TIMEOUT_SEC = int(os.environ.get("WIND_THEME_DETECTOR_TIMEOUT_SEC") or "1200")


def _default_output_dir() -> Path:
    return Path.cwd() / "miaoxiang" / "Wind_ThemeDetector"


def _run_detector(output_dir: Path) -> Tuple[int, str, str]:
    cmd = [
        sys.executable,
        str(DETECTOR_SCRIPT),
        "--output-dir",
        str(output_dir),
        "--max-themes",
        "12",
    ]
    finviz_key = (os.environ.get("FINVIZ_API_KEY") or "").strip()
    fmp_key = (os.environ.get("FMP_API_KEY") or "").strip()
    if finviz_key:
        cmd.extend(["--finviz-api-key", finviz_key])
    if fmp_key:
        cmd.extend(["--fmp-api-key", fmp_key])

    proc = subprocess.run(
        cmd,
        cwd=str(SKILL_ROOT),
        env={**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"},
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=DEFAULT_TIMEOUT_SEC,
    )
    return proc.returncode, proc.stdout or "", proc.stderr or ""


def _latest_report_paths(output_dir: Path) -> Tuple[Optional[Path], Optional[Path]]:
    md_files = sorted(output_dir.glob("theme_detector_*.md"), key=lambda p: p.stat().st_mtime, reverse=True)
    json_files = sorted(output_dir.glob("theme_detector_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return (md_files[0] if md_files else None, json_files[0] if json_files else None)


def run_scan(query_note: str = "", output_dir: Optional[Path] = None) -> Path:
    if not DETECTOR_SCRIPT.is_file():
        raise FileNotFoundError(f"未找到主题检测脚本: {DETECTOR_SCRIPT}")

    out_dir = output_dir or _default_output_dir()
    run_dir = out_dir / f"run_{uuid.uuid4().hex[:8]}"
    run_dir.mkdir(parents=True, exist_ok=True)

    code, stdout, stderr = _run_detector(run_dir)
    if code != 0:
        msg = stderr.strip() or stdout.strip() or f"theme_detector 退出码 {code}"
        raise RuntimeError(msg)

    md_path, json_path = _latest_report_paths(run_dir)
    if not md_path or not md_path.is_file():
        raise RuntimeError("主题检测完成但未找到 Markdown 报告文件")

    md_body = md_path.read_text(encoding="utf-8", errors="replace")
    suffix = uuid.uuid4().hex[:8]
    desc_path = out_dir / f"Wind_ThemeDetector_{suffix}_description.txt"

    note = query_note.strip()
    lines = [
        "万得 Wind · 全球市场主题检测",
        "=" * 40,
        f"Markdown 报告: {md_path}",
        f"JSON 数据: {json_path or '(无)'}",
    ]
    if note:
        lines.append(f"用户备注: {note}")
    lines.extend(
        [
            "",
            "说明: 基于 FINVIZ / ETF / 行业动量等数据源；可选环境变量 FINVIZ_API_KEY、FMP_API_KEY",
            "",
            "--- 报告正文 ---",
            "",
            md_body,
        ]
    )
    desc_path.write_text("\n".join(lines), encoding="utf-8")
    return desc_path


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="全球市场主题检测")
    parser.add_argument("query", nargs="?", help="可选备注（写入报告头）")
    parser.add_argument("--query", dest="query_opt", help="可选备注")
    args = parser.parse_args()
    note = (args.query_opt or args.query or "").strip()

    try:
        desc_path = run_scan(note)
        print(f"描述: {desc_path}")
    except subprocess.TimeoutExpired:
        print(
            f"错误: 主题检测超时（>{DEFAULT_TIMEOUT_SEC}s），可设置 WIND_THEME_DETECTOR_TIMEOUT_SEC",
            file=sys.stderr,
        )
        sys.exit(2)
    except Exception as exc:
        print(f"错误: {exc}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
