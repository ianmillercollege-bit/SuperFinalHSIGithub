"""Bad input never causes a 500: every failure uses the contract error shape (section 2)."""

import json
import math
import time

import pytest
from fastapi.testclient import TestClient

import constants as C
from main import app
from services.checker import severity_and_handling

# Server errors come back as responses here (not exceptions), so a 500 fails the assertion.
client = TestClient(app, raise_server_exceptions=False)
JSON = {"Content-Type": "application/json"}
CODES = {400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 405: "BAD_REQUEST",
         409: "CONFLICT", 422: "VALIDATION_ERROR"}
HUGE = "9" * 400  # too big for a float: becomes infinity
CHECK = {"assistantId": "ast_01", "queryText": "q"}
QUERY = {"question": "best laptop?", "assistantId": "ast_01"}


def assert_error(res, status):
    assert res.status_code == status, (res.status_code, res.text[:200])
    body = res.json()
    assert set(body) == {"error"} and set(body["error"]) == {"code", "message"}
    assert body["error"]["code"] == CODES[status] and body["error"]["message"]
    return body["error"]["message"]


# ---- Fixed: numbers too big to be real crashed with a 500 -------------------------------------------


@pytest.mark.parametrize("raw", [b"1e309", b"Infinity", b"-Infinity", b"NaN", HUGE.encode(), b'"' + HUGE.encode() + b'"'],
                         ids=["1e309", "Infinity", "-Infinity", "NaN", "400-digits", "400-digit-string"])
def test_connector_rejects_non_finite_max_price(raw):
    body = b'{"question":"x","assistantId":"ast_01","constraints":{"maxPrice":' + raw + b"}}"
    assert_error(client.post("/api/v1/connector/query", headers=JSON, content=body), 422)


def test_connector_ignores_unusable_dollar_amount_in_question():
    res = client.post("/api/v1/connector/query", json={"question": f"best laptop under ${HUGE}?", "assistantId": "ast_01"})
    assert res.status_code == 200
    assert res.json()["recommendation"] is not None  # no budget applied, still answered


@pytest.mark.parametrize("sentence", [
    f"The Kestrel Aero 14 costs ${HUGE}.",
    f"The Kestrel Aero 14 has {HUGE} GB of RAM.",
    f"The Kestrel Aero 14 is rated for {HUGE} hours of battery life.",
    f"The Kestrel Aero 14 weighs {HUGE} lb.",
    f"The Kestrel Aero 14 comes with {HUGE} GB of storage.",
    f"The Kestrel Aero 14 has a {HUGE}-inch display.",
])
def test_checker_skips_numbers_too_big_to_check(sentence):
    res = client.post("/api/v1/checker/run", json=dict(CHECK, answerText=sentence))
    assert res.status_code == 200
    assert res.json()["claims"] == []  # nothing checkable, nothing invented


def test_checker_still_checks_large_but_real_numbers():
    res = client.post("/api/v1/checker/run", json=dict(CHECK, answerText="The Kestrel Aero 14 costs $1000000."))
    claim = res.json()["claims"][0]
    assert (claim["ruleId"], claim["status"]) == ("PRICE_MISMATCH", "incorrect")
    incident = client.get(f"/api/v1/incidents/{res.json()['incidentsCreated'][0]}").json()
    assert incident["severity"] == "high"


@pytest.mark.parametrize("gap", [math.inf, math.nan, 10.0])
def test_price_severity_never_fails(gap):
    assert severity_and_handling("PRICE_MISMATCH", gap) == ("high", "human_approval")


# ---- Fixed: very long input tied up the server for about two minutes ----------------------------


def test_many_prices_in_one_sentence_stays_fast():
    text = ("The Kestrel Aero 14 costs " + "$1 " * 6000)[:C.MAX_ANSWER_CHARS - 1] + "."
    start = time.time()
    res = client.post("/api/v1/checker/run", json=dict(CHECK, answerText=text))
    assert res.status_code == 200 and time.time() - start < 5
    assert len(res.json()["claims"]) <= C.MAX_CLAIMS_PER_ANSWER
    entry = next(e for e in client.get(f"/api/v1/audit?targetId={res.json()['answerId']}").json()["entries"]
                 if e["action"] == "claim_extracted")
    assert f"Only the first {C.MAX_CLAIMS_PER_ANSWER} were checked." in entry["details"]


# ---- Fixed: missing limits -------------------------------------------------------------------------


@pytest.mark.parametrize("path, body", [
    ("/api/v1/connector/query", dict(QUERY, question="")),
    ("/api/v1/connector/query", dict(QUERY, question="   ")),
    ("/api/v1/connector/query", dict(QUERY, question="x" * (C.MAX_QUESTION_CHARS + 1))),
    ("/api/v1/checker/run", dict(CHECK, answerText="x" * (C.MAX_ANSWER_CHARS + 1))),
    ("/api/v1/checker/run", dict(CHECK, answerText="x", queryText="   ")),
    ("/api/v1/checker/run", dict(CHECK, answerText="x", queryText="q" * (C.MAX_QUESTION_CHARS + 1))),
    ("/api/v1/incidents/inc_44/approve", {"approverName": "G" * (C.MAX_NAME_CHARS + 1)}),
    ("/api/v1/incidents/inc_44/approve", {"approverName": "Grace Kim", "note": "n" * (C.MAX_NOTE_CHARS + 1)}),
    ("/api/v1/incidents/inc_45/reject", {"approverName": "Grace Kim", "note": "n" * (C.MAX_NOTE_CHARS + 1)}),
    ("/api/v1/incidents/inc_47/resolve", {"resolverName": "Grace Kim", "note": "n" * (C.MAX_NOTE_CHARS + 1)}),
])
def test_blank_and_oversized_text_is_422(path, body):
    assert_error(client.post(path, json=body), 422)


def test_limits_leave_normal_input_alone():
    assert client.post("/api/v1/connector/query", json=dict(QUERY, question="q" * C.MAX_QUESTION_CHARS)).status_code == 200
    ok = client.post("/api/v1/checker/run", json=dict(CHECK, answerText="x" * C.MAX_ANSWER_CHARS))
    assert ok.status_code == 200


# ---- No Content-Type header, empty body -----------------------------------------------------------

POSTS = {
    "/api/v1/shopper/recommend": {"answers": []},
    "/api/v1/connector/query": QUERY,
    "/api/v1/checker/run": dict(CHECK, answerText="The Kestrel Aero 14 costs $399."),
    "/api/v1/incidents/inc_44/approve": {"approverName": "Grace Kim"},
    "/api/v1/incidents/inc_45/reject": {"approverName": "Grace Kim", "note": "x"},
    "/api/v1/incidents/inc_47/resolve": {"resolverName": "Grace Kim", "note": "x"},
}


@pytest.mark.parametrize("path", POSTS)
def test_no_content_type_is_a_clean_422(path):
    message = assert_error(client.post(path, content=json.dumps(POSTS[path]).encode()), 422)
    assert "Content-Type" in message and "application/json" in message
    message = assert_error(client.post(path, headers={"Content-Type": "text/plain"},
                                       content=json.dumps(POSTS[path]).encode()), 422)
    assert "application/json" in message


@pytest.mark.parametrize("path", POSTS)
def test_empty_body_is_a_clean_422(path):
    for kwargs in ({"headers": JSON, "content": b""}, {}):
        message = assert_error(client.post(path, **kwargs), 422)
        assert message.startswith("Request body is missing.")


@pytest.mark.parametrize("path", POSTS)
@pytest.mark.parametrize("raw", [b"{", b"null", b"[]", b'"x"', b"123", b"\xff\xfe\x00", b"[" * 50000 + b"]" * 50000],
                         ids=["unclosed", "null", "list", "string", "number", "not-utf8", "deeply-nested"])
def test_malformed_json_never_500(path, raw):
    res = client.post(path, headers=JSON, content=raw)
    assert res.status_code in (400, 422), (path, raw[:10], res.status_code)
    assert_error(res, res.status_code)


# ---- Sweep: bad values in every field of every POST body --------------------------------------------


@pytest.mark.parametrize("path", POSTS)
def test_every_field_with_bad_values_never_500(path):
    good = POSTS[path]
    for key in good:
        for bad in ["", "   ", None, 123, -1, 1.5, [], {}, True, "x" * 50_000]:
            res = client.post(path, json=dict(good, **{key: bad}))
            assert res.status_code < 500, (path, key, bad)
            if res.status_code >= 400:
                assert_error(res, res.status_code)


@pytest.mark.parametrize("path", ["/api/v1/answers", "/api/v1/claims", "/api/v1/incidents", "/api/v1/audit"])
@pytest.mark.parametrize("limit", ["-1", "0", "101", "999999999999999999999", "abc", "", HUGE, "NaN"],
                         ids=["negative", "zero", "101", "huge", "text", "empty", "400-digits", "NaN"])
def test_bad_limit_is_422(path, limit):
    assert_error(client.get(f"{path}?limit={limit}"), 422)


@pytest.mark.parametrize("path", ["/api/v1/visibility/summary", "/api/v1/sources", "/api/v1/metrics/trust",
                                  "/api/v1/report", "/api/v1/client/visibility", "/api/v1/client/report"])
@pytest.mark.parametrize("days", ["-1", "0", "31", "abc", "", HUGE],
                         ids=["negative", "zero", "31", "text", "empty", "400-digits"])
def test_bad_days_is_422(path, days):
    assert_error(client.get(f"{path}?days={days}", headers={"X-API-Key": "fd_demo_owner_2026"}), 422)


@pytest.mark.parametrize("incident_id", ["inc_99", "nope", "x" * 5000, "inc_44;DROP TABLE incidents"],
                         ids=["unknown", "text", "5000-chars", "sql-injection"])
def test_unknown_ids_are_404(incident_id):
    assert_error(client.get(f"/api/v1/incidents/{incident_id}"), 404)
    assert_error(client.post(f"/api/v1/incidents/{incident_id}/approve", json={"approverName": "Grace Kim"}), 404)
