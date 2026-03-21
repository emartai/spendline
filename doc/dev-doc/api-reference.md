# Spendline — API Reference

Exact request and response contracts for every endpoint. The coding agent implements these exactly.

---

## Base URLs
```
Production:   https://api.spendline.dev
Development:  http://localhost:3001
```

---

## Authentication

**API Key** (SDK ingest only):
```
Authorization: Bearer sl_live_a3f9b2c1d4e5f6a7b8c9d0e1f2a3b4c5
```

**JWT** (all dashboard endpoints):
```
Authorization: Bearer <supabase-jwt-token>
```

---

## `GET /health`
No auth.

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-20T10:30:00.000Z"
}
```

---

## `GET /v1/models`
No auth. `Cache-Control: public, max-age=3600`

**Response 200:**
```json
{
  "updated_at": "2026-03-20T00:00:00.000Z",
  "models": [
    {
      "model_id": "claude-sonnet-4-6",
      "provider": "anthropic",
      "display_name": "Claude Sonnet 4.6",
      "input_cost_per_1m": 3.0,
      "output_cost_per_1m": 15.0,
      "context_window": 200000,
      "is_active": true
    }
  ]
}
```

Only returns models where `is_active = true`.

---

## `POST /v1/ingest`
Auth: API Key.

Accepts a single event object **or** an array of up to 100 events.

**Single event body:**
```json
{
  "model": "claude-sonnet-4-6",
  "provider": "anthropic",
  "tokens_in": 1250,
  "tokens_out": 340,
  "latency_ms": 1823,
  "cost_usd": 0.008850,
  "workflow_id": "chat-feature-v2",
  "session_id": "sess_abc123",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "user_id": "user_456",
    "environment": "production"
  },
  "timestamp": "2026-03-20T10:30:00.000Z"
}
```

**Batch body:**
```json
[
  { ...event1 },
  { ...event2 }
]
```

**Field rules:**
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| model | string | Yes | 1–100 chars |
| provider | string | No | auto-detected if absent |
| tokens_in | integer | Yes | 0–1,000,000 |
| tokens_out | integer | Yes | 0–1,000,000 |
| latency_ms | integer | Yes | 0–300,000 |
| cost_usd | number | No | 0–10,000, recalculated server-side |
| workflow_id | string | No | max 200 chars |
| session_id | string | No | max 200 chars |
| request_id | string | No | max 100 chars, used for dedup |
| metadata | object | No | max 10 keys, values truncated to 500 chars |
| timestamp | ISO 8601 | Yes | within ±5 min of server time |

**Response 200:**
```json
{ "received": true }
```

**Response 200 (duplicate):**
```json
{ "received": true, "duplicate": true }
```

**Response 401:**
```json
{ "error": "Unauthorized", "code": 401 }
```

**Response 400:**
```json
{
  "error": "Validation failed",
  "code": 400,
  "details": ["tokens_in must be a non-negative integer"]
}
```

---

## `GET /v1/stats/overview`
Auth: JWT.

**Response 200:**
```json
{
  "total_month_usd": 48.23,
  "today_usd": 3.41,
  "total_requests": 12847,
  "avg_cost_usd": 0.00375,
  "top_model": "claude-sonnet-4-6",
  "change": {
    "total_month_pct": -12.4,
    "today_pct": 8.2,
    "total_requests_pct": 15.1,
    "avg_cost_pct": -24.3
  }
}
```

Change percentages compare current period to the equivalent previous period. Negative = spend decreased (good — show green).

---

## `GET /v1/stats/timeseries`
Auth: JWT.

**Query params:**
| Param | Values | Default |
|-------|--------|---------|
| interval | `hourly`, `daily`, `weekly` | `daily` |

**Response 200:**
```json
{
  "interval": "daily",
  "data": [
    {
      "timestamp": "2026-03-01T00:00:00.000Z",
      "spend_usd": 2.14,
      "requests": 432
    },
    {
      "timestamp": "2026-03-02T00:00:00.000Z",
      "spend_usd": 3.87,
      "requests": 619
    }
  ]
}
```

Ranges: hourly = last 48 hours, daily = last 30 days, weekly = last 12 weeks.

---

## `GET /v1/stats/models`
Auth: JWT.

**Response 200:**
```json
{
  "models": [
    {
      "model_id": "claude-sonnet-4-6",
      "model_display": "Claude Sonnet 4.6",
      "provider": "anthropic",
      "spend_usd": 28.41,
      "request_count": 3241,
      "avg_cost_usd": 0.00877
    }
  ]
}
```

Sorted by `spend_usd` descending. Current month only.

---

## `GET /v1/stats/requests`
Auth: JWT.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| page | integer | Default 1 |
| limit | integer | Default 50, max 100 |
| model | string | Filter by model_normalised |
| provider | string | Filter by provider |
| from | ISO 8601 | Start timestamp |
| to | ISO 8601 | End timestamp |
| workflow_id | string | Exact match filter |
| session_id | string | Exact match filter |
| min_cost | number | Minimum cost_usd |
| max_cost | number | Maximum cost_usd |

**Response 200:**
```json
{
  "total": 12847,
  "page": 1,
  "limit": 50,
  "requests": [
    {
      "id": "uuid",
      "model_raw": "claude-sonnet-4-20250514",
      "model_normalised": "claude-sonnet-4-6",
      "provider": "anthropic",
      "tokens_in": 1250,
      "tokens_out": 340,
      "cost_usd": 0.008850,
      "latency_ms": 1823,
      "workflow_id": "chat-feature-v2",
      "session_id": "sess_abc123",
      "request_id": "550e8400-e29b-41d4-a716-446655440000",
      "unknown_model": false,
      "metadata": { "user_id": "user_456", "environment": "production" },
      "timestamp": "2026-03-20T10:30:00.000Z"
    }
  ]
}
```

---

## `GET /v1/stats/users`
Auth: JWT.

Returns top 10 user IDs by spend, extracted from `metadata.user_id`.

**Response 200:**
```json
{
  "users": [
    {
      "user_id": "user_456",
      "spend_usd": 12.40,
      "request_count": 842
    }
  ]
}
```

Returns empty array if no requests have `metadata.user_id` set. Current month only.

---

## `GET /v1/apikeys`
Auth: JWT.

**Response 200:**
```json
{
  "api_keys": [
    {
      "id": "uuid",
      "name": "Production",
      "key_prefix": "sl_live_a3",
      "created_at": "2026-01-10T09:00:00.000Z",
      "last_used_at": "2026-03-20T10:30:00.000Z"
    }
  ]
}
```

Never returns `key_hash`. Never returns the full key.

---

## `POST /v1/apikeys`
Auth: JWT.

**Request body:**
```json
{ "name": "Production" }
```

**Response 201:**
```json
{
  "id": "uuid",
  "name": "Production",
  "key": "sl_live_a3f9b2c1d4e5f6a7b8c9d0e1f2a3b4c5",
  "key_prefix": "sl_live_a3",
  "reveal": true,
  "created_at": "2026-03-20T10:30:00.000Z",
  "warning": "Copy this key now. It will not be shown again."
}
```

`reveal: true` is the signal to the frontend to show the one-time modal.

---

## `DELETE /v1/apikeys/:id`
Auth: JWT.

**Response 204:** No body.

**Response 404:**
```json
{ "error": "API key not found", "code": 404 }
```

---

## `GET /v1/alerts/settings`
Auth: JWT.

**Response 200:**
```json
{
  "monthly_threshold_usd": 100.00,
  "daily_digest_enabled": true,
  "email": "dev@company.com",
  "updated_at": "2026-01-10T09:00:00.000Z"
}
```

Returns `null` for unset fields if settings have never been saved.

---

## `PUT /v1/alerts/settings`
Auth: JWT.

**Request body:**
```json
{
  "monthly_threshold_usd": 100.00,
  "daily_digest_enabled": true,
  "email": "dev@company.com"
}
```

**Response 200:** Returns updated settings object (same shape as GET).

---

## `POST /v1/alerts/test`
Auth: JWT.

Sends a test daily digest email to the user's configured email immediately.

**Response 200:**
```json
{
  "sent": true,
  "email": "dev@company.com"
}
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Validation failed — see `details` array |
| 401 | Missing, invalid, or revoked API key / JWT |
| 403 | Authenticated but not authorized for this resource |
| 404 | Resource not found |
| 429 | Rate limit exceeded — see `Retry-After` header |
| 500 | Internal server error |

---

## IngestJob Shape (Internal — BullMQ)

```typescript
interface IngestJob {
  userId: string
  apiKeyId: string
  modelRaw: string
  modelNormalised: string
  provider: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  latencyMs: number
  workflowId?: string
  sessionId?: string
  requestId?: string
  unknownModel: boolean
  metadata?: Record<string, string | number | boolean>
  timestamp: string
}
```
