import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from agent_skill_stub import main_entry

if __name__ == "__main__":
    main_entry(
        skill_label="多空论证",
        output_subdir="bull_bear_case_builder_skill",
        skill_md_name="bull_bear_case_builder_skill",
    )
