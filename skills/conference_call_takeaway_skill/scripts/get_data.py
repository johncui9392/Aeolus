import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from agent_skill_stub import main_entry

if __name__ == "__main__":
    main_entry(
        skill_label="业绩会提炼",
        output_subdir="conference_call_takeaway_skill",
        skill_md_name="conference_call_takeaway_skill",
    )
