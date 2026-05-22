import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="market_regime_switch_skill",
        skill_label="市场状态切换",
        output_subdir="Wind_MarketRegimeSwitch",
        default_query="当前A股市场处于进攻、防守还是震荡阶段，给出证据与仓位建议",
    )
