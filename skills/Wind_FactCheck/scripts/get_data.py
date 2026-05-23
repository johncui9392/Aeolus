import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="事实核验",
        skill_label="金融事实核验",
        output_subdir="Wind_FactCheck",
        default_query="核验以下金融数据是否准确",
    )
