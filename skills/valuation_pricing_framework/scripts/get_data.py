import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from agent_skill_stub import main_entry

if __name__ == "__main__":
    main_entry(
        skill_label="估值与定价框架",
        output_subdir="valuation_pricing_framework",
        skill_md_name="valuation_pricing_framework",
    )
