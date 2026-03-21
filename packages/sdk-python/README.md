# Spendline Python SDK

Install with:

```bash
pip install spendline
```

## Track Pattern

```python
from spendline import track

response = track(
    openai.chat.completions.create(
        model="gpt-5-mini",
        messages=[{"role": "user", "content": "Hello"}],
    )
)
```

## Patch Pattern

```python
from spendline import patch

patch()
```

## LangChain Pattern

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

## What We Don't Collect

- Prompt text
- Completion text
- Raw request bodies
- Secrets from your application context
