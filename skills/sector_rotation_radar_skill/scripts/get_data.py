import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from agent_skill_stub import main_entry

if __name__ == "__main__":
    main_entry(
        skill_label="板块轮动雷达",
        output_subdir="sector_rotation_radar_skill",
        skill_md_name="sector_rotation_radar_skill",
    )
