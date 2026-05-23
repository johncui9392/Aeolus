import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from agent_skill_stub import main_entry

if __name__ == "__main__":
    main_entry(
        skill_label="公告影响",
        output_subdir="major_announcement_impact_skill",
        skill_md_name="major_announcement_impact_skill",
    )
