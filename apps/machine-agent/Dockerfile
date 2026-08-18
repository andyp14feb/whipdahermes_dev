FROM python:3.12-slim

WORKDIR /app

ARG ATCH_VERSION=0.5

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl tar tmux \
    && arch="$(dpkg --print-architecture)" \
    && case "$arch" in amd64|arm64) ;; *) echo "Unsupported atch architecture: $arch" >&2; exit 1 ;; esac \
    && curl -fsSL "https://github.com/mobydeck/atch/releases/download/${ATCH_VERSION}/atch-linux-${arch}.tgz" -o /tmp/atch.tgz \
    && tar -xzf /tmp/atch.tgz -C /usr/local/bin atch \
    && chmod 0755 /usr/local/bin/atch \
    && rm -f /tmp/atch.tgz \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir "requests>=2.31"

COPY src ./src

CMD ["python", "src/main.py"]
