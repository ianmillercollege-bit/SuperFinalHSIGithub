"""The checker's measured accuracy on the labelled test set (backend/eval/) must not get worse.

Floors are the score when the test set was written. Raise them when the checker improves.
"""

import sys
from collections import Counter
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "eval"))
import checker_eval  # noqa: E402

from db import SessionLocal  # noqa: E402
from services.checker import Catalog  # noqa: E402

MIN_CATCH_RATE = 58 / 67      # mistakes caught with the right rule
MAX_FALSE_ALARMS = 0          # correct sentences flagged as mistakes
MIN_PRECISION = 1.0           # share of flags that were right


@pytest.fixture
def score():
    with SessionLocal() as db:
        return checker_eval.evaluate(checker_eval.load_cases(), Catalog(db))


def test_labels_are_valid():
    cases = checker_eval.load_cases()
    assert len(cases) >= 90
    assert len({c["id"] for c in cases}) == len(cases)
    assert len({c["text"] for c in cases}) == len(cases)
    for case in cases:
        assert set(case["expect"]) <= set(checker_eval.RULES) | {"CORRECT"}, case["id"]
    covered = Counter(label for case in cases for label in case["expect"])
    assert all(covered[rule] >= 4 for rule in checker_eval.RULES)  # every rule is tested several times
    assert covered["CORRECT"] >= 25  # plenty of correct sentences to measure false alarms


def test_checker_accuracy_does_not_get_worse(score):
    assert score.catch_rate >= MIN_CATCH_RATE, [m[0]["id"] for m in score.misses]
    assert score.false_alarms <= MAX_FALSE_ALARMS, [a[0]["id"] for a in score.alarms]
    assert score.precision >= MIN_PRECISION


def test_report_is_up_to_date(score):
    written = (Path(checker_eval.EVAL_DIR) / "REPORT.md").read_text(encoding="utf-8").replace("\r\n", "\n")
    assert written == checker_eval.report(score), "rerun: python backend/eval/checker_eval.py"
