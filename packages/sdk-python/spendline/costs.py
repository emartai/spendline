"""Pricing lookup and response usage extraction."""

import os
import threading
import time

import requests as http

CACHE_TTL = 86400
API_URL = os.getenv("SPENDLINE_API_URL", "https://api.spendline.dev")

_lock = threading.Lock()
_model_cache = {}
_cache_fetched_at = 0.0

FALLBACK_BASELINE = {
    "claude-sonnet-4-6": {"input": 3.00, "output": 15.00},
    "claude-haiku-4-5": {"input": 1.00, "output": 5.00},
    "gpt-5.2": {"input": 1.75, "output": 14.00},
    "gpt-5-mini": {"input": 0.25, "output": 2.00},
    "gemini-2-5-flash": {"input": 0.30, "output": 2.50},
}


def getCostMap(api_url=None) -> dict:
    """Returns the pricing map, refreshing at most once per TTL."""

    global _cache_fetched_at, _model_cache

    now = time.time()
    with _lock:
        if _cache_fetched_at and (now - _cache_fetched_at) < CACHE_TTL:
            return _model_cache

        base_url = (api_url or os.getenv("SPENDLINE_API_URL") or API_URL).rstrip("/")
        try:
            response = http.get(f"{base_url}/v1/models", timeout=3)
            data = response.json()
            _model_cache = {
                model["model_id"]: {
                    "input": model["input_cost_per_1m"],
                    "output": model["output_cost_per_1m"],
                }
                for model in data["models"]
            }
            _cache_fetched_at = now
        except Exception:
            if not _model_cache:
                _model_cache = FALLBACK_BASELINE.copy()

        return _model_cache


def calculate_cost(model: str, tokens_in: int, tokens_out: int, api_url=None) -> tuple:
    """Returns (cost_usd, unknown_model)."""

    cost_map = getCostMap(api_url=api_url)
    if model not in cost_map:
        return 0.0, True

    prices = cost_map[model]
    cost = (tokens_in / 1_000_000 * prices["input"]) + (
        tokens_out / 1_000_000 * prices["output"]
    )
    return round(cost, 8), False


def extract_usage(response) -> dict:
    """Handles OpenAI, Anthropic, and Bedrock response shapes."""

    usage = getattr(response, "usage", None)

    if usage is not None and hasattr(usage, "prompt_tokens"):
        return {
            "tokens_in": getattr(usage, "prompt_tokens", 0) or 0,
            "tokens_out": getattr(usage, "completion_tokens", 0) or 0,
            "model": getattr(response, "model", "unknown"),
        }

    if usage is not None and hasattr(usage, "input_tokens"):
        return {
            "tokens_in": getattr(usage, "input_tokens", 0) or 0,
            "tokens_out": getattr(usage, "output_tokens", 0) or 0,
            "model": getattr(response, "model", "unknown"),
        }

    if isinstance(response, dict) and "usage" in response:
        usage_dict = response.get("usage") or {}
        return {
            "tokens_in": usage_dict.get("inputTokens", 0) or 0,
            "tokens_out": usage_dict.get("outputTokens", 0) or 0,
            "model": response.get("modelId", "unknown"),
        }

    return {"tokens_in": 0, "tokens_out": 0, "model": "unknown"}
