"""Batch sending for Spendline ingest events."""

import threading


class BatchBuffer:
    """Buffers ingest events and flushes them asynchronously."""

    def __init__(self, api_key: str, api_url: str, max_size=100, flush_interval=2.0):
        self.api_key = api_key
        self.api_url = api_url.rstrip("/")
        self.max_size = max_size
        self.flush_interval = flush_interval
        self._buffer = []
        self._lock = threading.Lock()
        self._timer = None
        self._start_timer()

    def add(self, event: dict):
        with self._lock:
            self._buffer.append(event)
            if len(self._buffer) >= self.max_size:
                self._flush_locked()

    def _start_timer(self):
        self._timer = threading.Timer(self.flush_interval, self._flush_and_restart)
        self._timer.daemon = True
        self._timer.start()

    def _flush_and_restart(self):
        with self._lock:
            self._flush_locked()
        self._start_timer()

    def _flush_locked(self):
        if not self._buffer:
            return
        events = self._buffer[:]
        self._buffer = []
        threading.Thread(target=self._send, args=(events,), daemon=True).start()

    def _send(self, events: list):
        try:
            import requests as http

            http.post(
                f"{self.api_url}/v1/ingest",
                json=events,
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=5,
            )
        except Exception:
            pass
