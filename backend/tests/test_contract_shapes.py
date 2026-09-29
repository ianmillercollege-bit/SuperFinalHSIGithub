"""Every endpoint returns the same shape as its shared/mock/ file (BACKEND_CONTRACT.md section 10),
so the frontend can switch from mocks to the real API without changes."""

import json

import pytest
from conftest import DEFAULT_ANSWERS, load_mock


def same_shape(real, mock, path="$"):
    """Same keys at every level. Values may differ; nulls and empty lists are allowed either side."""
    if real is None or mock is None:
        return
    if isinstance(mock, dict):
        assert isinstance(real, dict), path
        assert set(real) == set(mock), f"{path}: keys differ: {set(real) ^ set(mock)}"
        for k in mock:
            same_shape(real[k], mock[k], f"{path}.{k}")
    elif isinstance(mock, list):
        assert isinstance(real, list), path
        if real and mock:
            for item in real:
                same_shape(item, mock[0], f"{path}[]")
    else:
        assert type(real) is type(mock) or {type(real), type(mock)} <= {int, float}, \
            f"{path}: {type(real).__name__} vs {type(mock).__name__}"


GETS = [
    ("/health", "health.json"),
    ("/api/v1/shopper/questions", "shopper_questions.json"),
    ("/api/v1/products", "products.json"),
    ("/api/v1/visibility/summary?days=30", "visibility_summary.json"),
    ("/api/v1/answers?limit=50", "answers.json"),
    ("/api/v1/sources?days=30", "sources.json"),
    ("/api/v1/claims", "claims.json"),
    ("/api/v1/incidents", "incidents.json"),
    ("/api/v1/incidents/inc_44", "incident_detail.json"),
    ("/api/v1/owners", "owners.json"),
    ("/api/v1/audit", "audit.json"),
    ("/api/v1/metrics/trust?days=30", "metrics_trust.json"),
    ("/api/v1/report?days=30", "report.json"),
    ("/api/v1/connector/manifest", "connector_manifest.json"),
]


@pytest.mark.parametrize("path, mock", GETS)
def test_get_shapes(client, path, mock):
    res = client.get(path)
    assert res.status_code == 200
    same_shape(res.json(), load_mock(mock))


@pytest.mark.parametrize("path, body, mock", [
    ("/api/v1/shopper/recommend", DEFAULT_ANSWERS, "shopper_recommend.json"),
    ("/api/v1/checker/run", {"answerText": "The Kestrel Aero 14 costs $429 and has a 12-hour battery.",
                             "assistantId": "ast_03", "queryText": "best laptops"}, "checker_run.json"),
    ("/api/v1/incidents/inc_44/approve", {"approverName": "Grace Kim"}, "incident_approve.json"),
    ("/api/v1/incidents/inc_45/reject", {"approverName": "Grace Kim", "note": "ok", "falseAlarm": True},
     "incident_reject.json"),
    ("/api/v1/incidents/inc_47/resolve", {"resolverName": "Grace Kim", "note": "ok"}, "incident_resolve.json"),
    ("/api/v1/connector/query", {"question": "What is the best laptop under $500 for school?", "assistantId": "ast_01",
                                 "constraints": {"maxPrice": 500, "useCase": "school",
                                                 "mustHave": ["battery", "light"]}}, "connector_query.json"),
])
def test_post_shapes(client, path, body, mock):
    res = client.post(path, json=body)
    assert res.status_code == 200, res.text
    same_shape(res.json(), load_mock(mock))


def test_error_shapes(client):
    same_shape(client.get("/api/v1/incidents/inc_99").json(), load_mock("error_not_found.json"))
    same_shape(client.get("/api/v1/claims?limit=0").json(), load_mock("error_validation.json"))


def test_seed_only_fields_never_leak(client):
    for path, _ in GETS:
        text = json.dumps(client.get(path).json())
        for field in ("isClient", "billingTier", "priceHistory", "is_client", "billing_tier"):
            assert field not in text, (path, field)


def test_whole_number_specs_stay_whole(client):
    specs = client.get("/api/v1/products").json()["products"][0]["specs"]
    assert specs["ramGb"] == 8 and isinstance(specs["ramGb"], int)
