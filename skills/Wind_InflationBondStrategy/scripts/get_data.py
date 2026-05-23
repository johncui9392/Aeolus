import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="通胀情景债券轮动策略",
        skill_label="通胀情景债券交易策略",
        output_subdir="Wind_InflationBondStrategy",
        default_query="当前通胀情景下债券配置建议",
    )
