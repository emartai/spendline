from spendline import langchain as spendline_langchain


class DummyBatch:
    def __init__(self):
        self.events = []

    def add(self, event):
        self.events.append(event)


class DummyClient:
    def __init__(self):
        self.batch = DummyBatch()


class DummyResponse:
    def __init__(self, llm_output):
        self.llm_output = llm_output


def test_langchain_handler_tracks_llm_end(monkeypatch):
    monkeypatch.setattr(spendline_langchain, "_LANGCHAIN_IMPORT_ERROR", None)
    monkeypatch.setattr(spendline_langchain, "_BaseCallbackHandler", object)
    monkeypatch.setattr(spendline_langchain, "get_client", lambda api_key=None: DummyClient())
    monkeypatch.setattr(spendline_langchain, "calculate_cost", lambda model, tokens_in, tokens_out: (0.123, False))
    monkeypatch.setattr(spendline_langchain, "getCostMap", lambda: {"gpt-5-mini": {"input": 0.25, "output": 2.0}})

    client = DummyClient()
    monkeypatch.setattr(spendline_langchain, "get_client", lambda api_key=None: client)

    handler = spendline_langchain.SpendlineCallbackHandler(workflow_id="chain", session_id="sess")
    handler.on_llm_start({"kwargs": {"model_name": "gpt-5-mini"}}, ["hello"], run_id="run-1")
    handler.on_llm_end(
        DummyResponse({"token_usage": {"prompt_tokens": 12, "completion_tokens": 4}}),
        run_id="run-1",
    )

    assert len(client.batch.events) == 1
    assert client.batch.events[0]["model"] == "gpt-5-mini"
    assert client.batch.events[0]["workflow_id"] == "chain"
    assert client.batch.events[0]["session_id"] == "sess"


def test_langchain_handler_tracks_errors(monkeypatch):
    monkeypatch.setattr(spendline_langchain, "_LANGCHAIN_IMPORT_ERROR", None)
    monkeypatch.setattr(spendline_langchain, "_BaseCallbackHandler", object)

    client = DummyClient()
    monkeypatch.setattr(spendline_langchain, "get_client", lambda api_key=None: client)

    handler = spendline_langchain.SpendlineCallbackHandler()
    handler.on_llm_start({"name": "gpt-5-mini"}, ["hello"], run_id="run-2")
    handler.on_llm_error(RuntimeError("boom"), run_id="run-2")

    assert len(client.batch.events) == 1
    assert client.batch.events[0]["tokens_in"] == 0
    assert client.batch.events[0]["metadata"] == {"error": True}


def test_langchain_handler_raises_helpful_error_when_langchain_missing(monkeypatch):
    monkeypatch.setattr(spendline_langchain, "_LANGCHAIN_IMPORT_ERROR", ImportError("langchain missing"))

    try:
        spendline_langchain.SpendlineCallbackHandler()
    except ImportError as error:
        assert "langchain is required" in str(error)
    else:
        raise AssertionError("SpendlineCallbackHandler should raise ImportError when langchain is missing")
