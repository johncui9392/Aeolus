import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from agent_skill_stub import main_entry

if __name__ == "__main__":
    main_entry(
        skill_label="战略级投资利器-回测",
        output_subdir="backtest_expert",
        skill_md_name="backtest_expert",
    )
