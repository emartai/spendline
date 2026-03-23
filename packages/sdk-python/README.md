# Spendline Python SDK

Spendline tracks LLM usage in production with one line of code. The SDK captures tokens, model, latency, cost, timestamp, workflow ID, and request metadata without collecting prompt or completion text.

## Install

```bash
pip install spendline
```

The package is live on PyPI:

- `https://pypi.org/project/spendline/0.1.0/`

## Quick Start

```python
from openai import OpenAI
from spendline import track

client = OpenAI()

response = track(
    client.chat.completions.create(
        model="gpt-5-mini",
        messages=[{"role": "user", "content": "Say hello"}],
    ),
    workflow_id="support-bot",
    session_id="session-123",
    metadata={"feature": "chat", "environment": "production"},
)

print(response.choices[0].message.content)
```

## Auto-Patch Supported Clients

```python
from spendline import patch

patch()
```

## LangChain

```python
from spendline.langchain import SpendlineCallbackHandler

handler = SpendlineCallbackHandler(workflow_id="chatbot")
```

## Supported Providers

| Provider | Support |
| --- | --- |
| OpenAI | `track()` and `patch()` |
| Anthropic | `track()` and `patch()` |
| Google Gemini | `track()` |
| DeepSeek | `track()` |
| Bedrock | `track()` |

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `SPENDLINE_API_KEY` | Default ingest key |
| `SPENDLINE_API_URL` | Override API base URL |
| `SPENDLINE_DISABLE` | Disable tracking when `true` |
| `SPENDLINE_LOG` | Print tracked events locally |

## Privacy

Spendline does not collect:

- Prompt text
- Completion text
- Raw request bodies
- Secrets from your application context
