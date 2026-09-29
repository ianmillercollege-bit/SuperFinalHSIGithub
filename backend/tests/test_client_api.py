"""CLIENT_API_CONTRACT.md: read-only, X-API-Key, owner and viewer roles."""

OWNER = {"X-API-Key": "fd_demo_owner_2026"}
VIEWER = {"X-API-Key": "fd_demo_viewer_2026"}
PATHS = ["/api/v1/client/visibility?days=30", "/api/v1/client/metrics/trust?days=30",
         "/api/v1/client/incidents", "/api/v1/client/audit", "/api/v1/client/report?days=30"]


def test_client_api_auth(client):
    res = client.get("/api/v1/client/visibility")
    assert res.status_code == 401 and res.json()["error"]["code"] == "UNAUTHORIZED"
    res = client.get("/api/v1/client/visibility", headers={"X-API-Key": "wrong"})
    assert res.status_code == 401
    res = client.get("/api/v1/client/incidents", headers=VIEWER)
    assert res.status_code == 403 and res.json()["error"]["code"] == "FORBIDDEN"
    for path in PATHS:
        assert client.get(path, headers=OWNER).status_code == 200, path
    assert client.get("/api/v1/client/visibility", headers=VIEWER).status_code == 200


def test_viewer_scope(client):
    assert client.get("/api/v1/client/metrics/trust", headers=VIEWER).status_code == 200
    for path in ("/api/v1/client/audit", "/api/v1/client/report"):
        assert client.get(path, headers=VIEWER).status_code == 403


def test_same_shapes_as_dashboard(client):
    pairs = [("/api/v1/client/visibility", "/api/v1/visibility/summary"),
             ("/api/v1/client/metrics/trust", "/api/v1/metrics/trust"),
             ("/api/v1/client/incidents", "/api/v1/incidents"),
             ("/api/v1/client/audit", "/api/v1/audit")]
    for client_path, dashboard_path in pairs:
        assert client.get(client_path, headers=OWNER).json() == client.get(dashboard_path).json()


def test_read_only(client):
    for method in ("post", "put", "patch", "delete"):
        res = getattr(client, method)("/api/v1/client/incidents", headers=OWNER)
        assert res.status_code == 405 and res.json()["error"]["code"] == "BAD_REQUEST"
