# Spendline — Build Prompts

30 ordered prompts to build the complete MVP. Paste each into your coding agent in sequence. Read context.md, architecture.md, design.md, security.md, api-reference.md, and sdk-reference.md before starting. Complete and verify each prompt before moving to the next.

---

## SETUP & INFRASTRUCTURE

### Prompt 1 — Monorepo Scaffold
```
Create a monorepo using pnpm workspaces with this structure:
- apps/web (Next.js 14 App Router, TypeScript)
- apps/api (Fastify, Node.js 20, TypeScript)
- packages/sdk-python
- packages/sdk-js

Root package.json with pnpm workspace config. Shared tsconfig.base.json. ESLint and Prettier configs at root. Scripts: dev (runs both apps), build, lint, typecheck.

Create .env.example for apps/api:
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY,
UPSTASH_REDIS_URL, UPSTASH_REDIS_TOKEN,
RESEND_API_KEY, PORT, NODE_ENV, CORS_ORIGIN, API_URL

Create .env.example for apps/web:
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL

Add .gitignore at root covering .env, .env.local, node_modules, dist, .next, __pycache__.
```

---

### Prompt 2 — Pricing and Model Utilities
```
Create the following files in apps/api/src/lib/:

normalise.ts — exports MODEL_NORMALISATION_MAP and normaliseModel(raw: string): string.
Map covers common OpenAI pinned version aliases (gpt-4o-2024-11-20 → gpt-4o),
Anthropic date-suffixed aliases (claude-sonnet-4-20250514 → claude-sonnet-4-6),
and Google alias variants (gemini-2.5-pro → gemini-2-5-pro).
If no mapping found, return the raw string unchanged.

provider.ts — exports detectProvider(modelId: string): string.
Detect by prefix: claude- → anthropic, gpt- → openai, o1/o3/o4 → openai,
gemini- → google, deepseek- → deepseek, anthropic. → bedrock, amazon. → bedrock.
Default: unknown.

costs.ts — exports getCostMap(), calculateCost(model, tokensIn, tokensOut).
getCostMap() fetches GET /v1/models from Supabase via the service client,
caches in module-level Map, refreshes every 24h.
calculateCost returns { costUsd: number, unknownModel: boolean }.
If model not in map: return { costUsd: 0, unknownModel: true }.
Cost formula: (tokensIn / 1_000_000 * input_price) + (tokensOut / 1_000_000 * output_price).
Round to 8 decimal places.
```

---

### Prompt 3 — API Key System
```
Create apps/api/src/lib/apikeys.ts.

Key format: sl_live_ followed by 32 lowercase hex characters (crypto.randomBytes(16).toString('hex')).
Storage: SHA-256 hash only. Never store raw key.
Prefix: first 12 characters of the raw key (for display).

Export:
- generateApiKey(): { raw: string, hash: string, prefix: string }
  Uses crypto.randomBytes for generation.
  Uses crypto.createHash('sha256') for hashing.

- validateApiKey(raw: string): Promise<{ userId: string, apiKeyId: string } | null>
  Hashes the incoming key.
  Queries api_keys WHERE key_hash = hash using Supabase service client.
  Uses crypto.timingSafeEqual to prevent timing attacks.
  Returns null if not found.

- revokeApiKey(keyId: string, userId: string): Promise<void>
  Deletes the row WHERE id = keyId AND user_id = userId.
  Returns void — throws if not found.

Use SUPABASE_SERVICE_KEY client for all operations.
```

---

### Prompt 4 — Redis Queue Setup
```
Create apps/api/src/lib/queue.ts.

Set up BullMQ with Upstash Redis using UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN.

Define IngestJob interface:
{ userId, apiKeyId, modelRaw, modelNormalised, provider, tokensIn, tokensOut,
  costUsd, latencyMs, workflowId?, sessionId?, requestId?, unknownModel,
  metadata?, timestamp }

Export:
- ingestQueue: Queue<IngestJob>
- addIngestJob(job: IngestJob): Promise<void>

Create apps/api/src/workers/ingest.worker.ts.
Export startWorker(): Worker<IngestJob>

Worker logic:
1. Check for duplicate: SELECT 1 FROM requests WHERE request_id = job.requestId (skip if found)
2. Insert row into requests table using service client
3. Update last_used_at on api_keys WHERE id = job.apiKeyId (fire and forget, don't await)

Retry config: 3 attempts, exponential backoff (2^attempt * 1000ms delay).
On permanent failure: move to dead letter queue named ingest-dlq.
```

---

### Prompt 5 — Fastify Server Bootstrap
```
Create apps/api/src/index.ts.

Set up Fastify with:
- @fastify/cors: origin from CORS_ORIGIN env var
- @fastify/helmet: security headers
- @fastify/rate-limit:
    /v1/ingest: max 1000/minute per IP
    all other routes: max 60/minute per IP
- Pino logger (built into Fastify)

Register route files:
- apps/api/src/routes/ingest.ts
- apps/api/src/routes/stats.ts
- apps/api/src/routes/apikeys.ts
- apps/api/src/routes/alerts.ts
- apps/api/src/routes/models.ts

Register GET /health: returns { status: 'ok', timestamp: new Date().toISOString() }.
No version, env, or dependency info in this response.

On startup: call startWorker() to begin processing the queue.
Start listening on PORT env var (default 3001).
```

---

## BACKEND ROUTES

### Prompt 6 — Ingest Endpoint
```
Create apps/api/src/routes/ingest.ts.

POST /v1/ingest

Auth: extract Authorization: Bearer header, call validateApiKey(), return 401 if invalid.

Accept body: single IngestEvent object OR array of up to 100.
Normalize to array internally.

For each event validate:
- model: string, required, 1–100 chars
- provider: string, optional (auto-detect if absent using detectProvider())
- tokens_in: integer, 0–1,000,000, required
- tokens_out: integer, 0–1,000,000, required
- latency_ms: integer, 0–300,000, required
- cost_usd: number, optional (recalculate server-side)
- workflow_id: string, optional, max 200 chars
- session_id: string, optional, max 200 chars
- request_id: string, optional, max 100 chars
- metadata: object, optional, max 10 keys, values truncated to 500 chars
- timestamp: ISO 8601, within ±5 min of server time

For each valid event:
1. normaliseModel(model)
2. detectProvider(model) if not provided
3. calculateCost(modelNormalised, tokensIn, tokensOut)
4. addIngestJob({...})

Return { received: true } with 200. Response time must be <20ms.
Return 400 with details array for validation failures.
If all events are duplicates: return { received: true, duplicate: true }.
```

---

### Prompt 7 — Models Endpoint
```
Create apps/api/src/routes/models.ts.

GET /v1/models
No auth required.
Add response header: Cache-Control: public, max-age=3600

Query Supabase models table WHERE is_active = true.
Return:
{
  updated_at: string (most recent updated_at from table),
  models: Array<{
    model_id, provider, display_name,
    input_cost_per_1m, output_cost_per_1m,
    context_window, is_active
  }>
}
```

---

### Prompt 8 — Stats Endpoints
```
Create apps/api/src/routes/stats.ts.

All routes: validate Supabase JWT from Authorization header using supabase.auth.getUser(token).
Extract userId from user.id. Return 401 if invalid.

GET /v1/stats/overview
Return: total_month_usd, today_usd, total_requests, avg_cost_usd, top_model.
Include change: { total_month_pct, today_pct, total_requests_pct, avg_cost_pct }
comparing current period to equivalent previous period.

GET /v1/stats/timeseries?interval=hourly|daily|weekly
Use TimescaleDB time_bucket(). 
hourly: last 48h, bucket '1 hour'
daily: last 30 days, bucket '1 day'  
weekly: last 12 weeks, bucket '1 week'
Return: { interval, data: [{ timestamp, spend_usd, requests }] }

GET /v1/stats/models
Current month. Group by model_normalised, provider.
Return: { models: [{ model_id, model_display, provider, spend_usd, request_count, avg_cost_usd }] }
Sorted by spend_usd desc. Join with models table for display_name.

GET /v1/stats/requests?page&limit&model&provider&from&to&workflow_id&session_id&min_cost&max_cost
page default 1, limit default 50 max 100.
Apply all filters as WHERE clauses.
Return: { total, page, limit, requests: [...] }

GET /v1/stats/users
Extract metadata->>'user_id' from requests WHERE metadata->>'user_id' IS NOT NULL.
Current month. Group by user_id. Return top 10 by spend_usd.
Return: { users: [{ user_id, spend_usd, request_count }] }
```

---

### Prompt 9 — API Keys Endpoints
```
Create apps/api/src/routes/apikeys.ts.
All routes require Supabase JWT auth.

GET /v1/apikeys
Select id, name, key_prefix, created_at, last_used_at from api_keys WHERE user_id = userId.
Never return key_hash.
Return: { api_keys: [...] }

POST /v1/apikeys
Body: { name: string } — required, 1–50 chars.
Call generateApiKey().
Insert into api_keys: { user_id, key_hash, key_prefix, name }.
Return 201: { id, name, key (raw), key_prefix, reveal: true, created_at, warning: "Copy this key now. It will not be shown again." }

DELETE /v1/apikeys/:id
Call revokeApiKey(id, userId).
Return 204 on success.
Return 404 if key not found for this user.
```

---

### Prompt 10 — Alerts Endpoints and Cron Jobs
```
Create apps/api/src/routes/alerts.ts.
All routes require Supabase JWT auth.

GET /v1/alerts/settings
Select from alert_settings WHERE user_id = userId.
Return settings or null fields if never configured.

PUT /v1/alerts/settings
Body: { monthly_threshold_usd?, daily_digest_enabled?, email? }
Validate email format if provided.
UPSERT into alert_settings.
Return updated settings.

POST /v1/alerts/test
Send test daily digest email using Resend to the user's configured email immediately.
Return { sent: true, email }.

Create apps/api/src/jobs/alerts.ts.
Export startAlertJobs() using node-cron.

Job 1 — Spend threshold (every hour: '0 * * * *'):
For each user with monthly_threshold_usd set:
  Sum current month cost_usd from requests.
  If sum > threshold AND threshold_fired_month != current month (YYYY-MM format):
    Send SpendAlert email via Resend.
    Update threshold_fired_month = current month.
Wrap each user in individual try/catch.

Job 2 — Daily digest (8am UTC daily: '0 8 * * *'):
For each user with daily_digest_enabled = true:
  Sum yesterday's cost_usd and count requests.
  If count > 0: send DailyDigest email.
  If count = 0: skip (no empty digests).
Wrap each user in individual try/catch.

Call startAlertJobs() in apps/api/src/index.ts on startup.
```

---

## EMAIL

### Prompt 11 — Email Templates
```
Install @react-email/components and resend.
Create apps/api/src/emails/SpendAlert.tsx and DailyDigest.tsx.

SpendAlert.tsx props:
{ email: string, currentSpendUsd: number, thresholdUsd: number,
  topModel: string, dashboardUrl: string }

Layout: dark background #0d1117, green accent #2ECC8A. Large current spend amount
centered. Threshold shown below. Top model badge. Green "Go to Dashboard" CTA button.
Footer with unsubscribe note. Inline styles only (email client compatibility).

DailyDigest.tsx props:
{ email: string, totalSpendUsd: number, requestCount: number,
  modelBreakdown: Array<{ model: string, spend_usd: number, requests: number }>,
  dashboardUrl: string, date: string }

Layout: same dark brand. Yesterday's date as header. Total spend and request count
as two stat boxes side by side. Model breakdown as a simple table.
Green CTA button. Footer.

Create apps/api/src/lib/email.ts:
Export sendSpendAlert(props) and sendDailyDigest(props) using Resend.
From address: alerts@yourdomain.com (or onboarding@resend.dev for dev).
```

---

## PYTHON SDK

### Prompt 12 — Python SDK Core
```
Build packages/sdk-python/spendline/ following sdk-reference.md exactly.

Create:
- __init__.py: exports track, patch, Spendline
- client.py: Spendline class with api_key, api_url, BatchBuffer instance
- track.py: track(response_or_fn, api_key?, workflow_id?, session_id?, metadata?) function
  Handles both: track(client.chat.completions.create(...)) and track(lambda: ...)
  Records start/end time for latency.
  Calls extract_usage() to get tokens and model.
  Calls detect_provider() and calculate_cost().
  Adds event to BatchBuffer.
  Returns original response unchanged.
  Silent failure — never raise.
- batch.py: BatchBuffer class (see sdk-reference.md)
- costs.py: getCostMap(), calculate_cost(), FALLBACK_BASELINE, extract_usage()
  (all implementations from sdk-reference.md)

Environment variable handling:
SPENDLINE_DISABLE=true → skip everything, return response unchanged
SPENDLINE_LOG=true → print each event dict to stdout before sending
SPENDLINE_API_KEY → default api key
SPENDLINE_API_URL → override base url
```

---

### Prompt 13 — Python SDK Auto-Patch
```
Create packages/sdk-python/spendline/autopatch.py.

Export patch() function.
On call: wrap openai.chat.completions.create, openai.chat.completions.acreate,
anthropic.messages.create, anthropic.messages.stream using functools.wraps.

For sync functions: wrap in a function that calls track() around the original.
For async functions: wrap in an async function that does the same.

Use try/except ImportError to handle cases where openai or anthropic are not installed.
Log a warning if SPENDLINE_API_KEY is not set, but don't raise.

SPENDLINE_DISABLE=true → patch() is a no-op.
Calling patch() twice should be idempotent (check if already patched).
```

---

### Prompt 14 — Python SDK LangChain Handler
```
Create packages/sdk-python/spendline/langchain.py.

Export SpendlineCallbackHandler(BaseCallbackHandler).

__init__(self, workflow_id=None, session_id=None, api_key=None)

on_llm_start(self, serialized, prompts, **kwargs):
  Record run_id → start_time mapping.
  Optionally log model name from serialized.

on_llm_end(self, response, **kwargs):
  Extract token usage from response.llm_output['token_usage'] or
  response.llm_output['usage'] (handle both OpenAI and Anthropic shapes).
  Calculate latency from start_time.
  Add event to batch buffer.

on_llm_error(self, error, **kwargs):
  Still record the attempt: tokens=0, cost=0, metadata={error: true}.

Use try/except ImportError so this file can be imported even if langchain is not installed
(raise ImportError with helpful message only when SpendlineCallbackHandler is instantiated).
```

---

### Prompt 15 — Python SDK Packaging and Tests
```
Set up packages/sdk-python for PyPI.

pyproject.toml (Poetry):
- name: spendline, version: 0.1.0
- Python >=3.8
- dependencies: requests>=2.28, httpx>=0.24
- dev: pytest, pytest-mock, responses, pytest-asyncio

Write tests/test_track.py:
- track() returns original response unchanged
- track() sends correct payload to ingest endpoint
- track() does not raise when ingest endpoint is unreachable
- SPENDLINE_DISABLE=true skips ingest entirely

Write tests/test_batch.py:
- buffer flushes when max_size reached
- buffer flushes after flush_interval
- flush failure does not raise

Write tests/test_costs.py:
- calculate_cost returns correct values for known models
- unknown model returns cost=0, unknown_model=True
- pricing cache is reused within TTL

Write README.md with:
- 3-line install + quickstart (track and patch patterns)
- Supported providers table
- Environment variables table
- Link to full docs
```

---

## JAVASCRIPT SDK

### Prompt 16 — JavaScript SDK Core and Packaging
```
Build packages/sdk-js/src/ following sdk-reference.md exactly.

Create:
- index.ts: exports track, patchOpenAI, patchAnthropic, Spendline class
- batch.ts: BatchBuffer class (from sdk-reference.md)
  timer.unref() to not block process exit
- costs.ts: getCostMap(), calculateCost(), FALLBACK_BASELINE (from sdk-reference.md)
- autopatch.ts: patchOpenAI(client), patchAnthropic(client) using Proxy
  Preserve TypeScript types exactly — no type widening

track<T>(fn: () => Promise<T>, options?: TrackOptions): Promise<T>
  Awaits fn(), records latency, calls getCostMap(), calls calculateCost(),
  adds to BatchBuffer, returns original response.
  Catches all errors silently.

tsup.config.ts:
  entry: src/index.ts
  format: [cjs, esm]
  dts: true
  clean: true

package.json exports field for dual CJS/ESM.

Write vitest tests:
- track() preserves return type and value
- track() sends correct payload
- track() does not throw on network failure
- BatchBuffer flushes at max_size
- BatchBuffer timer does not block process exit
```

---

## FRONTEND — AUTH

### Prompt 17 — Supabase Auth Setup
```
Set up Supabase Auth in apps/web using @supabase/ssr.

Create:
- lib/supabase/client.ts: createBrowserClient() using NEXT_PUBLIC_ vars
- lib/supabase/server.ts: createServerClient() using cookies() from next/headers
- middleware.ts at apps/web root:
  Protect all /dashboard/* routes.
  If no session: redirect to /.
  Refresh session cookie on every request.

Create app/actions/auth.ts (server actions):
- signInWithGitHub(): calls supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: '/auth/callback' } })
- signInWithEmail(email, password): calls supabase.auth.signInWithPassword()
- signUpWithEmail(email, password): calls supabase.auth.signUp()
- signOut(): calls supabase.auth.signOut(), redirects to /

Create app/auth/callback/route.ts:
  GET handler that exchanges the code param for a session.
  Redirects to /dashboard on success, / on failure.
```

---

## FRONTEND — PAGES

### Prompt 18 — Login / Landing Page
```
Build app/page.tsx following design.md and the mockup in context.md exactly.

Full-page layout, background #0d1117, grid pattern overlay (see design.md).
Two-column grid: 1fr + 440px, gap 60px. Single column on mobile.

Left column:
- Top left: $pendline logo ($ in #2ECC8A) + BETA badge
- Headline: "Track and control your LLM spend in real time"
  "LLM spend" in #2ECC8A. Font: Syne 800 62px letter-spacing -2px.
- Subtext paragraph: Syne 400 16px #8b949e
- Dark code block (#0d1117 bg, #21262d border) showing:
    from spendline import track
    track(openai.chat.completions.create(
      model="gpt-5-mini",
      messages=[{"role": "user", "content": "..."}]
    ))
  JetBrains Mono 13px with syntax highlighting colors from design.md
- Three trust badges row: ✓ NO LATENCY  ✓ OPEN SOURCE SDK  ✓ ZERO-CONFIG
  Green checkmark icon, Syne 500 12px uppercase, #8b949e text

Right column (auth card: bg #161b22, border #30363d, border-radius 16px, padding 32px):
- "Access Terminal" heading Syne 700 22px
- "LLM cost monitoring for high-performance teams." subtext #8b949e
- GitHub OAuth button (full width, bg #21262d, border #30363d, Github icon)
  onclick: signInWithGitHub()
- "OR EMAIL" divider with lines
- Email input (placeholder: dev@company.com)
- Password input with "FORGOT?" link top-right
- "Get started free" primary CTA button (full width, bg #2ECC8A, text #0d1117)
  onclick: signInWithEmail()
- "Don't have an account? Sign up" link → signUpWithEmail()

Footer: "FREE DURING BETA" left, DOCUMENTATION SECURITY PRIVACY STATUS right.
All Syne 400 11px #484f58 uppercase letter-spacing 0.1em.
```

---

### Prompt 19 — Dashboard Shell
```
Build app/dashboard/layout.tsx following design.md sidebar spec exactly.

Left sidebar (fixed, 240px, bg #0d1117, border-right #21262d):
Top section (padding 20px 16px):
  $pendline logo ($ in #2ECC8A)

Nav section (margin-top 8px):
  Each item: height 40px, padding 0 16px, flex items-center, gap 10px
  Icons from Lucide React, 18px, stroke 1.5
  - Overview → /dashboard (LayoutDashboard)
  - Request Log → /dashboard/logs (List)
  - Alerts → /dashboard/alerts (Bell)
  - API Keys → /dashboard/api-keys (Key)
  - Settings → /dashboard/settings (Settings)
  Active state: border-left 2px #2ECC8A, color #2ECC8A, bg #2ECC8A0D
  Inactive: color #8b949e, hover bg #161b22

Bottom section (margin-top auto, padding 16px, border-top #21262d):
  User email truncated (Syne 400 13px #8b949e)
  Sign Out button (ghost style, full width, left-aligned)

Main content (margin-left 240px, bg #0d0f14):
  Top bar (height 60px, border-bottom #21262d, padding 0 32px, flex space-between):
    Page title (Syne 600 16px #e6edf3)
    Docs link with ExternalLink icon
  Content area (padding 32px):
    {children}

Mobile (<768px): sidebar becomes slide-out drawer, hamburger in top bar.
```

---

### Prompt 20 — Overview Page
```
Build app/dashboard/page.tsx.

Fetch from /v1/stats/overview, /v1/stats/timeseries, /v1/stats/models,
/v1/stats/users, /v1/stats/requests?limit=10. Use SWR with 30s revalidation.

Stat cards row (4 cards, grid-cols-4):
Each card: bg #161b22, border #21262d, border-radius 12px, padding 20px 24px
- Total This Month
- Today's Spend
- Total Requests
- Avg Cost / Request
Value: 32px Syne 700 #e6edf3. Label: 13px #8b949e.
Change badge: green if spend decreased (negative pct), red if increased.

Spend graph (full width card, margin-top 16px):
Recharts AreaChart, height 280px.
Toggle buttons (Hourly/Daily/Weekly) top-right of card.
Green area gradient (#2ECC8A → transparent), strokeWidth 2.
Horizontal grid lines only (#21262d). JetBrains Mono axes.
Custom tooltip: bg #161b22, border #30363d, border-radius 8px.

Below graph (two columns, gap 16px):
Left: Model Breakdown card — Recharts BarChart, model colors from design.md
Right: Recent Requests mini-table (last 10) — model, cost (color-coded), latency, time

If metadata.user_id exists in any request, show Top Users card (full width, below two columns):
Table of top 10 users: user_id, spend_usd, request_count.
```

---

### Prompt 21 — Request Log Page
```
Build app/dashboard/logs/page.tsx.

Filter bar (bg #161b22, border #21262d, border-radius 12px, padding 16px, margin-bottom 16px):
- Date range: two inputs type="date" (from / to)
- Model: dropdown populated from distinct model_normalised values
- Provider: dropdown (All / anthropic / openai / google / deepseek / bedrock)
- Workflow ID: text search input
- Session ID: text search input
- Min/Max cost: number inputs
- Clear filters button (ghost)

Results count: "Showing X of Y requests" in #8b949e 13px

Table:
Columns: Timestamp, Model, Provider, Tokens In, Tokens Out, Cost, Latency, Workflow ID
Header: #0d1117 bg, uppercase 12px #8b949e
Cells: JetBrains Mono for cost/latency/tokens/IDs
Cost: color-coded per design.md (green/yellow/red)
Latency: color-coded per design.md
Row click: toggles inline expanded row showing metadata JSON in code block
Row hover: bg #161b22

Pagination: prev/next + page numbers. 50 rows per page.

Export CSV button (top-right): downloads all filtered results.

Empty state: dark card with code snippet "Make your first tracked call:"
showing the Python SDK one-liner.
```

---

### Prompt 22 — Alerts Page
```
Build app/dashboard/alerts/page.tsx.

Section 1 — Spend Threshold (card):
Label: "Alert me when monthly spend exceeds"
Number input with $ prefix, placeholder "100.00"
Progress bar showing (current month spend / threshold * 100)%.
Bar turns yellow at 80%, red at 100%.
Text below: "Current spend: $X.XX / $Y.YY"
Save button (primary). Show success toast on save.

Section 2 — Daily Digest (card, margin-top 16px):
Toggle switch + label "Send me a daily spend summary"
Email input (pre-filled from user email, editable)
"Send test email" button — calls POST /v1/alerts/test, shows success toast
Save button (primary). Show success toast on save.

Section 3 — Alert History (card, margin-top 16px):
Title: "Recent Alerts"
Table: Date, Type (Threshold Alert / Daily Digest), Amount
Show last 10 alerts from alert history.
Empty state: "No alerts triggered yet"
```

---

### Prompt 23 — API Keys Page
```
Build app/dashboard/api-keys/page.tsx.

Create section (card):
Name input (placeholder: "e.g. Production, Staging")
"Generate Key" button (primary)

On success: show modal overlay:
- Title: "Your API Key"
- Key in code block (JetBrains Mono 14px, bg #0d1117, border #21262d)
- Copy button — shows Check icon for 2s on copy
- Red warning banner: "This key will not be shown again. Copy it before closing."
- "Done" close button — disabled for 5s, then enabled
  (forces user to see the key before dismissing)

Keys table (card, margin-top 16px):
Columns: Name, Key (prefix + ...), Created, Last Used, Actions
Revoke button per row — shows confirmation dialog:
  "Revoke this key? Any SDKs using it will stop sending data."
  Confirm (danger) / Cancel

SDK Quickstart section (card, margin-top 16px):
Tab switcher: Python / JavaScript
Python tab:
  pip install spendline
  import spendline; spendline.patch()
  # or
  from spendline import track
  track(openai.chat.completions.create(...))

JS tab:
  npm install spendline
  import { patchOpenAI } from 'spendline'
  patchOpenAI(openai)

Show key_prefix in the code comments. Copy button per snippet.
```

---

### Prompt 24 — Settings Page
```
Build app/dashboard/settings/page.tsx.

Section 1 — Account (card):
Email: read-only text display (Syne 400 14px)
"Change Password" button (secondary):
  Calls supabase.auth.resetPasswordForEmail(email)
  Shows inline "Check your inbox" success message

Section 2 — Preferences (card, margin-top 16px):
Timezone: select dropdown (full IANA timezone list, grouped by region)
Date format: radio/toggle — MM/DD/YYYY vs DD/MM/YYYY
Save button. Success toast on save.
Saves to profiles.timezone and profiles.date_format.

Section 3 — Export Data (card, margin-top 16px):
"Download all my data as CSV" button with Download icon.
Calls GET /v1/stats/requests with no limit and all time range.
Client-side CSV generation and download.
Shows loading state while fetching.

Section 4 — Danger Zone (card, margin-top 16px, border #f8514933):
Title in #f85149.
"Delete Account" button (danger style).
Confirmation modal:
  "This will permanently delete all your data."
  Type input: user must type "delete my account" exactly.
  Confirm button disabled until text matches.
  On confirm: server action deletes all user data, signs out, redirects to /.
```

---

## POLISH

### Prompt 25 — Loading and Error States
```
Create components/ui/skeleton.tsx:
Animated shimmer skeleton component (see design.md for CSS).
Variants: StatCardSkeleton, ChartSkeleton, TableRowSkeleton (x5), CardSkeleton.

Add app/dashboard/loading.tsx: shows 4 StatCardSkeletons + ChartSkeleton + TableRowSkeletons x5.
Add app/dashboard/logs/loading.tsx: filter bar skeleton + TableRowSkeletons x10.
Add app/dashboard/alerts/loading.tsx: 2 CardSkeletons.
Add app/dashboard/api-keys/loading.tsx: CardSkeleton + TableRowSkeletons x3.
Add app/dashboard/settings/loading.tsx: 3 CardSkeletons.

Add error.tsx to each dashboard route: dark card, AlertTriangle icon, error message, retry button.
Add not-found.tsx: "404 — Page not found", link back to dashboard.

Create components/ui/toast.tsx:
useToast() hook: { showToast(message, type: 'success'|'error'|'info') }
ToastContainer component: fixed bottom-right, stacks multiple toasts.
Auto-dismiss 4000ms. Slide-in animation from right.
Left border accent: green/red/blue per type.
No external library.
```

---

### Prompt 26 — Onboarding Flow
```
Create components/onboarding/onboarding-flow.tsx.

Trigger: show when profiles.onboarded = false on first dashboard load.
Full-screen overlay (bg #0d1117CC, z-index 50).
Centered panel (bg #161b22, border #30363d, border-radius 16px, width 560px, padding 40px).

Progress indicator: 3 dots (● ○ ○), active dot in #2ECC8A.
Step counter: "Step X of 3" in #8b949e 13px.
"Skip for now" link (ghost, bottom-left).

Step 1 — "Create your API key":
Name input + "Generate Key" button.
On key creation: show key with copy button, auto-advance to step 2 after 2s.

Step 2 — "Install the SDK":
Python/JS tab switcher.
pip install spendline / npm install spendline — copy button.
Init code with their actual key prefix — copy button.
"Next" button (primary).

Step 3 — "Make your first call":
Sample code snippet.
"Waiting for your first request..." with animated pulse dot.
Poll GET /v1/stats/overview every 3 seconds.
When total_requests > 0: auto-advance to success screen.
Success screen: large green checkmark, "You're live!",
"Your first request cost $X.XX", "Go to Dashboard" button.

On skip or completion: PATCH /profiles to set onboarded = true.
Dismiss overlay.
```

---

## DEPLOYMENT

### Prompt 27 — Railway Config
```
Create apps/api/Dockerfile:
FROM node:20-alpine AS builder
Install pnpm. Copy workspace files. Run pnpm install --frozen-lockfile.
Build apps/api: pnpm --filter @spendline/api build.

FROM node:20-alpine AS runner
Copy only apps/api/dist and node_modules from builder.
RUN addgroup -S spendline && adduser -S spendline -G spendline
USER spendline
EXPOSE 3001
CMD ["node", "dist/index.js"]

Create railway.toml:
[build]
builder = "dockerfile"
dockerfilePath = "apps/api/Dockerfile"

[deploy]
startCommand = "node dist/index.js"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

---

### Prompt 28 — Vercel Config
```
Create vercel.json at apps/web/:
{
  "framework": "nextjs",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}

Update apps/web/next.config.js:
- Set NEXT_PUBLIC_API_URL from env
- Add image domains for Supabase storage
- Add security headers

Create DEPLOY.md at repo root:
Full step-by-step deployment instructions:
1. Supabase setup (from setup.md)
2. Upstash setup
3. Resend setup
4. Railway deploy steps with exact env vars to set
5. Vercel deploy steps with exact env vars to set
6. Post-deploy checklist (verify /health, send test ingest, check dashboard)
```

---

### Prompt 29 — Smoke Test
```
Write scripts/smoke-test.ts.
Run with: npx tsx scripts/smoke-test.ts
Require BASE_URL and SUPABASE_SERVICE_KEY as env vars.

Steps (log PASS/FAIL + timing for each):
1. Create test user via Supabase admin API
2. Get JWT for test user
3. POST /v1/apikeys → save key and id
4. Send 15 ingest requests with varied models:
   - 5x claude-sonnet-4-6 (anthropic)
   - 4x gpt-5-mini (openai)
   - 3x gemini-2-5-flash (google)
   - 2x deepseek-chat (deepseek)
   - 1x unknown-model-xyz (should set unknown_model: true)
5. Send 1 duplicate (same request_id as event 1)
6. Wait 5 seconds for queue
7. GET /v1/stats/overview → assert total_requests = 15 (not 16 — dedup worked)
8. GET /v1/stats/requests → assert 15 rows
9. GET /v1/stats/models → assert 5 providers present, unknown model visible
10. GET /v1/stats/users → (no user_id in metadata — assert empty array)
11. PUT /v1/alerts/settings → assert persists on GET
12. DELETE /v1/apikeys/:id → assert 204
13. POST /v1/ingest with revoked key → assert 401
14. Delete test user → assert their data is gone
15. GET /v1/models → assert 20+ models returned, is_active = true

Exit code 0 if all pass, 1 if any fail.
Print summary: X/15 tests passed.
```

---

### Prompt 30 — README Files
```
Write README.md files:

Root README.md:
- ASCII $pendline header
- One-line description
- Badges: build, npm version, PyPI version, license
- 5-line Python quickstart (install, patch, track)
- Monorepo structure (tree)
- Prerequisites: Node 20+, pnpm 8+, Python 3.8+
- Local dev setup: clone → install → setup .env → pnpm dev
- Links to sub-package READMEs
- MIT license

packages/sdk-python/README.md:
- Install: pip install spendline
- 3 usage patterns (track, patch, langchain) with code examples
- Supported providers table
- Environment variables table
- "What we don't collect" section

packages/sdk-js/README.md:
- Install: npm install spendline
- 3 usage patterns (track, patchOpenAI, class)
- TypeScript example showing type preservation
- Environment variables table

apps/api/README.md:
- Local dev setup
- Environment variables
- API routes table

apps/web/README.md:
- Local dev setup
- Environment variables
- Page list
```
