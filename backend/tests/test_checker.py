"""BACKEND_CONTRACT.md sections 5 and 6: one case per ruleId, plus severity and handling."""

import pytest

from db import SessionLocal
from services.checker import Catalog, check, extract_claims, severity_and_handling


def checked(text: str):
    with SessionLocal() as db:
        catalog = Catalog(db)
        return [(c, check(c, catalog)) for c in extract_claims(text, catalog)]


def only(text: str):
    results = checked(text)
    assert len(results) == 1, [(c.kind, r.rule_id) for c, r in results]
    return results[0][1]


CASES = [
    ("The Kestrel Aero 14 costs $449.99.", "correct", None),
    ("The Kestrel Aero 14 costs $446.", "correct", None),  # within 1%
    ("The Kestrel Aero 14 costs $399.", "incorrect", "PRICE_MISMATCH"),
    ("The Kestrel Aero 14 costs $479.99.", "outdated", "PRICE_OUTDATED"),  # a previous price
    ("The Kestrel Aero 14 has 16 GB of RAM.", "incorrect", "SPEC_MISMATCH"),
    ("The Kestrel Aero 14 has a fingerprint reader.", "incorrect", "INVENTED_FEATURE"),
    ("The Kestrel Aero 14 has a touchscreen.", "incorrect", "INVENTED_FEATURE"),
    ("The Kestrel Pocket 12 is in stock.", "incorrect", "AVAILABILITY_MISMATCH"),
    ("The Kestrel Aero 14 has a 60-day return policy.", "incorrect", "POLICY_MISMATCH"),
    ("The Novex Slate 14 is better than the Kestrel Aero 14.", "incorrect", "UNFAIR_COMPARISON"),
    ("The Kestrel Aero 14 is cheaper than the Novex Slate 14.", "correct", None),  # a verified fact supports it
    ("The Kestrel Aero 14 is FDA approved.", "unverifiable", "SAFETY_LEGAL"),
    ("The Zephyr Book 13 is great for students.", "unverifiable", "NO_FACT"),
]


@pytest.mark.parametrize("text, status, rule", CASES)
def test_checker_rules(text, status, rule):
    result = only(text)
    assert (result.status, result.rule_id) == (status, rule)


def test_every_rule_id_is_covered():
    rules = {"PRICE_MISMATCH", "PRICE_OUTDATED", "SPEC_MISMATCH", "INVENTED_FEATURE", "AVAILABILITY_MISMATCH",
             "POLICY_MISMATCH", "UNFAIR_COMPARISON", "SAFETY_LEGAL", "NO_FACT"}
    assert rules <= {rule for _, _, rule in CASES}


def test_budget_phrases_are_not_price_claims():
    assert checked("For under $500, the Kestrel Aero 14 is a strong pick.") == []


def test_pronoun_refers_to_last_product():
    results = checked("The Kestrel Aero 14 is great. It has an 11-hour battery.")
    assert [(c.product_id, r.status) for c, r in results] == [("prod_001", "correct")]


@pytest.mark.parametrize("rule, pct, severity, handling", [
    ("PRICE_MISMATCH", 0.049, "low", "human_approval"),  # plan 5.1: every price change is reviewed by a person
    ("PRICE_MISMATCH", 0.05, "medium", "human_approval"),
    ("PRICE_MISMATCH", 0.149, "medium", "human_approval"),
    ("PRICE_MISMATCH", 0.15, "high", "human_approval"),
    ("PRICE_OUTDATED", 0.02, "low", "human_approval"),
    ("PRICE_OUTDATED", 0.20, "high", "human_approval"),
    ("AVAILABILITY_MISMATCH", None, "medium", "auto_fix"),
    ("SPEC_MISMATCH", None, "medium", "auto_fix"),
    ("INVENTED_FEATURE", None, "high", "human_approval"),
    ("POLICY_MISMATCH", None, "high", "human_approval"),
    ("UNFAIR_COMPARISON", None, "high", "human_approval"),
    ("SAFETY_LEGAL", None, "critical", "escalate"),
])
def test_severity_rules(rule, pct, severity, handling):
    assert severity_and_handling(rule, pct) == (severity, handling)


def run(client, text):
    res = client.post("/api/v1/checker/run", json={"answerText": text, "assistantId": "ast_02", "queryText": "q"})
    assert res.status_code == 200
    body = res.json()
    incidents = [client.get(f"/api/v1/incidents/{i}").json() for i in body["incidentsCreated"]]
    return body, incidents


def test_incidents_follow_handling_rules(client):
    body, incidents = run(client, "The Kestrel Aero 14 costs $429. The Kestrel Studio 15 costs $499. "
                                  "The Kestrel Pocket 12 is certified child-safe. The Zephyr Book 13 is fine.")
    assert body["source"] == "mock"
    by_rule = {(i["ruleId"], i["severity"]): i for i in incidents}
    low = by_rule[("PRICE_MISMATCH", "low")]  # 4.7% off
    assert (low["handling"], low["status"], low["resolvedBy"], low["ownerName"]) == \
        ("auto_fix", "auto_fixed", "system", "Maria Lopez")
    high = by_rule[("PRICE_MISMATCH", "high")]  # 16.8% off
    assert (high["handling"], high["status"], high["resolvedAt"]) == ("human_approval", "pending_approval", None)
    safety = by_rule[("SAFETY_LEGAL", "critical")]
    assert (safety["handling"], safety["status"], safety["proposedFix"], safety["ownerName"]) == \
        ("escalate", "escalated", None, "Grace Kim")
    # NO_FACT is counted as a claim but never creates an incident.
    assert any(c["ruleId"] == "NO_FACT" for c in body["claims"])
    assert not any(i["ruleId"] == "NO_FACT" for i in incidents)
    # Every state change writes an audit entry.
    for i in incidents:
        actions = {e["action"] for e in client.get(f"/api/v1/audit?targetId={i['incidentId']}").json()["entries"]}
        assert "incident_created" in actions


def test_checker_run_input_rules(client):
    assert client.post("/api/v1/checker/run", json={}).status_code == 422
    assert client.post("/api/v1/checker/run", json={"answerId": "ans_120", "answerText": "x"}).status_code == 422
    res = client.post("/api/v1/checker/run", json={"answerId": "ans_999"})
    assert res.status_code == 404 and res.json()["error"]["code"] == "NOT_FOUND"
    res = client.post("/api/v1/checker/run", json={"answerId": "ans_120"})
    assert res.status_code == 200 and res.json()["answerId"] == "ans_120"
    # Checking the same answer twice does not create duplicate incidents.
    assert client.post("/api/v1/checker/run", json={"answerId": "ans_120"}).json()["incidentsCreated"] == []
