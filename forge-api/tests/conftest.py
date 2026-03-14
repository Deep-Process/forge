"""Shared fixtures for workflow e2e tests."""

from __future__ import annotations

import asyncio
import os

import asyncpg
import pytest
import redis.asyncio as aioredis

# Ensure DB URL is set for tests (container environment)
DB_URL = os.environ.get(
    "DATABASE_URL",
    os.environ.get("FORGE_DATABASE_URL", "postgresql://forge:forge@postgres:5432/forge"),
)
REDIS_URL = os.environ.get("FORGE_REDIS_URL", "redis://redis:6379/0")


@pytest.fixture
async def db_pool():
    """Create a fresh asyncpg pool for the test."""
    pool = await asyncpg.create_pool(DB_URL, min_size=1, max_size=5)
    yield pool
    await pool.close()


@pytest.fixture
async def redis_client():
    """Create a fresh Redis client for the test."""
    client = aioredis.from_url(REDIS_URL, decode_responses=True)
    yield client
    await client.aclose()


@pytest.fixture
async def clean_workflows(db_pool):
    """Clean up all test workflow data before and after each test."""
    async with db_pool.acquire() as conn:
        await conn.execute("DELETE FROM workflow_step_results")
        await conn.execute("DELETE FROM workflow_executions")
    yield
    async with db_pool.acquire() as conn:
        await conn.execute("DELETE FROM workflow_step_results")
        await conn.execute("DELETE FROM workflow_executions")
