import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from agent_skill_stub import main_entry

if __name__ == "__main__":
    main_entry(
        skill_label="财报解读",
        output_subdir="earnings_analysis",
        skill_md_name="earnings_analysis",
    )
