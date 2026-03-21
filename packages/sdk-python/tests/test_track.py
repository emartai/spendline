import threading
import time
from importlib import import_module

from spendline.batch import BatchBuffer
from spendline.track import track


class Usage:
    def __init__(self, prompt_tokens, completion_tokens):
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens


class Response:
    def __init__(self, model="gpt-5-mini", prompt_tokens=10, completion_tokens=5):
        self.model = model
        self.usage = Usage(prompt_tokens, completion_tokens)


class DummyClient:
    def __init__(self, batch):
        self.batch = batch


track_module = import_module("spendline.track")


def test_track_returns_original_response_unchanged(monkeypatch):
    captured = []

    class Batch:
        def add(self, event):
            captured.append(event)

    response = Response()

    monkeypatch.delenv("SPENDLINE_DISABLE", raising=False)
    monkeypatch.setenv("SPENDLINE_API_KEY", "sl_live_test")
    monkeypatch.setattr(track_module, "get_client", lambda api_key, api_url=None: DummyClient(Batch()))
    monkeypatch.setattr(track_module, "calculate_cost", lambda model, tokens_in, tokens_out: (0.0000125, False))

    result = track(
        response,
        workflow_id="chat-feature",
        session_id="sess_123",
        metadata={"user_id": "u_456"},
    )

    assert result is response
    assert len(captured) == 1
    assert captured[0]["model"] == "gpt-5-mini"
    assert captured[0]["workflow_id"] == "chat-feature"
    assert captured[0]["session_id"] == "sess_123"
    assert captured[0]["metadata"] == {"user_id": "u_456"}


def test_track_sends_correct_payload_to_ingest_endpoint(monkeypatch):
    calls = []
    sent = threading.Event()

    def fake_post(url, json, headers, timeout):
        calls.append(
            {
                "url": url,
                "json": json,
                "headers": headers,
                "timeout": timeout,
            }
        )
        sent.set()

    batch = BatchBuffer("sl_live_test", "https://api.spendline.dev", max_size=1, flush_interval=30.0)
    response = Response(prompt_tokens=42, completion_tokens=7)

    monkeypatch.delenv("SPENDLINE_DISABLE", raising=False)
    monkeypatch.setenv("SPENDLINE_API_KEY", "sl_live_test")
    monkeypatch.setattr("requests.post", fake_post)
    monkeypatch.setattr(track_module, "get_client", lambda api_key, api_url=None: DummyClient(batch))
    monkeypatch.setattr(track_module, "calculate_cost", lambda model, tokens_in, tokens_out: (0.000101, False))

    result = track(
        response,
        workflow_id="chat-feature",
        session_id="sess_123",
        metadata={"user_id": "u_456", "env": "prod"},
    )

    assert result is response
    assert sent.wait(1.0)
    payload = calls[0]["json"][0]

    assert calls[0]["url"] == "https://api.spendline.dev/v1/ingest"
    assert calls[0]["headers"]["Authorization"] == "Bearer sl_live_test"
    assert calls[0]["timeout"] == 5
    assert payload["model"] == "gpt-5-mini"
    assert payload["provider"] == "openai"
    assert payload["tokens_in"] == 42
    assert payload["tokens_out"] == 7
    assert payload["cost_usd"] == 0.000101
    assert payload["workflow_id"] == "chat-feature"
    assert payload["session_id"] == "sess_123"
    assert payload["metadata"] == {"user_id": "u_456", "env": "prod"}


def test_track_does_not_raise_when_ingest_endpoint_is_unreachable(monkeypatch):
    def failing_post(url, json, headers, timeout):
        raise RuntimeError("network down")

    batch = BatchBuffer("sl_live_test", "https://api.spendline.dev", max_size=1, flush_interval=30.0)
    response = Response()

    monkeypatch.delenv("SPENDLINE_DISABLE", raising=False)
    monkeypatch.setenv("SPENDLINE_API_KEY", "sl_live_test")
    monkeypatch.setattr("requests.post", failing_post)
    monkeypatch.setattr(track_module, "get_client", lambda api_key, api_url=None: DummyClient(batch))
    monkeypatch.setattr(track_module, "calculate_cost", lambda model, tokens_in, tokens_out: (0.0, False))

    result = track(response)

    time.sleep(0.05)
    assert result is response


def test_spendline_disable_true_skips_ingest_entirely(monkeypatch):
    response = Response()

    monkeypatch.setenv("SPENDLINE_DISABLE", "true")
    monkeypatch.setattr(
        track_module,
        "get_client",
        lambda api_key, api_url=None: (_ for _ in ()).throw(AssertionError("ingest should be skipped")),
    )

    result = track(response)

    assert result is response
