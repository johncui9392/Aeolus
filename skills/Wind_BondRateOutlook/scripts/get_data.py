import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="债券利率走势研判",
        skill_label="债券利率走势研判",
        output_subdir="Wind_BondRateOutlook",
        default_query="10年期国债利率未来走势研判",
    )
