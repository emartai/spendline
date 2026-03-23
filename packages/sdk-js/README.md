# Spendline JavaScript SDK

Spendline tracks LLM usage in production with a single wrapper. The SDK captures tokens, model, latency, cost, timestamp, workflow ID, and request metadata without collecting prompt or completion text.

## Install

```bash
npm install spendline
```

The package is live on npm:

- `https://www.npmjs.com/package/spendline`

## Quick Start

```ts
import OpenAI from "openai"
import { track } from "spendline"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const completion = await track(
  () =>
    openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "Say hello" }],
    }),
  {
    workflowId: "support-bot",
    sessionId: "session-123",
    metadata: { feature: "chat", environment: "production" },
  },
)

console.log(completion.choices[0]?.message?.content)
```

## Auto-Patch OpenAI

```ts
import OpenAI from "openai"
import { patchOpenAI } from "spendline"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
patchOpenAI(openai)
```

## Use a Dedicated Client

```ts
import { Spendline } from "spendline"

const spendline = new Spendline({
  apiKey: process.env.SPENDLINE_API_KEY,
  apiUrl: "https://api.spendline.dev",
})

await spendline.track(() =>
  openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [{ role: "user", content: "Hello" }],
  }),
)
```

## Supported Providers

- OpenAI via `track()` and `patchOpenAI()`
- Anthropic via `track()` and `patchAnthropic()`
- Bedrock, Gemini, and DeepSeek via `track()`

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `SPENDLINE_API_KEY` | Default API key for ingest |
| `SPENDLINE_API_URL` | Override the API base URL |
| `SPENDLINE_DISABLE` | Disable tracking entirely when set to `true` |
| `SPENDLINE_LOG` | Print events locally before flush |

## Privacy

Spendline does not collect:

- Prompt text
- Completion text
- Raw request bodies
- Application secrets
