# Spendline JavaScript SDK

Install with:

```bash
npm install spendline
```

## Track Wrapper

```ts
import { track } from "spendline"

const response = await track(() =>
  openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [{ role: "user", content: "Hello" }],
  }),
)
```

## patchOpenAI

```ts
import { patchOpenAI } from "spendline"

patchOpenAI(openai)
```

## Spendline Class

```ts
import { Spendline } from "spendline"

const spendline = new Spendline({ apiKey: process.env.SPENDLINE_API_KEY })
await spendline.track(() => openai.chat.completions.create({ model: "gpt-5-mini", messages: [] }))
```

## TypeScript Type Preservation

```ts
const completion = await track(() =>
  openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [{ role: "user", content: "Hello" }],
  }),
)

completion.choices[0]?.message.content
```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `SPENDLINE_API_KEY` | Default API key for ingest |
| `SPENDLINE_API_URL` | Override the API base URL |
| `SPENDLINE_DISABLE` | Disable tracking entirely when set to `true` |
| `SPENDLINE_LOG` | Print events locally before flush |
