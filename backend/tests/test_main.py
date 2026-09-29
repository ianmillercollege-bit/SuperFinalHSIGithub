from conftest import load_mock
from fastapi import FastAPI
from fastapi.testclient import TestClient

from errors import register_error_handlers
from main import app
from settings import Settings

client = TestClient(app)


def assert_error_shape(body: dict, code: str) -> None:
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message"}
    assert body["error"]["code"] == code
    assert body["error"]["message"]


def test_api_docs_use_product_name():
    # DECISIONS.md #18: user-facing text says CIRQO.
    assert client.get("/openapi.json").json()["info"]["title"] == "CIRQO API"
    assert "CIRQO API" in client.get("/docs").text


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "mockMode": True, "version": "0.1.0"}


def test_health_matches_mock_file():
    # The frontend builds against shared/mock/health.json, so the real response must match it.
    assert client.get("/health").json() == load_mock("health.json")


def test_error_format():
    # Contract section 11: 404 and 422 on real endpoints use the standard shape.
    res = client.get("/api/v1/incidents/inc_99")
    assert res.status_code == 404
    assert res.json() == {"error": {"code": "NOT_FOUND", "message": "Incident inc_99 does not exist."}}
    res = client.get("/api/v1/claims?limit=0")
    assert res.status_code == 422
    assert_error_shape(res.json(), "VALIDATION_ERROR")


def test_error_format_not_found():
    res = client.get("/does-not-exist")
    assert res.status_code == 404
    assert_error_shape(res.json(), "NOT_FOUND")


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
    assert_error_shape(res.json(), "VALIDATION_ERROR")


def test_error_format_wrong_method():
    # CLIENT_API_CONTRACT.md: 405 uses the standard shape with code BAD_REQUEST.
    res = client.post("/health")
    assert res.status_code == 405
    assert_error_shape(res.json(), "BAD_REQUEST")
    assert "GET" in res.headers.get("allow", "")


def test_error_format_unhandled():
    scratch = FastAPI()
    register_error_handlers(scratch)

    @scratch.get("/boom")
    def boom():
        raise RuntimeError("secret internals")

    res = TestClient(scratch, raise_server_exceptions=False).get("/boom")
    assert res.status_code == 500
    assert_error_shape(res.json(), "INTERNAL_ERROR")
    assert "secret" not in res.text


def test_error_mock_files_match_format():
    assert_error_shape(load_mock("error_not_found.json"), "NOT_FOUND")
    assert_error_shape(load_mock("error_validation.json"), "VALIDATION_ERROR")


def test_settings_defaults(monkeypatch):
    for var in ("MOCK_MODE", "AI_MODEL", "FRONTEND_ORIGINS", "ANTHROPIC_API_KEY"):
        monkeypatch.delenv(var, raising=False)
    s = Settings(_env_file=None)
    assert s.mock_mode is True
    assert s.ai_model == "claude-sonnet-5-5"
    assert s.anthropic_api_key == ""
    assert s.frontend_origin_list == []


def test_settings_read_from_environment(monkeypatch):
    monkeypatch.setenv("MOCK_MODE", "false")
    monkeypatch.setenv("FRONTEND_ORIGINS", " https://a.example.com , https://b.example.com/ ,")
    s = Settings(_env_file=None)
    assert s.mock_mode is False
    assert s.frontend_origin_list == ["https://a.example.com", "https://b.example.com"]


def test_cors_allowed_origins():
    for origin in [
        "http://localhost:3000",
        "https://frontdoor-SCHOOL.vercel.app",
        "https://frontdoor-git-feature-abc.vercel.app",
    ]:
        res = client.get("/health", headers={"Origin": origin})
        assert res.headers.get("access-control-allow-origin") == origin


def test_cors_blocks_other_origins():
    for origin in ["https://evil.example.com", "https://vercel.app.evil.com", "http://frontdoor.vercel.app"]:
        res = client.get("/health", headers={"Origin": origin})
        assert "access-control-allow-origin" not in res.headers, origin
