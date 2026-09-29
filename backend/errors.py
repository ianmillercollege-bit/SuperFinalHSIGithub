"""Make every error use one shape: {"error": {"code": "...", "message": "..."}} (BACKEND_CONTRACT.md section 2)."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

# The only codes the contract allows. 405 is BAD_REQUEST per CLIENT_API_CONTRACT.md.
STATUS_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "BAD_REQUEST",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    500: "INTERNAL_ERROR",
}


def code_for(status: int) -> str:
    # Anything the contract doesn't list still gets a contract code.
    return STATUS_CODES.get(status, "INTERNAL_ERROR" if status >= 500 else "BAD_REQUEST")


def error_response(status: int, code: str, message: str, headers: dict | None = None) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}}, headers=headers)


async def http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    # Keep headers such as Allow on 405.
    return error_response(exc.status_code, code_for(exc.status_code), str(exc.detail), getattr(exc, "headers", None))


async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    parts = []
    for err in exc.errors():
        where = ".".join(str(p) for p in err.get("loc", ()))
        parts.append(f"{where}: {err.get('msg', 'invalid')}")
    return error_response(422, "VALIDATION_ERROR", "; ".join(parts) or "Invalid request.")


async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    # Don't leak internals to the client.
    return error_response(500, "INTERNAL_ERROR", "Something went wrong on the server.")


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, http_error)
    app.add_exception_handler(RequestValidationError, validation_error)
    app.add_exception_handler(Exception, unhandled_error)
