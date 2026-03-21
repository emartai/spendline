# Spendline — SDK Reference

Implementation spec for Python and JavaScript SDKs. Build exactly what is documented here.

---

## Python SDK

### Package
```
PyPI name:    spendline
Version:      0.1.0
Python:       >= 3.8
Dependencies: requests, httpx
```

### Install
```bash
pip install spendline
```

### Usage

**Pattern 1 — wrap a single call:**
```python
from spendline import track

response = track(
    openai.chat.completions.create(
        model="gpt-5-mini",
        messages=[{"role": "user", "content": "Hello"}]
    ),
    api_key="sl_live_xxx",       # optional if SPENDLINE_API_KEY set
    workflow_id="chat-feature",  # optional
    session_id="sess_abc123",    # optional
    metadata={"user_id": "u_456", "env": "prod"}  # optional
)
# Returns original OpenAI response unchanged
```

**Pattern 2 — zero-config auto-patch:**
```python
import spendline
spendline.patch()  # reads SPENDLINE_API_KEY from env

# All LLM calls from this point are automatically tracked
response = openai.chat.completions.create(...)
response = anthropic.messages.create(...)
```

**Pattern 3 — LangChain callback:**
```python
from spendline.langchain import SpendlineCallbackHandler

result = chain.invoke(
    {"input": "Hello"},
    config={"callbacks": [SpendlineCallbackHandler(workflow_id="my-chain")]}
)
```

### File Structure
```
packages/sdk-python/
├── spendline/
│   ├── __init__.py       # exports: track, patch, Spendline
│   ├── client.py         # Spendline class, pricing cache
│   ├── track.py          # track() function
│   ├── batch.py          # BatchBuffer class
│   ├── autopatch.py      # patch() function
│   └── langchain.py      # SpendlineCallbackHandler
├── tests/
│   ├── test_track.py
│   ├── test_batch.py
│   ├── test_autopatch.py
│   └── test_langchain.py
├── pyproject.toml
└── README.md
```

### Pricing Cache (Python)
```python
import time
import threading
import requests as http

CACHE_TTL = 86400  # 24 hours
API_URL = os.getenv('SPENDLINE_API_URL', 'https://api.spendline.dev')

_lock = threading.Lock()
_model_cache: dict = {}
_cache_fetched_at: float = 0

# Minimal fallback if /v1/models is unreachable
FALLBACK_BASELINE = {
    'claude-sonnet-4-6':  {'input': 3.00,  'output': 15.00},
    'claude-haiku-4-5':   {'input': 1.00,  'output': 5.00},
    'gpt-5.2':            {'input': 1.75,  'output': 14.00},
    'gpt-5-mini':         {'input': 0.25,  'output': 2.00},
    'gemini-2-5-flash':   {'input': 0.30,  'output': 2.50},
}

def _get_cost_map() -> dict:
    global _model_cache, _cache_fetched_at
    now = time.time()
    with _lock:
        if _cache_fetched_at and (now - _cache_fetched_at) < CACHE_TTL:
            return _model_cache
        try:
            r = http.get(f'{API_URL}/v1/models', timeout=3)
            data = r.json()
            _model_cache = {
                m['model_id']: {
                    'input': m['input_cost_per_1m'],
                    'output': m['output_cost_per_1m']
                }
                for m in data['models']
            }
            _cache_fetched_at = now
        except Exception:
            if not _model_cache:
                _model_cache = FALLBACK_BASELINE
        return _model_cache

def calculate_cost(model: str, tokens_in: int, tokens_out: int) -> tuple[float, bool]:
    """Returns (cost_usd, unknown_model)"""
    cost_map = _get_cost_map()
    if model not in cost_map:
        return 0.0, True
    prices = cost_map[model]
    cost = (tokens_in / 1_000_000 * prices['input']) + \
           (tokens_out / 1_000_000 * prices['output'])
    return round(cost, 8), False
```

### Batch Buffer (Python)
```python
import threading
import time
import uuid

class BatchBuffer:
    def __init__(self, api_key: str, api_url: str, max_size=100, flush_interval=2.0):
        self.api_key = api_key
        self.api_url = api_url
        self.max_size = max_size
        self.flush_interval = flush_interval
        self._buffer = []
        self._lock = threading.Lock()
        self._timer = None
        self._start_timer()

    def add(self, event: dict):
        with self._lock:
            self._buffer.append(event)
            if len(self._buffer) >= self.max_size:
                self._flush_locked()

    def _start_timer(self):
        self._timer = threading.Timer(self.flush_interval, self._flush_and_restart)
        self._timer.daemon = True
        self._timer.start()

    def _flush_and_restart(self):
        with self._lock:
            self._flush_locked()
        self._start_timer()

    def _flush_locked(self):
        if not self._buffer:
            return
        events = self._buffer[:]
        self._buffer = []
        threading.Thread(target=self._send, args=(events,), daemon=True).start()

    def _send(self, events: list):
        try:
            import requests as http
            http.post(
                f'{self.api_url}/v1/ingest',
                json=events,
                headers={'Authorization': f'Bearer {self.api_key}'},
                timeout=5
            )
        except Exception:
            pass  # Silent failure — never propagate
```

### Provider Auto-Detection (Python)
```python
def detect_provider(model: str) -> str:
    if model.startswith('claude-'):     return 'anthropic'
    if model.startswith('gpt-'):        return 'openai'
    if model.startswith('o1') or \
       model.startswith('o3') or \
       model.startswith('o4'):          return 'openai'
    if model.startswith('gemini-'):     return 'google'
    if model.startswith('deepseek-'):   return 'deepseek'
    if model.startswith('anthropic.'): return 'bedrock'
    if model.startswith('amazon.'):    return 'bedrock'
    return 'unknown'
```

### Response Shape Extraction (Python)
```python
def extract_usage(response) -> dict:
    """Handles OpenAI, Anthropic, and Bedrock response shapes"""
    # OpenAI
    if hasattr(response, 'usage') and hasattr(response.usage, 'prompt_tokens'):
        return {
            'tokens_in': response.usage.prompt_tokens,
            'tokens_out': response.usage.completion_tokens,
            'model': getattr(response, 'model', 'unknown'),
        }
    # Anthropic
    if hasattr(response, 'usage') and hasattr(response.usage, 'input_tokens'):
        return {
            'tokens_in': response.usage.input_tokens,
            'tokens_out': response.usage.output_tokens,
            'model': getattr(response, 'model', 'unknown'),
        }
    # AWS Bedrock dict response
    if isinstance(response, dict) and 'usage' in response:
        usage = response['usage']
        return {
            'tokens_in': usage.get('inputTokens', 0),
            'tokens_out': usage.get('outputTokens', 0),
            'model': response.get('modelId', 'unknown'),
        }
    return {'tokens_in': 0, 'tokens_out': 0, 'model': 'unknown'}
```

### Environment Variables (Python)
```
SPENDLINE_API_KEY     Required. Pass api_key= to override.
SPENDLINE_DISABLE     Set to "true" to disable all tracking silently.
SPENDLINE_LOG         Set to "true" to print every ingest event to stdout.
SPENDLINE_API_URL     Override API base URL. Default: https://api.spendline.dev
```

### Error Handling Rules (Python)
- All network errors caught silently — never propagate to caller
- `track()` always returns original response even if ingest fails
- `patch()` warns but does not raise if `SPENDLINE_API_KEY` is not set
- Metadata string values truncated to 500 chars at SDK level
- Ingest timeout: 5 seconds

---

## JavaScript / TypeScript SDK

### Package
```
npm name:   spendline
Version:    0.1.0
Node:       >= 18
Build:      tsup — dual CJS + ESM output
Types:      included
```

### Install
```bash
npm install spendline
# or
pnpm add spendline
```

### Usage

**Pattern 1 — wrap a call:**
```typescript
import { track } from 'spendline'

const response = await track(
  () => openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [{ role: 'user', content: 'Hello' }]
  }),
  {
    apiKey: 'sl_live_xxx',       // optional if SPENDLINE_API_KEY set
    workflowId: 'chat-feature',  // optional
    sessionId: 'sess_abc123',    // optional
    metadata: { userId: 'u_456', env: 'prod' }  // optional
  }
)
// Returns original response — TypeScript type is preserved exactly
```

**Pattern 2 — patch a client:**
```typescript
import { patchOpenAI } from 'spendline'
import OpenAI from 'openai'

const openai = new OpenAI()
patchOpenAI(openai)  // reads SPENDLINE_API_KEY from process.env

const response = await openai.chat.completions.create(...)
// All calls through this client are tracked automatically
```

**Pattern 3 — class:**
```typescript
import { Spendline } from 'spendline'

const spendline = new Spendline({ apiKey: 'sl_live_xxx' })
const response = await spendline.track(() => openai.chat.completions.create(...))
```

### TypeScript Types
```typescript
interface TrackOptions {
  apiKey?: string
  workflowId?: string
  sessionId?: string
  metadata?: Record<string, string | number | boolean>
}

// Generic — preserves wrapped function return type exactly
function track<T>(fn: () => Promise<T>, options?: TrackOptions): Promise<T>

// Patch functions return same type they receive
function patchOpenAI<T extends OpenAI>(client: T): T
function patchAnthropic<T extends Anthropic>(client: T): T
```

### Pricing Cache (JavaScript)
```typescript
const CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24 hours
const API_URL = process.env.SPENDLINE_API_URL ?? 'https://api.spendline.dev'

const FALLBACK_BASELINE: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':  { input: 1.00,  output: 5.00  },
  'gpt-5.2':           { input: 1.75,  output: 14.00 },
  'gpt-5-mini':        { input: 0.25,  output: 2.00  },
  'gemini-2-5-flash':  { input: 0.30,  output: 2.50  },
}

let modelCache: Record<string, { input: number; output: number }> = {}
let cacheFetchedAt = 0

async function getCostMap() {
  const now = Date.now()
  if (cacheFetchedAt && now - cacheFetchedAt < CACHE_TTL_MS) return modelCache
  try {
    const res = await fetch(`${API_URL}/v1/models`, { signal: AbortSignal.timeout(3000) })
    const data = await res.json()
    modelCache = Object.fromEntries(
      data.models.map((m: any) => [m.model_id, {
        input: m.input_cost_per_1m,
        output: m.output_cost_per_1m
      }])
    )
    cacheFetchedAt = now
  } catch {
    if (!Object.keys(modelCache).length) modelCache = FALLBACK_BASELINE
  }
  return modelCache
}

function calculateCost(model: string, tokensIn: number, tokensOut: number, map: Record<string, any>) {
  const prices = map[model]
  if (!prices) return { costUsd: 0, unknownModel: true }
  const cost = (tokensIn / 1_000_000 * prices.input) + (tokensOut / 1_000_000 * prices.output)
  return { costUsd: Math.round(cost * 1e8) / 1e8, unknownModel: false }
}
```

### Batch Buffer (JavaScript)
```typescript
class BatchBuffer {
  private buffer: object[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private apiKey: string,
    private apiUrl: string,
    private maxSize = 100,
    private flushInterval = 2000
  ) {
    this.scheduleFlush()
  }

  add(event: object) {
    this.buffer.push(event)
    if (this.buffer.length >= this.maxSize) this.flush()
  }

  private scheduleFlush() {
    this.timer = setTimeout(() => {
      this.flush()
      this.scheduleFlush()
    }, this.flushInterval)
    if (this.timer.unref) this.timer.unref() // don't block process exit
  }

  private flush() {
    if (!this.buffer.length) return
    const events = this.buffer.splice(0)
    fetch(`${this.apiUrl}/v1/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(events)
    }).catch(() => {})  // Silent failure — never propagate
  }
}
```

### Environment Variables (JavaScript)
```
SPENDLINE_API_KEY     Required. Pass apiKey in options to override.
SPENDLINE_DISABLE     Set to "true" to skip all tracking silently.
SPENDLINE_LOG         Set to "true" to log every ingest event to console.
SPENDLINE_API_URL     Override API base URL.
```

### Error Handling Rules (JavaScript)
- All ingest fetch errors caught with `.catch(() => {})` — never throw
- `track()` always resolves with original response
- Pricing fetch errors fall back to baseline silently
- Metadata values truncated to 500 chars before sending
- AbortSignal timeout of 3s on pricing fetch, 5s on ingest

---

## Supported Models Seed Data

The coding agent should seed these models when setting up the `models` table. Pricing is per 1M tokens, verified March 2026.

| Model ID | Provider | Input /1M | Output /1M |
|----------|----------|-----------|------------|
| claude-opus-4-6 | anthropic | $5.00 | $25.00 |
| claude-sonnet-4-6 | anthropic | $3.00 | $15.00 |
| claude-haiku-4-5 | anthropic | $1.00 | $5.00 |
| claude-3-5-sonnet-20241022 | anthropic | $3.00 | $15.00 |
| claude-3-5-haiku-20241022 | anthropic | $0.25 | $1.25 |
| gpt-5.2 | openai | $1.75 | $14.00 |
| gpt-5-mini | openai | $0.25 | $2.00 |
| gpt-5-nano | openai | $0.05 | $0.40 |
| gpt-4o | openai | $2.50 | $10.00 |
| gpt-4o-mini | openai | $0.15 | $0.60 |
| gpt-4.1 | openai | $2.00 | $8.00 |
| gpt-4.1-mini | openai | $0.40 | $1.60 |
| o3 | openai | $2.00 | $8.00 |
| o4-mini | openai | $1.10 | $4.40 |
| gemini-3-1-pro-preview | google | $2.00 | $18.00 |
| gemini-3-1-flash-lite | google | $0.25 | $1.50 |
| gemini-3-flash-preview | google | $0.50 | $3.00 |
| gemini-2-5-pro | google | $1.25 | $10.00 |
| gemini-2-5-flash | google | $0.30 | $2.50 |
| gemini-2-5-flash-lite | google | $0.10 | $0.40 |
| deepseek-chat | deepseek | $0.28 | $0.42 |
| deepseek-reasoner | deepseek | $0.28 | $0.42 |
| anthropic.claude-sonnet-4-5-20251022-v1:0 | bedrock | $3.00 | $15.00 |
| anthropic.claude-haiku-4-5-20251022-v1:0 | bedrock | $1.00 | $5.00 |
| anthropic.claude-3-5-sonnet-20241022-v2:0 | bedrock | $3.00 | $15.00 |

**Note:** Pricing changes frequently. Update via SQL — no code redeploy needed:
```sql
UPDATE models SET input_cost_per_1m = 1.50, updated_at = NOW()
WHERE model_id = 'gpt-5.2';
```
