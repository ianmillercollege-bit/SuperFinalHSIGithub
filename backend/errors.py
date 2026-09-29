"""Make every error use one shape: {"error": {"code": "...", "message": "..."}}."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

STATUS_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "validation_error",
    429: "rate_limited",
}


def error_response(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


async def http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = STATUS_CODES.get(exc.status_code, "http_error")
    return error_response(exc.status_code, code, str(exc.detail))


async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    parts = []
    for err in exc.errors():
        where = ".".join(str(p) for p in err.get("loc", ()))
        parts.append(f"{where}: {err.get('msg', 'invalid')}")
    return error_response(422, "validation_error", "; ".join(parts) or "Invalid request.")


async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    # Don't leak internals to the client.
    return error_response(500, "internal_error", "Something went wrong on the server.")


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, http_error)
    app.add_exception_handler(RequestValidationError, validation_error)
    app.add_exception_handler(Exception, unhandled_error)
