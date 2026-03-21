import time

from spendline import costs


def test_calculate_cost_returns_correct_values_for_known_models(monkeypatch):
    monkeypatch.setattr(costs, "_model_cache", {"gpt-5-mini": {"input": 0.25, "output": 2.00}})
    monkeypatch.setattr(costs, "_cache_fetched_at", time.time())

    cost_usd, unknown_model = costs.calculate_cost("gpt-5-mini", 1000, 500)

    assert cost_usd == 0.00125
    assert unknown_model is False


def test_unknown_model_returns_zero_and_unknown_true(monkeypatch):
    monkeypatch.setattr(costs, "_model_cache", {"gpt-5-mini": {"input": 0.25, "output": 2.00}})
    monkeypatch.setattr(costs, "_cache_fetched_at", time.time())

    cost_usd, unknown_model = costs.calculate_cost("unknown-model", 1000, 500)

    assert cost_usd == 0.0
    assert unknown_model is True


def test_pricing_cache_is_reused_within_ttl(monkeypatch):
    calls = {"count": 0}

    class FakeResponse:
        def json(self):
            return {
                "models": [
                    {
                        "model_id": "gpt-5-mini",
                        "input_cost_per_1m": 0.25,
                        "output_cost_per_1m": 2.00,
                    }
                ]
            }

    def fake_get(url, timeout):
        calls["count"] += 1
        return FakeResponse()

    monkeypatch.setattr(costs, "_model_cache", {})
    monkeypatch.setattr(costs, "_cache_fetched_at", 0.0)
    monkeypatch.setattr("requests.get", fake_get)

    first = costs.getCostMap()
    second = costs.getCostMap()

    assert calls["count"] == 1
    assert first == second
