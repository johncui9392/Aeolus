import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="基金对比分析",
        skill_label="公募基金对比分析",
        output_subdir="Wind_FundCompare",
        default_query="易方达蓝筹精选 vs 兴全合润",
    )
