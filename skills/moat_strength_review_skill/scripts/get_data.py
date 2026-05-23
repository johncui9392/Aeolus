import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from agent_skill_stub import main_entry

if __name__ == "__main__":
    main_entry(
        skill_label="护城河评估",
        output_subdir="moat_strength_review_skill",
        skill_md_name="moat_strength_review_skill",
    )
