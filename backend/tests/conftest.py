import json
import os
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
MOCK_DIR = BACKEND.parent / "shared" / "mock"

# Let tests import main.py, errors.py, settings.py from backend/.
sys.path.insert(0, str(BACKEND))
# Tests use the small fixture set so results are predictable, whatever is in backend/seed/data/.
os.environ["SEED_DIR"] = str(BACKEND / "tests" / "fixtures")

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402
from seed_loader import rebuild_database  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_database():
    """Every test starts from freshly loaded seed data."""
    rebuild_database()
    yield


@pytest.fixture
def client():
    return TestClient(app)


def load_mock(name: str) -> dict:
    return json.loads((MOCK_DIR / name).read_text(encoding="utf-8"))


DEFAULT_ANSWERS = {
    "answers": [{"questionId": "q_budget", "optionId": "b_500"}, {"questionId": "q_use", "optionId": "u_school"}],
    "swipes": [{"optionId": "s_battery", "liked": True}, {"optionId": "s_light", "liked": True},
               {"optionId": "s_screen", "liked": False}, {"optionId": "s_touch", "liked": False}],
}
