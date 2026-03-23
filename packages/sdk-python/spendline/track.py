"""Core Spendline tracking helpers."""

import os
import time
import uuid
from datetime import datetime, timezone

from .client import get_client
from .costs import calculate_cost, extract_usage


def detect_provider(model: str) -> str:
    """Best-effort provider detection from model naming."""

    if model.startswith("claude-"):
        return "anthropic"
    if model.startswith("gpt-"):
        return "openai"
    if model.startswith("o1") or model.startswith("o3") or model.startswith("o4"):
        return "openai"
    if model.startswith("gemini-"):
        return "google"
    if model.startswith("deepseek-"):
        return "deepseek"
    if model.startswith("anthropic."):
        return "bedrock"
    if model.startswith("amazon."):
        return "bedrock"
    return "unknown"


def _tracking_disabled() -> bool:
    return os.getenv("SPENDLINE_DISABLE", "").lower() == "true"


def _truncate_metadata(metadata):
    if not isinstance(metadata, dict):
        return None

    clean = {}
    for key, value in metadata.items():
        if isinstance(value, str):
            clean[key] = value[:500]
        elif isinstance(value, (int, float, bool)) or value is None:
            clean[key] = value
        else:
            clean[key] = str(value)[:500]
    return clean


def _record_response(
    response,
    *,
    started_at,
    api_key=None,
    workflow_id=None,
    session_id=None,
    metadata=None,
    api_url=None,
):
    """Builds and buffers a single event for a completed response."""

    resolved_api_key = api_key or os.getenv("SPENDLINE_API_KEY")
    if not resolved_api_key:
        return

    usage = extract_usage(response)
    model = usage["model"]
    tokens_in = int(usage["tokens_in"])
    tokens_out = int(usage["tokens_out"])
    provider = detect_provider(model)

    if api_url:
        cost_usd, unknown_model = calculate_cost(
            model, tokens_in, tokens_out, api_url=api_url
        )
    else:
        cost_usd, unknown_model = calculate_cost(model, tokens_in, tokens_out)
    latency_ms = int((time.perf_counter() - started_at) * 1000)

    event = {
        "model": model,
        "provider": provider,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "latency_ms": latency_ms,
        "cost_usd": cost_usd,
        "unknown_model": unknown_model,
        "workflow_id": workflow_id,
        "session_id": session_id,
        "request_id": str(uuid.uuid4()),
        "metadata": _truncate_metadata(metadata),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if os.getenv("SPENDLINE_LOG", "").lower() == "true":
        print(event)

    client = get_client(resolved_api_key, api_url=api_url)
    if client.batch is not None:
        client.batch.add(event)


def track(response_or_fn, api_key=None, workflow_id=None, session_id=None, metadata=None, api_url=None):
    """Tracks a response or wrapped function and always returns the original response."""

    if _tracking_disabled():
        return response_or_fn() if callable(response_or_fn) else response_or_fn

    response = None
    has_response = False

    try:
        started_at = time.perf_counter()
        response = response_or_fn() if callable(response_or_fn) else response_or_fn
        has_response = True

        _record_response(
            response,
            started_at=started_at,
            api_key=api_key,
            workflow_id=workflow_id,
            session_id=session_id,
            metadata=metadata,
            api_url=api_url,
        )

        return response
    except Exception:
        if has_response:
            return response
        raise
