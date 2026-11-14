FROM ghcr.io/astral-sh/uv:0.9.8 AS uv
FROM python:3.12.12-slim-bookworm AS dependencies
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.12.12-slim-bookworm AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0 libfontconfig1 fonts-noto-core fonts-dejavu-core && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 10001 app && useradd --uid 10001 --gid 10001 --create-home app
ENV PATH="/app/backend/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 RE_ENVIRONMENT=production PORT=8000 LOG_LEVEL=info
WORKDIR /app/backend
COPY --from=dependencies /app/backend/.venv /app/backend/.venv
COPY backend/app ./app
COPY contracts/openapi.yaml /app/contracts/openapi.yaml
COPY database/migrations /app/database/migrations
COPY portal/public/brand/airiane-wordmark.png /app/portal/public/brand/airiane-wordmark.png
COPY assets/brand/logo /app/assets/brand/logo
COPY mobile/assets/fonts/Manrope-Regular.ttf mobile/assets/fonts/Manrope-LICENSE.txt /app/mobile/assets/fonts/
USER 10001:10001
EXPOSE 8000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/health/live',timeout=2)"
CMD ["python", "-m", "app.serve"]
