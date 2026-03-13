FROM python:3.11-slim

WORKDIR /app

# System dependencies for asyncpg, psycopg2, Node.js, and git (for skill sync)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    ca-certificates \
    gnupg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Node.js 20 LTS (required for Claude Code CLI)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g @anthropic-ai/claude-code

# Python dependencies (install first for layer caching)
COPY pyproject.toml .
RUN pip install --no-cache-dir \
    $(python -c "import tomllib; deps=tomllib.load(open('pyproject.toml','rb'))['project']['dependencies']; print(' '.join(deps))")

# Application code
COPY . .

# core/ is mounted via docker-compose volume at /app/core
ENV PYTHONPATH=/app

# Run as non-root user
RUN useradd --create-home --shell /bin/bash forge \
    && mkdir -p /data && chown forge:forge /data \
    && mkdir -p /home/forge/.claude && chown forge:forge /home/forge/.claude
USER forge

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
