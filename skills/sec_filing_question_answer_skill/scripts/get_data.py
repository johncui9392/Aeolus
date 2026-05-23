import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from agent_skill_stub import main_entry

if __name__ == "__main__":
    main_entry(
        skill_label="监管文件答疑",
        output_subdir="sec_filing_question_answer_skill",
        skill_md_name="sec_filing_question_answer_skill",
    )
