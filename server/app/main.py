import logging
import time
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import seating, validation
from app.core.config import settings
from app.schemas.common import ErrorBody, ErrorDetail
from app.services.errors import DomainError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("app")

app = FastAPI(title="Shadi Maxing API")

_HTTP_ERROR_CODES = {400: "bad_request", 404: "not_found", 405: "method_not_allowed"}


def _error(status_code: int, code: str, message: str, details: list[ErrorDetail] | None = None) -> JSONResponse:
    body = ErrorBody(error=code, message=message, details=details or [])
    return JSONResponse(status_code=status_code, content=body.model_dump(mode="json"))


@app.middleware("http")
async def guard_and_log(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    started = time.perf_counter()
    # Content-Length check only; chunked bodies without the header are not covered.
    raw_length = request.headers.get("content-length")
    if raw_length is not None:
        if not raw_length.isdigit():
            response: Response = _error(400, "bad_request", "Invalid Content-Length header")
        elif int(raw_length) > settings.MAX_BODY_BYTES:
            response = _error(413, "payload_too_large", "Request body is too large")
        else:
            response = await call_next(request)
    else:
        response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started) * 1000
    logger.info("%s %s -> %d in %.1f ms", request.method, request.url.path, response.status_code, elapsed_ms)
    return response


# Added after the middleware above so CORS is outermost and also covers 413 responses.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    # Only loc/msg/type are returned; submitted values (input/ctx) are never echoed.
    details = [
        ErrorDetail(loc=[part for part in err["loc"]], msg=str(err["msg"]), type=str(err["type"]))
        for err in exc.errors()
    ]
    return _error(422, "validation_error", "Request validation failed", details)


@app.exception_handler(DomainError)
async def domain_error_handler(_: Request, exc: DomainError) -> JSONResponse:
    return _error(422, exc.code, exc.message)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = _HTTP_ERROR_CODES.get(exc.status_code, "http_error")
    body = ErrorBody(error=code, message=str(exc.detail))
    return JSONResponse(status_code=exc.status_code, content=body.model_dump(mode="json"), headers=exc.headers)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    # Log the exception type only: messages and tracebacks could contain request data.
    logger.error("unhandled exception: %s", type(exc).__name__)
    return _error(500, "internal_error", "Internal server error")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(validation.router, prefix="/api")
app.include_router(seating.router, prefix="/api")