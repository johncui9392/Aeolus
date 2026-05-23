"""Agent 工作流 Skill 的 Web 端占位：返回 SKILL.md 使用指引（Markdown 直出）。"""

from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def main_entry(*, skill_label: str, output_subdir: str, skill_md_name: str) -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description=skill_label)
    parser.add_argument("query", nargs="?", help="自然语言问句")
    parser.add_argument("--query", dest="query_opt", help="自然语言问句")
    args = parser.parse_args()

    query = (args.query_opt or args.query or "").strip()
    skill_root = REPO_ROOT / "skills" / skill_md_name
    skill_md = skill_root / "SKILL.md"
    md_hint = ""
    if skill_md.is_file():
        md_hint = f"\n\nSkill 文件：`skills/{skill_md_name}/SKILL.md`"

    body = f"""# {skill_label}

此 Skill 为 **Agent 工作流**（Cursor / Claude Code 读取 SKILL.md 驱动），Web 端不直接执行云端推理。

## 你的问题

{query or '（未输入）'}

## 在 Agent 中使用

```bash
npx skills add https://gitee.com/wind_info/wind-skills.git --skill {skill_md_name} -y
```

然后在 Cursor 中直接提问即可。{md_hint}

## 数据来源

- 万得官方 Skill 仓库：[wind-skills](https://gitee.com/wind_info/wind-skills)
- AIFin Market：[Skills 市场](https://aifinmarket.wind.com.cn/#/market?tab=skills)
"""

    out_dir = Path.cwd() / "miaoxiang" / output_subdir
    out_dir.mkdir(parents=True, exist_ok=True)
    suffix = uuid.uuid4().hex[:8]
    desc_path = out_dir / f"{output_subdir}_{suffix}_description.txt"
    desc_path.write_text(body, encoding="utf-8")
    print(f"描述: {desc_path}")
