import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from agent_skill_stub import main_entry

if __name__ == "__main__":
    main_entry(
        skill_label="止损纪律",
        output_subdir="stop_loss_discipline_skill",
        skill_md_name="stop_loss_discipline_skill",
    )
