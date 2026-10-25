import sys
from pathlib import Path

# Make app.py / data_sorter.py importable when running `pytest` from anywhere.
sys.path.insert(0, str(Path(__file__).resolve().parent))
