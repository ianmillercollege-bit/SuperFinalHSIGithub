from fastapi import FastAPI
from fastapi.testclient import TestClient

from errors import register_error_handlers
from main import app

client = TestClient(app)


def assert_error_shape(body: dict, code: str) -> None:
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message"}
    assert body["error"]["code"] == code
    assert body["error"]["message"]


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "mock_mode": True}


def test_error_format_not_found():
    res = client.get("/does-not-exist")
    assert res.status_code == 404
    assert_error_shape(res.json(), "not_found")


def test_error_format_validation():
    # A throwaway app with the same handlers, so we can trigger a 422
    # without adding a real endpoint to the API.
    scratch = FastAPI()
    register_error_handlers(scratch)

    @scratch.get("/needs-int")
    def needs_int(n: int):
        return {"n": n}

    res = TestClient(scratch).get("/needs-int?n=abc")
    assert res.status_code == 422
    assert_error_shape(res.json(), "validation_error")


def test_error_format_unhandled():
    scratch = FastAPI()
    register_error_handlers(scratch)

    @scratch.get("/boom")
    def boom():
        raise RuntimeError("secret internals")

    res = TestClient(scratch, raise_server_exceptions=False).get("/boom")
    assert res.status_code == 500
    assert_error_shape(res.json(), "internal_error")
    assert "secret" not in res.text


def test_cors_allowed_origins():
    for origin in [
        "http://localhost:3000",
        "https://frontdoor-SCHOOL.vercel.app",
        "https://frontdoor-git-feature-abc.vercel.app",
    ]:
        res = client.get("/health", headers={"Origin": origin})
        assert res.headers.get("access-control-allow-origin") == origin


def test_cors_blocks_other_origins():
    res = client.get("/health", headers={"Origin": "https://evil.example.com"})
    assert "access-control-allow-origin" not in res.headers
