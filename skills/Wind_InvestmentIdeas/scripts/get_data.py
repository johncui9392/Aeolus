import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="投资标的创意与筛选",
        skill_label="投资机会挖掘",
        output_subdir="Wind_InvestmentIdeas",
        default_query="科技板块投资机会挖掘",
    )
