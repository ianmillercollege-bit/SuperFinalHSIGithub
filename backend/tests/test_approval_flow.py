"""BACKEND_CONTRACT.md section 7: approve, reject, resolve, with the 403 / 409 / 404 / 422 rules.

Seeded incidents used: inc_44 (INVENTED_FEATURE, pending, Grace Kim), inc_45 (UNFAIR_COMPARISON, pending,
Grace Kim), inc_46 (PRICE_MISMATCH high, pending, Maria Lopez), inc_47 (SAFETY_LEGAL critical, escalated,
Grace Kim), inc_12 (auto_fixed).
"""


def post(client, incident_id, action, body):
    return client.post(f"/api/v1/incidents/{incident_id}/{action}", json=body)


def audit_actions(client, incident_id):
    return [e["action"] for e in client.get(f"/api/v1/audit?targetId={incident_id}").json()["entries"]]


def test_approval_flow(client):
    # Approve by the owner.
    res = post(client, "inc_44", "approve", {"approverName": "Grace Kim", "note": "Checked the spec sheet."})
    assert res.status_code == 200
    body = res.json()
    assert (body["status"], body["resolvedBy"]) == ("approved", "Grace Kim") and body["resolvedAt"]
    assert audit_actions(client, "inc_44")[0] == "approved"

    # Reject as a false alarm.
    res = post(client, "inc_45", "reject", {"approverName": "Grace Kim", "note": "Supported.", "falseAlarm": True})
    assert res.status_code == 200
    assert (res.json()["status"], res.json()["falseAlarm"]) == ("rejected", True)
    assert audit_actions(client, "inc_45")[0] == "rejected"

    # Resolve an escalated safety/legal incident.
    res = post(client, "inc_47", "resolve", {"resolverName": "Grace Kim", "note": "Legal confirmed."})
    assert res.status_code == 200 and res.json()["status"] == "resolved"
    assert audit_actions(client, "inc_47")[0] == "resolved"


def test_forbidden_cases(client):
    # Wrong person.
    res = post(client, "inc_44", "approve", {"approverName": "Maria Lopez"})
    assert res.status_code == 403 and res.json()["error"]["code"] == "FORBIDDEN"
    assert post(client, "inc_47", "resolve", {"resolverName": "Dev Patel", "note": "x"}).status_code == 403
    # The CIRQO Product Owner owns no incident types, so cannot decide any incident.
    for incident_id, action in (("inc_44", "approve"), ("inc_45", "reject"), ("inc_46", "approve")):
        body = {"approverName": "Dev Patel", "note": "x"}
        assert post(client, incident_id, action, body).status_code == 403, incident_id
    # Critical incidents can never be approved or rejected, even by their owner.
    for action, body in (("approve", {"approverName": "Grace Kim"}),
                         ("reject", {"approverName": "Grace Kim", "note": "x"})):
        res = post(client, "inc_47", action, body)
        assert res.status_code == 403, action
    # Nothing changed.
    assert client.get("/api/v1/incidents/inc_47").json()["status"] == "escalated"


def test_conflict_cases(client):
    assert post(client, "inc_44", "approve", {"approverName": "Grace Kim"}).status_code == 200
    res = post(client, "inc_44", "approve", {"approverName": "Grace Kim"})  # already approved
    assert res.status_code == 409 and res.json()["error"]["code"] == "CONFLICT"
    assert post(client, "inc_12", "reject", {"approverName": "Maria Lopez", "note": "x"}).status_code == 409
    # Resolve only works on escalated incidents.
    assert post(client, "inc_46", "resolve", {"resolverName": "Maria Lopez", "note": "x"}).status_code == 409


def test_forbidden_is_checked_before_conflict(client):
    # inc_47 is escalated (so approve would also be a 409), but 403 must win.
    assert post(client, "inc_47", "approve", {"approverName": "Grace Kim"}).status_code == 403


def test_not_found_and_validation(client):
    res = post(client, "inc_99", "approve", {"approverName": "Dev Patel"})
    assert res.status_code == 404 and res.json()["error"]["message"] == "Incident inc_99 does not exist."
    for action, body in (("approve", {}), ("approve", {"approverName": "  "}),
                         ("reject", {"approverName": "Grace Kim"}), ("reject", {"approverName": "Grace Kim", "note": ""}),
                         ("resolve", {"resolverName": "Grace Kim"})):
        res = post(client, "inc_45" if action != "resolve" else "inc_47", action, body)
        assert res.status_code == 422 and res.json()["error"]["code"] == "VALIDATION_ERROR", (action, body)


def test_false_alarm_rate_counts_human_rejections(client):
    before = client.get("/api/v1/metrics/trust").json()["current"]["falseAlarmRate"]
    post(client, "inc_45", "reject", {"approverName": "Grace Kim", "note": "Supported.", "falseAlarm": True})
    after = client.get("/api/v1/metrics/trust").json()["current"]["falseAlarmRate"]
    assert after > before


def test_audit_log_is_append_only(client):
    for method in ("put", "patch", "delete"):
        res = getattr(client, method)("/api/v1/audit")
        assert res.status_code == 405 and res.json()["error"]["code"] == "BAD_REQUEST"
