import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="信用分析",
        skill_label="信用分析",
        output_subdir="Wind_CreditAnalysis",
        default_query="某城投平台信用分析",
    )
