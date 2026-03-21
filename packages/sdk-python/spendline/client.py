"""Client helpers for the Spendline SDK."""

import os
import threading

from .batch import BatchBuffer

DEFAULT_API_URL = os.getenv("SPENDLINE_API_URL", "https://api.spendline.dev")

_clients = {}
_clients_lock = threading.Lock()


class Spendline:
    """Small SDK client that owns a shared batch buffer."""

    def __init__(self, api_key=None, api_url=None):
        self.api_key = api_key or os.getenv("SPENDLINE_API_KEY")
        self.api_url = (api_url or os.getenv("SPENDLINE_API_URL") or DEFAULT_API_URL).rstrip("/")
        self.batch = BatchBuffer(self.api_key, self.api_url) if self.api_key else None

    def track(self, response_or_fn, workflow_id=None, session_id=None, metadata=None):
        from .track import track

        return track(
            response_or_fn,
            api_key=self.api_key,
            workflow_id=workflow_id,
            session_id=session_id,
            metadata=metadata,
            api_url=self.api_url,
        )


def get_client(api_key=None, api_url=None):
    """Returns a shared Spendline client per api key and URL."""

    resolved_api_key = api_key or os.getenv("SPENDLINE_API_KEY")
    resolved_api_url = (api_url or os.getenv("SPENDLINE_API_URL") or DEFAULT_API_URL).rstrip("/")

    if not resolved_api_key:
        return Spendline(api_key=None, api_url=resolved_api_url)

    cache_key = (resolved_api_key, resolved_api_url)
    with _clients_lock:
        client = _clients.get(cache_key)
        if client is None:
            client = Spendline(api_key=resolved_api_key, api_url=resolved_api_url)
            _clients[cache_key] = client
        return client
