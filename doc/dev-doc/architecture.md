# Spendline — Architecture

Complete technical architecture reference. The coding agent follows this exactly.

---

## Stack

| Layer | Technology | Host |
|-------|-----------|------|
| Frontend | Next.js 14 App Router + Tailwind | Vercel |
| Backend | Fastify + Node.js 20 + TypeScript | Railway |
| Database | PostgreSQL + TimescaleDB | Supabase |
| Auth | Supabase Auth | Supabase |
| Queue | BullMQ + Redis | Upstash |
| Email | Resend + React Email | Resend |
| Python SDK | Python 3.8+ | PyPI |
| JS SDK | TypeScript, dual CJS/ESM | npm |

---

## Monorepo Structure

```
spendline/
├── apps/
│   ├── web/                            # Next.js frontend
│   │   ├── app/
│   │   │   ├── page.tsx                # Login / Landing
│   │   │   ├── auth/callback/route.ts  # OAuth callback
│   │   │   ├── actions/auth.ts         # Auth server actions
│   │   │   └── dashboard/
│   │   │       ├── layout.tsx          # Sidebar shell
│   │   │       ├── page.tsx            # Overview
│   │   │       ├── logs/page.tsx       # Request Log
│   │   │       ├── alerts/page.tsx     # Alerts
│   │   │       ├── api-keys/page.tsx   # API Keys
│   │   │       └── settings/page.tsx   # Settings
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── skeleton.tsx
│   │   │   │   ├── toast.tsx
│   │   │   │   └── modal.tsx
│   │   │   ├── onboarding/
│   │   │   │   └── onboarding-flow.tsx
│   │   │   └── dashboard/
│   │   │       ├── stat-card.tsx
│   │   │       ├── spend-chart.tsx
│   │   │       ├── model-chart.tsx
│   │   │       ├── top-users-table.tsx
│   │   │       └── request-table.tsx
│   │   └── lib/
│   │       └── supabase/
│   │           ├── client.ts
│   │           ├── server.ts
│   │           └── middleware.ts
│   │
│   └── api/                            # Fastify backend
│       └── src/
│           ├── index.ts                # Server bootstrap
│           ├── lib/
│           │   ├── costs.ts            # Pricing cache + calculation
│           │   ├── apikeys.ts          # Key gen/validate/revoke
│           │   ├── queue.ts            # BullMQ setup
│           │   ├── supabase.ts         # DB clients (anon + service)
│           │   ├── normalise.ts        # Model name normalisation
│           │   └── provider.ts         # Provider auto-detection
│           ├── routes/
│           │   ├── ingest.ts           # POST /v1/ingest
│           │   ├── stats.ts            # GET /v1/stats/*
│           │   ├── apikeys.ts          # CRUD /v1/apikeys
│           │   ├── alerts.ts           # CRUD /v1/alerts
│           │   └── models.ts           # GET /v1/models
│           ├── workers/
│           │   └── ingest.worker.ts    # Queue processor
│           └── jobs/
│               └── alerts.ts           # Cron jobs
│
├── packages/
│   ├── sdk-python/
│   │   └── spendline/
│   │       ├── __init__.py
│   │       ├── client.py
│   │       ├── track.py
│   │       ├── batch.py
│   │       ├── autopatch.py
│   │       └── langchain.py
│   └── sdk-js/
│       └── src/
│           ├── index.ts
│           ├── batch.ts
│           └── autopatch.ts
│
├── database/
│   └── migrations/
│       └── 001_initial.sql
│
├── scripts/
│   └── smoke-test.ts
│
└── package.json
```

---

## Data Flow

### Full SDK → Dashboard Path

```
1.  Developer's app calls LLM via Spendline SDK
2.  SDK records: start_time, generates request_id
3.  SDK awaits LLM response
4.  SDK records: end_time, tokens_in, tokens_out, model_raw
5.  SDK looks up cost from local pricing cache (no network call)
6.  SDK pushes event to local batch buffer
7.  Batch buffer flushes when: 100 events buffered OR 2 seconds elapsed
8.  SDK fires async POST /v1/ingest with batch payload (non-blocking)
9.  SDK returns original LLM response to developer's app immediately

10. Fastify ingest handler:
    a. Validates Authorization: Bearer sl_live_xxx
    b. Validates and bounds-checks all fields
    c. Normalises model_raw → model_normalised
    d. Auto-detects provider if not provided
    e. Server-side cost recalculation as sanity check
    f. Pushes IngestJob to BullMQ queue
    g. Returns { received: true } in <20ms

11. BullMQ worker:
    a. Checks request_id against requests table (deduplication)
    b. Skips duplicates silently
    c. Inserts row into requests hypertable
    d. Updates last_used_at on api_key
    e. Retries 3x with exponential backoff on failure
    f. Dead letter queue on permanent failure

12. Next.js dashboard:
    a. SWR polls GET /v1/stats/overview every 30 seconds
    b. User sees updated data
```

### Auth Flow

```
GitHub OAuth:
  User clicks "Continue with GitHub"
  → supabase.auth.signInWithOAuth({ provider: 'github' })
  → Redirect to GitHub → User authorizes
  → Redirect to /auth/callback?code=xxx
  → Route exchanges code for session
  → Session stored in HTTP-only cookie
  → Redirect to /dashboard

Email/Password:
  User submits form
  → supabase.auth.signInWithPassword({ email, password })
  → Session stored in HTTP-only cookie
  → Redirect to /dashboard

All dashboard requests:
  → Next.js middleware reads cookie
  → Validates session via supabase.auth.getSession()
  → Redirects to / if no valid session

All API requests:
  → JWT extracted from Authorization header
  → Validated via supabase.auth.getUser(token)
  → Returns userId for query scoping
```

### Pricing Cache Flow

```
SDK starts up:
  → Check in-memory cache (set _model_cache, _cache_fetched_at)
  → If cache is empty or older than 24h:
      → GET https://api.spendline.dev/v1/models (timeout 3s)
      → On success: update cache, update _cache_fetched_at
      → On failure: use FALLBACK_BASELINE (hardcoded top 5 models)
  → Cache ready

LLM call completes:
  → Look up model_raw in cache
  → If found: cost_usd = (tokens_in/1M * input_price) + (tokens_out/1M * output_price)
  → If not found: cost_usd = 0, flag unknown_model = true
  → Include cost_usd in ingest payload
```

---

## Database Schema

### Relationships
```
auth.users (Supabase managed)
    │
    ▼
profiles (1:1)
    │
    ├──▶ api_keys (1:many)
    │
    ├──▶ requests (1:many)   ← TimescaleDB hypertable
    │         partitioned by timestamp
    │
    └──▶ alert_settings (1:1)

models (standalone lookup table, public read)
```

### Key Query Patterns

**Overview — total month stats:**
```sql
SELECT
  SUM(cost_usd)                                                    AS total_month_usd,
  SUM(CASE WHEN timestamp > NOW() - INTERVAL '1 day'
      THEN cost_usd ELSE 0 END)                                    AS today_usd,
  COUNT(*)                                                          AS total_requests,
  AVG(cost_usd)                                                     AS avg_cost_usd
FROM requests
WHERE user_id = $1
  AND timestamp >= date_trunc('month', NOW());
```

**Timeseries — daily buckets:**
```sql
SELECT
  time_bucket('1 day', timestamp) AS bucket,
  SUM(cost_usd)                   AS spend_usd,
  COUNT(*)                        AS requests
FROM requests
WHERE user_id = $1
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY bucket
ORDER BY bucket ASC;
```

**Model breakdown:**
```sql
SELECT
  model_normalised,
  provider,
  SUM(cost_usd)  AS spend_usd,
  COUNT(*)       AS request_count,
  AVG(cost_usd)  AS avg_cost_usd
FROM requests
WHERE user_id = $1
  AND timestamp >= date_trunc('month', NOW())
GROUP BY model_normalised, provider
ORDER BY spend_usd DESC;
```

**Top users by spend (from metadata):**
```sql
SELECT
  metadata->>'user_id'  AS user_id,
  SUM(cost_usd)         AS spend_usd,
  COUNT(*)              AS request_count
FROM requests
WHERE user_id = $1
  AND metadata->>'user_id' IS NOT NULL
  AND timestamp >= date_trunc('month', NOW())
GROUP BY metadata->>'user_id'
ORDER BY spend_usd DESC
LIMIT 10;
```

---

## API Routes

### Public (no auth)
| Method | Route | Description |
|--------|-------|-------------|
| GET | /health | Health check |
| GET | /v1/models | Model pricing map (CDN cached 1h) |

### SDK Auth (API key)
| Method | Route | Description |
|--------|-------|-------------|
| POST | /v1/ingest | Receive SDK telemetry (single or batch) |

### JWT Auth (dashboard)
| Method | Route | Description |
|--------|-------|-------------|
| GET | /v1/stats/overview | Stat card data + % change |
| GET | /v1/stats/timeseries | Time-bucketed spend graph data |
| GET | /v1/stats/models | Spend grouped by model |
| GET | /v1/stats/requests | Paginated, filtered request log |
| GET | /v1/stats/users | Top 10 users by spend from metadata |
| GET | /v1/apikeys | List API keys (no hashes) |
| POST | /v1/apikeys | Create API key (raw returned once) |
| DELETE | /v1/apikeys/:id | Revoke API key |
| GET | /v1/alerts/settings | Get alert config |
| PUT | /v1/alerts/settings | Update alert config |
| POST | /v1/alerts/test | Send test digest email now |

---

## Cron Jobs

Both run inside the Fastify process using `node-cron`. Each job is wrapped in try/catch per user — one user's failure never stops others.

| Job | Schedule | Logic |
|-----|----------|-------|
| Spend threshold check | Every hour (`0 * * * *`) | For each user with `monthly_threshold_usd` set: sum current month spend. If spend > threshold AND `threshold_fired_month` != current month: send alert email, update `threshold_fired_month`. |
| Daily digest | 8am UTC daily (`0 8 * * *`) | For each user with `daily_digest_enabled = true`: sum yesterday's spend and request count. If count > 0: send digest email. |

---

## Performance Targets

| Operation | Target |
|-----------|--------|
| POST /v1/ingest p99 | < 20ms |
| GET /v1/stats/overview | < 200ms |
| GET /v1/stats/timeseries | < 500ms |
| GET /v1/stats/requests (page 1) | < 300ms |
| Dashboard initial load | < 2s |
| SDK track() overhead | < 1ms (non-blocking) |
| Queue worker per job | < 500ms |

---

## Error Handling

### SDK (never throw to caller)
```python
# All ingest errors are caught silently
try:
    response = requests.post(url, json=payload, timeout=5)
except Exception:
    pass  # User's LLM response is always returned regardless
```

### API (structured JSON errors)
```json
{ "error": "Unauthorized",        "code": 401 }
{ "error": "Validation failed",   "code": 400, "details": ["..."] }
{ "error": "Not found",           "code": 404 }
{ "error": "Rate limit exceeded", "code": 429 }
{ "error": "Internal error",      "code": 500 }
```

Never expose stack traces or internal error messages in production responses.

### Frontend
- `loading.tsx` per route: skeleton components
- `error.tsx` per route: error card with retry button
- `not-found.tsx`: clean 404 in dashboard style
- SWR error states: inline error with retry
- Mutation failures: toast notification (red variant)
- Success mutations: toast notification (green variant)
