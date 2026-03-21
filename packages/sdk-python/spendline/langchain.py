"""LangChain callback handler for Spendline."""

import os
import time
from datetime import datetime, timezone

from .client import get_client
from .costs import calculate_cost, getCostMap
from .track import _tracking_disabled, _truncate_metadata, detect_provider

try:
    from langchain.callbacks.base import BaseCallbackHandler as _BaseCallbackHandler

    _LANGCHAIN_IMPORT_ERROR = None
except ImportError as exc:
    _BaseCallbackHandler = object
    _LANGCHAIN_IMPORT_ERROR = exc


class SpendlineCallbackHandler(_BaseCallbackHandler):
    """LangChain callback that tracks LLM usage to Spendline."""

    def __init__(self, workflow_id=None, session_id=None, api_key=None):
        if _LANGCHAIN_IMPORT_ERROR is not None:
            raise ImportError(
                "langchain is required to use SpendlineCallbackHandler. "
                "Install langchain to enable this integration."
            ) from _LANGCHAIN_IMPORT_ERROR

        self.workflow_id = workflow_id
        self.session_id = session_id
        self.api_key = api_key or os.getenv("SPENDLINE_API_KEY")
        self._start_times = {}
        self._models = {}

    def on_llm_start(self, serialized, prompts, **kwargs):
        try:
            if _tracking_disabled():
                return

            run_id = kwargs.get("run_id")
            if run_id is None:
                return

            self._start_times[str(run_id)] = time.perf_counter()

            model = (
                (serialized or {}).get("kwargs", {}).get("model_name")
                or (serialized or {}).get("kwargs", {}).get("model")
                or (serialized or {}).get("name")
                or "unknown"
            )
            self._models[str(run_id)] = model

            if os.getenv("SPENDLINE_LOG", "").lower() == "true" and model != "unknown":
                print({"spendline_langchain_model": model})
        except Exception:
            pass

    def on_llm_end(self, response, **kwargs):
        try:
            if _tracking_disabled():
                return

            run_id = str(kwargs.get("run_id"))
            started_at = self._start_times.pop(run_id, time.perf_counter())
            model = self._models.pop(run_id, "unknown")

            llm_output = getattr(response, "llm_output", None) or {}
            usage = llm_output.get("token_usage") or llm_output.get("usage") or {}

            tokens_in = int(
                usage.get("prompt_tokens")
                or usage.get("input_tokens")
                or usage.get("inputTokens")
                or 0
            )
            tokens_out = int(
                usage.get("completion_tokens")
                or usage.get("output_tokens")
                or usage.get("outputTokens")
                or 0
            )

            model = llm_output.get("model_name") or llm_output.get("model") or model
            provider = detect_provider(model)
            getCostMap()
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
                "workflow_id": self.workflow_id,
                "session_id": self.session_id,
                "metadata": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            if os.getenv("SPENDLINE_LOG", "").lower() == "true":
                print(event)

            client = get_client(self.api_key)
            if client.batch is not None:
                client.batch.add(event)
        except Exception:
            pass

    def on_llm_error(self, error, **kwargs):
        try:
            if _tracking_disabled():
                return

            run_id = str(kwargs.get("run_id"))
            started_at = self._start_times.pop(run_id, time.perf_counter())
            model = self._models.pop(run_id, "unknown")
            latency_ms = int((time.perf_counter() - started_at) * 1000)

            event = {
                "model": model,
                "provider": detect_provider(model),
                "tokens_in": 0,
                "tokens_out": 0,
                "latency_ms": latency_ms,
                "cost_usd": 0.0,
                "unknown_model": model == "unknown",
                "workflow_id": self.workflow_id,
                "session_id": self.session_id,
                "metadata": _truncate_metadata({"error": True}),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            if os.getenv("SPENDLINE_LOG", "").lower() == "true":
                print(event)

            client = get_client(self.api_key)
            if client.batch is not None:
                client.batch.add(event)
        except Exception:
            pass
