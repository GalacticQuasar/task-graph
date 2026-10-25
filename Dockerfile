# --- frontend build ---
FROM node:24-slim AS frontend
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- runtime ---
FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/app/.venv
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/app ./app
COPY --from=frontend /src/dist ./static

ENV PATH="/app/.venv/bin:$PATH" \
    TASKGRAPH_DB=sqlite:////data/taskgraph.db \
    TASKGRAPH_STATIC=/app/static \
    TASKGRAPH_REQUIRE_TOKEN=1
RUN mkdir /data && useradd --system --uid 10001 taskgraph && chown taskgraph /data
USER taskgraph
VOLUME /data
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"
# --proxy-headers so the login cookie is marked Secure when served behind an HTTPS proxy.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
