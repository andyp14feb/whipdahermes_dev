FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir \
    "fastapi==0.138.0" \
    "pydantic==2.13.4" \
    "pydantic-settings>=2.7.0" \
    "uvicorn[standard]==0.49.0" \
    "sqlmodel==0.0.38"

COPY src ./src

EXPOSE 8000

HEALTHCHECK --interval=5s --timeout=3s --retries=12 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
