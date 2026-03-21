# $pendline

LLM cost monitoring for teams shipping across OpenAI, Anthropic, Gemini, DeepSeek, and Bedrock.

![build](https://img.shields.io/badge/build-local-green)
![npm version](https://img.shields.io/badge/npm-spendline-blue)
![PyPI version](https://img.shields.io/badge/PyPI-spendline-blue)
![license](https://img.shields.io/badge/license-MIT-brightgreen)

```python
pip install spendline
from spendline import patch, track
patch()
track(openai.chat.completions.create(model="gpt-5-mini", messages=[{"role": "user", "content": "Hello"}]))
```

## Monorepo Structure

```text
spendline/
├── apps/
│   ├── api
│   └── web
├── database/
├── packages/
│   ├── sdk-js
│   └── sdk-python
└── scripts/
```

## Prerequisites

- Node 20+
- pnpm 8+
- Python 3.8+

## Local Development

1. Clone the repository.
2. Run `pnpm install`.
3. Copy the `.env.example` files into real `.env` files for `apps/api` and `apps/web`.
4. Add your Supabase, Upstash, and Resend values.
5. Run `pnpm dev`.

## Package READMEs

- [API README](./apps/api/README.md)
- [Web README](./apps/web/README.md)
- [JavaScript SDK README](./packages/sdk-js/README.md)
- [Python SDK README](./packages/sdk-python/README.md)

## License

MIT
