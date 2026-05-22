import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="post-market-debrief",
        skill_label="盘后复盘",
        output_subdir="Wind_PostMarketDebrief",
        default_query="今日A股市场盘后复盘",
    )
