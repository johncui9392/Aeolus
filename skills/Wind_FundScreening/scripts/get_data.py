import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="基金筛选与投资建议",
        skill_label="基金筛选与投资建议",
        output_subdir="Wind_FundScreening",
        default_query="稳健型投资者基金推荐",
    )
