"""
万得 Wind Alice Agent 共享适配层（Aeolus）。

通过内嵌的 skills/wind-alice-runtime 调用 Alice，将流式分析结果写入描述文件供前端展示。
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
ALICE_ROOT = REPO_ROOT / "skills" / "wind-alice-runtime"
ALICE_CLI = ALICE_ROOT / "scripts" / "wind-alice.mjs"

WIND_API_KEY = (os.environ.get("WIND_API_KEY") or "").strip()
DEFAULT_TIMEOUT_SEC = int(os.environ.get("WIND_ALICE_TIMEOUT_SEC") or "1800")


def _require_wind_key() -> None:
    if WIND_API_KEY:
        return
    raise RuntimeError(
        """

╔══════════════════════════════════════════════════════════════╗
║                   WIND API KEY REQUIRED                      ║
╠══════════════════════════════════════════════════════════════╣
║  请在 Aeolus 用户中心配置 Wind API Key，或设置 WIND_API_KEY  ║
║  获取: https://aifinmarket.wind.com.cn/#/user/overview       ║
╚══════════════════════════════════════════════════════════════╝

"""
    )


def _default_output_dir(subdir: str) -> Path:
    return Path.cwd() / "miaoxiang" / subdir


def run_alice(
    query: str,
    alice_skill: str,
    skill_label: str,
    output_subdir: str,
    timeout_sec: int = DEFAULT_TIMEOUT_SEC,
    output_dir: Optional[Path] = None,
) -> Path:
    _require_wind_key()
    if not ALICE_CLI.is_file():
        raise FileNotFoundError(f"未找到 wind-alice CLI: {ALICE_CLI}")

    q = query.strip()
    if not q:
        raise ValueError("缺少查询文本")

    out_dir = output_dir or _default_output_dir(output_subdir)
    out_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        "node",
        str(ALICE_CLI),
        "--prompt",
        q,
        "--skill",
        alice_skill,
    ]
    env = {**os.environ, "WIND_API_KEY": WIND_API_KEY}

    proc = subprocess.run(
        cmd,
        cwd=str(ALICE_ROOT),
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout_sec,
    )

    stdout = (proc.stdout or "").strip()
    stderr = (proc.stderr or "").strip()
    if proc.returncode != 0:
        msg = stdout or stderr or f"wind-alice 退出码 {proc.returncode}"
        raise RuntimeError(msg)

    body = stdout
    if stderr:
        body = f"{body}\n\n--- stderr ---\n{stderr}".strip() if body else stderr

    suffix = uuid.uuid4().hex[:8]
    desc_path = out_dir / f"{output_subdir}_{suffix}_description.txt"
    lines = [
        f"万得 Wind · {skill_label}",
        "=" * 40,
        f"Alice Skill: {alice_skill}",
        f"查询内容: {q}",
        f"描述文件: {desc_path}",
        "",
        "数据与分析来源于万得 Alice Agent",
        "",
        "--- 分析结果 ---",
        "",
        body or "(Alice 未返回正文，请检查 Skill 名称与网络)",
    ]
    desc_path.write_text("\n".join(lines), encoding="utf-8")
    return desc_path


def main_entry(
    *,
    alice_skill: str,
    skill_label: str,
    output_subdir: str,
    default_query: str = "",
) -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description=skill_label)
    parser.add_argument("query", nargs="?", help="自然语言问句")
    parser.add_argument("--query", dest="query_opt", help="自然语言问句（显式参数）")
    args = parser.parse_args()

    query = (args.query_opt or args.query or default_query or "").strip()
    if not query:
        parser.print_help(sys.stderr)
        sys.exit(1)

    try:
        desc_path = run_alice(
            query=query,
            alice_skill=alice_skill,
            skill_label=skill_label,
            output_subdir=output_subdir,
        )
        print(f"描述: {desc_path}")
    except subprocess.TimeoutExpired:
        print(
            f"错误: Alice 分析超时（>{DEFAULT_TIMEOUT_SEC}s），可设置环境变量 WIND_ALICE_TIMEOUT_SEC 加大限制",
            file=sys.stderr,
        )
        sys.exit(2)
    except Exception as exc:
        print(f"错误: {exc}", file=sys.stderr)
        sys.exit(2)


__all__ = ["run_alice", "main_entry"]
