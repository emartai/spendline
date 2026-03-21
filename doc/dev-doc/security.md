# Spendline — Security

All security requirements for the MVP. Every rule here is non-negotiable.

---

## API Keys

### Format
```
sl_live_<32 lowercase hex characters>
Example: sl_live_a3f9b2c1d4e5f6a7b8c9d0e1f2a3b4c5
```

### Storage Rules
- **Never store the raw key** — store only the SHA-256 hash
- Store the first 12 characters as `key_prefix` for display purposes
- The raw key is returned exactly once on creation, never again
- Hash: `SHA-256(rawKey)` using Node's built-in `crypto` module — no salt needed (128-bit entropy is sufficient)

### Generation
```typescript
import crypto from 'crypto'

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = 'sl_live_' + crypto.randomBytes(16).toString('hex')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  const prefix = raw.substring(0, 12)
  return { raw, hash, prefix }
}
```

### Validation Flow
```
1. Extract raw key from: Authorization: Bearer sl_live_xxx
2. If header missing or malformed: return 401 immediately
3. SHA-256 hash the raw key
4. SELECT id, user_id FROM api_keys WHERE key_hash = $hash
5. If no row found: return 401 immediately
6. Return { userId, apiKeyId }
7. Update last_used_at asynchronously (do not await)
```

Use constant-time string comparison to prevent timing attacks:
```typescript
import crypto from 'crypto'
const isValid = crypto.timingSafeEqual(
  Buffer.from(storedHash),
  Buffer.from(incomingHash)
)
```

### Revocation
- Deleting the row from `api_keys` immediately invalidates the key
- No grace period, no soft delete
- On revoke: delete row, return 204

---

## Authentication

### Session Storage
- Use `@supabase/ssr` — sessions stored in HTTP-only cookies only
- Never store JWT tokens in localStorage or sessionStorage
- Never pass raw JWT tokens to the frontend as props or response data
- Access tokens expire in 1 hour — Supabase handles refresh automatically
- Refresh tokens rotate on each use

### Middleware Protection
```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/', request.url))
  }
}

export const config = {
  matcher: ['/dashboard/:path*']
}
```

### GitHub OAuth Scopes
Request minimum scopes only: `read:user` and `user:email`. Never request write scopes.

### JWT Validation on API
```typescript
// All /v1/stats/* and /v1/apikeys/* and /v1/alerts/* routes
const authHeader = request.headers.authorization
const token = authHeader?.replace('Bearer ', '')
const { data: { user }, error } = await supabase.auth.getUser(token)
if (error || !user) return reply.status(401).send({ error: 'Unauthorized' })
const userId = user.id
```

---

## Row Level Security

All tables have RLS enabled. Queries without a valid JWT or service role will return empty results, not errors.

### Policies Summary

```sql
-- profiles: own row only
SELECT: auth.uid() = id
UPDATE: auth.uid() = id

-- api_keys: own rows only
SELECT: auth.uid() = user_id
INSERT: auth.uid() = user_id
DELETE: auth.uid() = user_id
UPDATE: auth.uid() = user_id

-- requests: own rows only (SELECT)
-- INSERT: service role only (worker bypasses RLS)
SELECT: auth.uid() = user_id

-- alert_settings: own row only
ALL:    auth.uid() = user_id

-- models: public read, no write via API
SELECT: true (anyone)
-- INSERT/UPDATE/DELETE: done manually in Supabase dashboard or via service role script only
```

### Service Role Usage Rules
- `SUPABASE_SERVICE_KEY` is used **only** in the Fastify API backend worker
- It is **never** in the Next.js app, SDK, or any client-side code
- It is **never** logged or included in error messages
- It bypasses RLS — treat it as a root database password

---

## Input Validation

### Ingest Endpoint — Validate Every Field

```typescript
model:        string, required, 1–100 chars, no HTML
provider:     string, optional, if present must be: openai|anthropic|google|deepseek|bedrock|unknown
tokens_in:    integer, required, 0–1,000,000
tokens_out:   integer, required, 0–1,000,000
latency_ms:   integer, required, 0–300,000
cost_usd:     number, optional, 0–10,000
workflow_id:  string, optional, max 200 chars
session_id:   string, optional, max 200 chars
request_id:   string, optional, max 100 chars
metadata:     object, optional, max 10 keys,
              keys: string max 50 chars,
              values: string|number|boolean,
              string values truncated to 500 chars
timestamp:    ISO 8601, required, must be within ±5 minutes of server time
```

Reject with 400 if any required field fails. Log the rejection with the API key ID but never the key hash.

### API Key Name
```
name: string, required, 1–50 chars, no HTML, trimmed
```

### Alert Settings
```
monthly_threshold_usd: number, optional, 0–999999.99
daily_digest_enabled:  boolean, optional
email:                 valid email format, max 254 chars
```

---

## Rate Limiting

Using `@fastify/rate-limit`:

```typescript
{
  '/v1/ingest':         { max: 1000, timeWindow: '1 minute' },
  '/v1/stats/*':        { max: 60,   timeWindow: '1 minute' },
  '/v1/apikeys':        { max: 20,   timeWindow: '1 minute' },
  '/v1/alerts/*':       { max: 20,   timeWindow: '1 minute' },
  'all other routes':   { max: 60,   timeWindow: '1 minute' },
}
```

Rate limit by IP. Return 429 with `Retry-After` header when exceeded.

---

## HTTP Security Headers

Via `@fastify/helmet`:

```
X-Frame-Options:           DENY
X-Content-Type-Options:    nosniff
X-XSS-Protection:          1; mode=block
Referrer-Policy:           strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
Permissions-Policy:        camera=(), microphone=(), geolocation=()
```

Via `next.config.js` (frontend):
```
X-Frame-Options:           DENY
X-Content-Type-Options:    nosniff
Referrer-Policy:           strict-origin-when-cross-origin
```

---

## CORS

```typescript
fastify.register(cors, {
  origin: process.env.CORS_ORIGIN,  // your Next.js URL only — never '*'
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
})
```

---

## What the SDK Never Sends

Document this explicitly in the SDK README. Spendline never collects:

```
✗ Prompt text
✗ Response text / completion content
✗ User PII from the application
✗ IP addresses of end users
✗ API keys of the LLM provider (OpenAI key, Anthropic key, etc.)
✗ Any data from the LLM response body except token counts and model name
```

What Spendline does collect:
```
✓ Token counts (in/out)
✓ Model name
✓ Provider name
✓ Calculated cost in USD
✓ Latency in milliseconds
✓ Workflow ID (user-defined string, optional)
✓ Session ID (user-defined string, optional)
✓ User ID (user-defined string from metadata, optional)
✓ Request ID (UUID generated by SDK)
✓ Timestamp
✓ Custom metadata key-value pairs (user-defined, optional)
```

---

## Deduplication Security

`request_id` is generated by the SDK as a UUID v4 per call. On ingest:

1. Check `SELECT 1 FROM requests WHERE request_id = $1` before inserting
2. If found: return `{ received: true, duplicate: true }` with 200 — do not error
3. If not found: proceed with insert

This prevents double-counting when the SDK retries on network failure.

---

## Production Error Responses

Never expose in production:
```
✗ Stack traces
✗ Internal error messages from Supabase or BullMQ
✗ Database query details
✗ File paths or line numbers
✗ Environment variable names or values
```

Always return:
```json
{ "error": "Internal server error", "code": 500 }
```

Log the full error server-side with Pino. Never in the response.

---

## Deployment Security Checklist

Before going live, verify every item:

- [ ] `.env` and `.env.local` are in `.gitignore`
- [ ] `SUPABASE_SERVICE_KEY` is not in any frontend code or bundle
- [ ] RLS is enabled on all Supabase tables (`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`)
- [ ] API keys stored as SHA-256 hashes only — no raw keys in DB
- [ ] CORS `origin` is set to your exact production URL, not `*`
- [ ] Rate limiting is active on `/v1/ingest`
- [ ] `GET /health` returns only `{ status, timestamp }` — nothing else
- [ ] All ingest fields validated and bounded
- [ ] Metadata string values truncated to 500 chars
- [ ] No `console.log` statements in production that could print sensitive data
- [ ] Error responses contain no stack traces
- [ ] `NEXT_PUBLIC_` variables contain no secrets (check every one)
- [ ] Railway environment variables are set in the Railway dashboard, not in committed files
- [ ] Vercel environment variables are set in the Vercel dashboard, not in committed files
- [ ] GitHub OAuth callback URL matches exactly what is configured in Supabase
- [ ] Supabase redirect URLs whitelist only your production and local URLs
