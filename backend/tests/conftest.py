import os
import sys

# Let tests import main.py, errors.py, settings.py from backend/.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
