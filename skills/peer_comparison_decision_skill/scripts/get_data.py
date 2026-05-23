import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from agent_skill_stub import main_entry

if __name__ == "__main__":
    main_entry(
        skill_label="同业比选",
        output_subdir="peer_comparison_decision_skill",
        skill_md_name="peer_comparison_decision_skill",
    )
