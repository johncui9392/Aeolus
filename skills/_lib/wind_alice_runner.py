"""
万得 Wind Alice Agent 共享适配层（Aeolus）。

通过内嵌的 skills/wind-alice-runtime 调用 Alice，将流式分析结果写入描述文件；
若 Alice 返回可下载附件（xlsx/md 等），下载到同目录供前端预览。
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import uuid
from pathlib import Path
from typing import List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parents[2]
ALICE_ROOT = REPO_ROOT / "skills" / "wind-alice-runtime"
ALICE_CLI = ALICE_ROOT / "scripts" / "wind-alice.mjs"

WIND_API_KEY = (os.environ.get("WIND_API_KEY") or "").strip()
DEFAULT_TIMEOUT_SEC = int(os.environ.get("WIND_ALICE_TIMEOUT_SEC") or "1800")

AGENT_VALUE_PREFIX = "agentResult.value:"
FILE_SAVED_RE = re.compile(r"已保存[：:]\s*(.+?)\s*$")


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


def _extract_alice_text(stdout: str) -> str:
    chunks: List[str] = []
    for line in (stdout or "").splitlines():
        if line.startswith(AGENT_VALUE_PREFIX):
            chunks.append(line[len(AGENT_VALUE_PREFIX) :].strip())
    if chunks:
        return "\n\n".join(chunks).strip()
    trimmed = (stdout or "").strip()
    if trimmed and not trimmed.startswith("status:") and "headers:" not in trimmed[:200]:
        return trimmed
    return ""


def _extract_downloaded_files(stderr: str) -> List[Path]:
    found: List[Path] = []
    seen = set()
    for line in (stderr or "").splitlines():
        m = FILE_SAVED_RE.search(line.strip())
        if not m:
            continue
        raw = m.group(1).strip().strip('"').strip("'")
        if not raw:
            continue
        p = Path(raw)
        key = str(p.resolve()) if p.exists() else raw
        if key in seen:
            continue
        seen.add(key)
        if p.is_file():
            found.append(p)
    return found


def _split_body_and_attachments(text: str, files: List[Path]) -> Tuple[str, List[Path]]:
    body = (text or "").strip()
    if not body and files:
        return "", files
    return body, files


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
        cwd=str(out_dir),
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

    body_text = _extract_alice_text(stdout)
    attachment_files = _extract_downloaded_files(stderr)
    body_text, attachment_files = _split_body_and_attachments(body_text, attachment_files)

    suffix = uuid.uuid4().hex[:8]
    desc_path = out_dir / f"{output_subdir}_{suffix}_description.txt"

    lines = [
        f"万得 Wind · {skill_label}",
        "=" * 40,
        f"Alice Skill: {alice_skill}",
        f"查询内容: {q}",
        "",
    ]

    if body_text:
        lines.extend(["--- 分析结果 ---", "", body_text])
    elif attachment_files:
        lines.append("（本次结果以附件文件为主，请查看下方文件预览）")
    else:
        lines.append("(Alice 未返回正文，请检查 Skill 名称与网络)")

    desc_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"描述: {desc_path}")
    for fp in attachment_files:
        print(str(fp.resolve()))

    if stderr:
        print(f"\n--- stderr ---\n{stderr}", file=sys.stderr)

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
        run_alice(
            query=query,
            alice_skill=alice_skill,
            skill_label=skill_label,
            output_subdir=output_subdir,
        )
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
