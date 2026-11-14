"""Production entrypoint: one worker preserves current in-memory connection replay ownership."""

import os

import uvicorn


def main():
    try:
        port = int(os.environ.get("PORT", "8000"))
        assert 1 <= port <= 65535
        level = os.environ.get("LOG_LEVEL", "info").lower()
        assert level in ("critical", "error", "warning", "info")
    except (ValueError, AssertionError):
        raise SystemExit("Invalid PORT or LOG_LEVEL") from None
    # Access logs omit query strings/bearers/bodies by disabling them entirely.
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        workers=1,
        log_level=level,
        access_log=False,
        proxy_headers=False,
        timeout_graceful_shutdown=30,
    )


if __name__ == "__main__":
    main()
