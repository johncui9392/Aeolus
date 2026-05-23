import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from agent_skill_stub import main_entry

if __name__ == "__main__":
    main_entry(
        skill_label="DCF 估值模型",
        output_subdir="dcf_model",
        skill_md_name="dcf_model",
    )
