import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="全球上市公司季报点评",
        skill_label="全球上市公司财报点评",
        output_subdir="Wind_GlobalEarningsReview",
        default_query="贵州茅台 2024年报点评",
    )
