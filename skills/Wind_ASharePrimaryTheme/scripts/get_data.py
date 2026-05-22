import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="a-share-primary-theme-identification",
        skill_label="A股主线识别",
        output_subdir="Wind_ASharePrimaryTheme",
        default_query="今日A股市场主线、情绪周期与明日观察重点",
    )
