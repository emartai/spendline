import threading
import time

from spendline.batch import BatchBuffer


def test_buffer_flushes_when_max_size_reached(monkeypatch):
    calls = []
    sent = threading.Event()

    def fake_post(url, json, headers, timeout):
        calls.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        sent.set()

    monkeypatch.setattr("requests.post", fake_post)

    buffer = BatchBuffer("sl_live_test", "https://api.spendline.dev", max_size=2, flush_interval=30.0)
    buffer.add({"id": 1})
    buffer.add({"id": 2})

    assert sent.wait(1.0)
    assert calls[0]["json"] == [{"id": 1}, {"id": 2}]


def test_buffer_flushes_after_flush_interval(monkeypatch):
    calls = []
    sent = threading.Event()

    def fake_post(url, json, headers, timeout):
        calls.append(json)
        sent.set()

    monkeypatch.setattr("requests.post", fake_post)

    buffer = BatchBuffer("sl_live_test", "https://api.spendline.dev", max_size=100, flush_interval=0.05)
    buffer.add({"id": 1})

    assert sent.wait(1.0)
    assert calls[0] == [{"id": 1}]


def test_flush_failure_does_not_raise(monkeypatch):
    def failing_post(url, json, headers, timeout):
        raise RuntimeError("network down")

    monkeypatch.setattr("requests.post", failing_post)

    buffer = BatchBuffer("sl_live_test", "https://api.spendline.dev", max_size=1, flush_interval=30.0)
    buffer.add({"id": 1})

    time.sleep(0.05)
