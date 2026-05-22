import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="equity-investment-thesis",
        skill_label="个股投资逻辑研究",
        output_subdir="Wind_EquityInvestmentThesis",
    )
