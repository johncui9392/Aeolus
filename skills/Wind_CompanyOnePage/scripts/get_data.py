import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="公司一页纸",
        skill_label="上市公司一页纸投资报告",
        output_subdir="Wind_CompanyOnePage",
        default_query="贵州茅台 一页纸投资报告",
    )
