"""Automatic provider patching for Spendline."""

import os
import time
import warnings
from functools import wraps

from .track import _record_response

_MARKER_ATTR = "__spendline_patched__"


def _tracking_disabled() -> bool:
    return os.getenv("SPENDLINE_DISABLE", "").lower() == "true"


def _warn_missing_api_key():
    if not os.getenv("SPENDLINE_API_KEY"):
        warnings.warn(
            "SPENDLINE_API_KEY is not set; spendline.patch() will not send tracking data.",
            RuntimeWarning,
            stacklevel=2,
        )


def _patch_sync_method(target, attr_name):
    original = getattr(target, attr_name, None)
    if original is None or getattr(original, _MARKER_ATTR, False):
        return False

    @wraps(original)
    def wrapped(*args, **kwargs):
        started_at = time.perf_counter()
        response = original(*args, **kwargs)
        try:
            _record_response(response, started_at=started_at)
        except Exception:
            pass
        return response

    setattr(wrapped, _MARKER_ATTR, True)
    setattr(target, attr_name, wrapped)
    return True


def _patch_async_method(target, attr_name):
    original = getattr(target, attr_name, None)
    if original is None or getattr(original, _MARKER_ATTR, False):
        return False

    @wraps(original)
    async def wrapped(*args, **kwargs):
        started_at = time.perf_counter()
        response = await original(*args, **kwargs)
        try:
            _record_response(response, started_at=started_at)
        except Exception:
            pass
        return response

    setattr(wrapped, _MARKER_ATTR, True)
    setattr(target, attr_name, wrapped)
    return True


def _patch_openai():
    try:
        import openai
    except ImportError:
        return False

    patched = False

    chat = getattr(openai, "chat", None)
    completions = getattr(chat, "completions", None) if chat is not None else None
    if completions is not None:
        patched = _patch_sync_method(completions, "create") or patched
        patched = _patch_async_method(completions, "acreate") or patched

    return patched


def _patch_anthropic():
    try:
        import anthropic
    except ImportError:
        return False

    patched = False
    messages = getattr(anthropic, "messages", None)
    if messages is not None:
        patched = _patch_sync_method(messages, "create") or patched
        patched = _patch_sync_method(messages, "stream") or patched

    return patched


def patch():
    """Patches supported provider SDK entrypoints in place."""

    if _tracking_disabled():
        return None

    _warn_missing_api_key()
    _patch_openai()
    _patch_anthropic()
    return None
