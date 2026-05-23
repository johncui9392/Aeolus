import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="市场规模测算与战略建模",
        skill_label="市场规模测算与战略建模",
        output_subdir="Wind_MarketSizing",
        default_query="中国储能市场规模测算",
    )
