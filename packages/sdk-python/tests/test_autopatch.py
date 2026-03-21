import warnings

from spendline import autopatch


class DummyCompletions:
    def __init__(self):
        self.calls = 0

    def create(self, *args, **kwargs):
        self.calls += 1
        return {"ok": True, "args": args, "kwargs": kwargs}

    async def acreate(self, *args, **kwargs):
        self.calls += 1
        return {"ok": True, "args": args, "kwargs": kwargs}


class DummyChat:
    def __init__(self):
        self.completions = DummyCompletions()


class DummyOpenAI:
    def __init__(self):
        self.chat = DummyChat()


class DummyMessages:
    def __init__(self):
        self.calls = 0

    def create(self, *args, **kwargs):
        self.calls += 1
        return {"ok": True, "args": args, "kwargs": kwargs}

    def stream(self, *args, **kwargs):
        self.calls += 1
        return {"stream": True, "args": args, "kwargs": kwargs}


class DummyAnthropic:
    def __init__(self):
        self.messages = DummyMessages()


def test_patch_is_idempotent(monkeypatch):
    openai_module = DummyOpenAI()
    anthropic_module = DummyAnthropic()
    recorded = []

    monkeypatch.delenv("SPENDLINE_DISABLE", raising=False)
    monkeypatch.setenv("SPENDLINE_API_KEY", "sl_live_test")
    monkeypatch.setattr(autopatch, "_record_response", lambda response, started_at=None: recorded.append(response))
    monkeypatch.setitem(__import__("sys").modules, "openai", openai_module)
    monkeypatch.setitem(__import__("sys").modules, "anthropic", anthropic_module)

    autopatch.patch()
    first_create = openai_module.chat.completions.create
    first_stream = anthropic_module.messages.stream

    autopatch.patch()

    assert openai_module.chat.completions.create is first_create
    assert anthropic_module.messages.stream is first_stream

    result = openai_module.chat.completions.create(model="gpt-5-mini")
    assert result["ok"] is True
    assert len(recorded) == 1


def test_patch_warns_when_api_key_missing(monkeypatch):
    monkeypatch.delenv("SPENDLINE_API_KEY", raising=False)
    monkeypatch.delenv("SPENDLINE_DISABLE", raising=False)
    monkeypatch.setattr(autopatch, "_patch_openai", lambda: False)
    monkeypatch.setattr(autopatch, "_patch_anthropic", lambda: False)

    with warnings.catch_warnings(record=True) as captured:
        warnings.simplefilter("always")
        autopatch.patch()

    assert any("SPENDLINE_API_KEY is not set" in str(item.message) for item in captured)
