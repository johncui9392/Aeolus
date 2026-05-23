import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="上市公司调研问题清单",
        skill_label="上市公司调研问题清单",
        output_subdir="Wind_StockDDList",
        default_query="宁德时代 调研问题清单",
    )
