import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="按主题选股",
        skill_label="主题选股",
        output_subdir="Wind_ThematicScreening",
        default_query="人工智能产业链主题选股",
    )
