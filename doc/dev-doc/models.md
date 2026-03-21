# Spendline — Models and Pricing

Current model reference as of March 2026. This file is the source of truth for seeding the models table and for the SDK fallback baseline.

---

## Pricing Architecture

Pricing is stored in the Supabase `models` table and served via `GET /v1/models`.
- SDKs fetch this endpoint on startup and cache for 24 hours
- You update pricing with a single SQL UPDATE — no redeploy needed
- Unknown models are tracked with cost_usd = 0 and unknown_model = true
- Deprecated models: set is_active = false to hide from dashboard

**To update a price:**
```sql
UPDATE models
SET input_cost_per_1m = 1.50, output_cost_per_1m = 12.00, updated_at = NOW()
WHERE model_id = 'gpt-5.2';
```

**To add a new model:**
```sql
INSERT INTO models (model_id, provider, display_name, input_cost_per_1m, output_cost_per_1m, context_window)
VALUES ('gpt-6', 'openai', 'GPT-6', 2.00, 16.00, 256000);
```

**To deprecate a model:**
```sql
UPDATE models SET is_active = FALSE, deprecated_at = NOW()
WHERE model_id = 'gpt-4-turbo';
```

---

## Supported Providers

5 providers at MVP launch: Anthropic, OpenAI, Google, DeepSeek, AWS Bedrock.

---

## Anthropic

Current family: Claude 4.x

| Model ID | Display Name | Input /1M | Output /1M | Context |
|----------|-------------|-----------|------------|---------|
| `claude-opus-4-6` | Claude Opus 4.6 | $5.00 | $25.00 | 200K |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 | $3.00 | $15.00 | 200K |
| `claude-haiku-4-5` | Claude Haiku 4.5 | $1.00 | $5.00 | 200K |

Previous generation (still in production, keep in table):

| Model ID | Display Name | Input /1M | Output /1M | Context |
|----------|-------------|-----------|------------|---------|
| `claude-3-5-sonnet-20241022` | Claude 3.5 Sonnet | $3.00 | $15.00 | 200K |
| `claude-3-5-haiku-20241022` | Claude 3.5 Haiku | $0.25 | $1.25 | 200K |

**Model aliases to normalise:**
```
claude-sonnet-4-20250514    → claude-sonnet-4-6
claude-opus-4-20250514      → claude-opus-4-6
claude-haiku-4-5-20251001   → claude-haiku-4-5
```

---

## OpenAI

Current flagship: GPT-5.x

| Model ID | Display Name | Input /1M | Output /1M | Context |
|----------|-------------|-----------|------------|---------|
| `gpt-5.2` | GPT-5.2 | $1.75 | $14.00 | 200K |
| `gpt-5-mini` | GPT-5 Mini | $0.25 | $2.00 | 200K |
| `gpt-5-nano` | GPT-5 Nano | $0.05 | $0.40 | 128K |

Previous generation (still widely used in production):

| Model ID | Display Name | Input /1M | Output /1M | Context |
|----------|-------------|-----------|------------|---------|
| `gpt-4o` | GPT-4o | $2.50 | $10.00 | 128K |
| `gpt-4o-mini` | GPT-4o Mini | $0.15 | $0.60 | 128K |
| `gpt-4.1` | GPT-4.1 | $2.00 | $8.00 | 1M |
| `gpt-4.1-mini` | GPT-4.1 Mini | $0.40 | $1.60 | 1M |

Reasoning models:

| Model ID | Display Name | Input /1M | Output /1M | Context |
|----------|-------------|-----------|------------|---------|
| `o3` | o3 | $2.00 | $8.00 | 200K |
| `o4-mini` | o4-mini | $1.10 | $4.40 | 200K |

**Model aliases to normalise:**
```
gpt-4o-2024-11-20       → gpt-4o
gpt-4o-2024-08-06       → gpt-4o
gpt-4o-mini-2024-07-18  → gpt-4o-mini
```

---

## Google Gemini

Current: Gemini 3.x (with 2.5 still stable)

| Model ID | Display Name | Input /1M | Output /1M | Context |
|----------|-------------|-----------|------------|---------|
| `gemini-3-1-pro-preview` | Gemini 3.1 Pro (Preview) | $2.00 | $18.00 | 200K |
| `gemini-3-1-flash-lite` | Gemini 3.1 Flash-Lite | $0.25 | $1.50 | 1M |
| `gemini-3-flash-preview` | Gemini 3 Flash (Preview) | $0.50 | $3.00 | 1M |

Stable generation:

| Model ID | Display Name | Input /1M | Output /1M | Context |
|----------|-------------|-----------|------------|---------|
| `gemini-2-5-pro` | Gemini 2.5 Pro | $1.25 | $10.00 | 2M |
| `gemini-2-5-flash` | Gemini 2.5 Flash | $0.30 | $2.50 | 1M |
| `gemini-2-5-flash-lite` | Gemini 2.5 Flash-Lite | $0.10 | $0.40 | 1M |

**Note:** `gemini-3-pro-preview` was deprecated and shut down March 9, 2026. Do not add it.

**Model aliases to normalise:**
```
gemini-2.5-pro        → gemini-2-5-pro
gemini-2.5-flash      → gemini-2-5-flash
gemini-2.5-flash-lite → gemini-2-5-flash-lite
gemini-3.1-pro-preview → gemini-3-1-pro-preview
```

---

## DeepSeek

Current: V3.2 unified model (replaced V3 and R1 with one model at same price).

| Model ID | Display Name | Input /1M | Output /1M | Context |
|----------|-------------|-----------|------------|---------|
| `deepseek-chat` | DeepSeek V3.2 Chat | $0.28 | $0.42 | 128K |
| `deepseek-reasoner` | DeepSeek V3.2 Reasoner | $0.28 | $0.42 | 128K |

Note: cache hit pricing is $0.028/M (90% off) but this is handled transparently by the DeepSeek API — the SDK does not need to differentiate.

---

## AWS Bedrock

Bedrock hosts Anthropic models under different model IDs. Pricing is the same as direct Anthropic API. Map these to the same cost as their Anthropic counterparts.

| Model ID | Display Name | Input /1M | Output /1M |
|----------|-------------|-----------|------------|
| `anthropic.claude-sonnet-4-5-20251022-v1:0` | Claude Sonnet 4.6 (Bedrock) | $3.00 | $15.00 |
| `anthropic.claude-haiku-4-5-20251022-v1:0` | Claude Haiku 4.5 (Bedrock) | $1.00 | $5.00 |
| `anthropic.claude-3-5-sonnet-20241022-v2:0` | Claude 3.5 Sonnet (Bedrock) | $3.00 | $15.00 |

---

## SDK Fallback Baseline

If `/v1/models` is unreachable, the SDK uses this minimal hardcoded map. These are the 5 most commonly used models — enough to give accurate costs even if the pricing fetch fails.

```python
# Python
FALLBACK_BASELINE = {
    'claude-sonnet-4-6': {'input': 3.00,  'output': 15.00},
    'claude-haiku-4-5':  {'input': 1.00,  'output':  5.00},
    'gpt-5.2':           {'input': 1.75,  'output': 14.00},
    'gpt-5-mini':        {'input': 0.25,  'output':  2.00},
    'gemini-2-5-flash':  {'input': 0.30,  'output':  2.50},
}
```

```typescript
// JavaScript
const FALLBACK_BASELINE = {
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':  { input: 1.00,  output:  5.00 },
  'gpt-5.2':           { input: 1.75,  output: 14.00 },
  'gpt-5-mini':        { input: 0.25,  output:  2.00 },
  'gemini-2-5-flash':  { input: 0.30,  output:  2.50 },
}
```

---

## Model Color Map (Dashboard)

Use these consistently across all charts and tables in the dashboard:

```typescript
export const MODEL_COLORS: Record<string, string> = {
  // Anthropic — purple family
  'claude-opus-4-6':            '#d2a8ff',
  'claude-sonnet-4-6':          '#bc8cff',
  'claude-haiku-4-5':           '#8957e5',
  'claude-3-5-sonnet-20241022': '#a78bfa',
  'claude-3-5-haiku-20241022':  '#7c3aed',

  // OpenAI — blue family
  'gpt-5.2':     '#60a5fa',
  'gpt-5-mini':  '#3b82f6',
  'gpt-5-nano':  '#1d4ed8',
  'gpt-4o':      '#93c5fd',
  'gpt-4o-mini': '#bfdbfe',
  'gpt-4.1':     '#38bdf8',
  'gpt-4.1-mini':'#7dd3fc',
  'o3':          '#0ea5e9',
  'o4-mini':     '#0284c7',

  // Google — green family
  'gemini-3-1-pro-preview':  '#4ade80',
  'gemini-3-1-flash-lite':   '#86efac',
  'gemini-2-5-pro':          '#22c55e',
  'gemini-2-5-flash':        '#86efac',
  'gemini-2-5-flash-lite':   '#bbf7d0',

  // DeepSeek — orange family
  'deepseek-chat':      '#fb923c',
  'deepseek-reasoner':  '#f97316',

  // Bedrock — teal family
  'anthropic.claude-sonnet-4-5-20251022-v1:0': '#2dd4bf',
  'anthropic.claude-haiku-4-5-20251022-v1:0':  '#5eead4',
  'anthropic.claude-3-5-sonnet-20241022-v2:0': '#99f6e4',

  // Fallback
  'unknown': '#484f58',
}

export function getModelColor(modelId: string): string {
  return MODEL_COLORS[modelId] ?? MODEL_COLORS['unknown']
}
```

---

## Pricing Update Log

Track pricing changes here manually when you update the database:

| Date | Model | Change | Old Price | New Price |
|------|-------|--------|-----------|-----------|
| 2026-03-20 | All | Initial seed | — | See above |

When prices change, update this table and run the SQL UPDATE.
