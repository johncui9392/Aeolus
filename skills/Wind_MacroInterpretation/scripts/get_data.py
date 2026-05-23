import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="宏观数据解读",
        skill_label="宏观数据解读",
        output_subdir="Wind_MacroInterpretation",
        default_query="最新CPI PPI数据解读",
    )
