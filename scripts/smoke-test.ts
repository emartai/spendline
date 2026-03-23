import { readFileSync } from "node:fs"
import { resolve } from "node:path"

type SummaryItem = {
  step: string
  passed: boolean
  durationMs: number
  detail?: string
}

type StatsOverview = {
  total_requests: number
}

const BASE_URL = process.env.BASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

function loadEnvFile(relativePath: string) {
  try {
    const file = readFileSync(resolve(process.cwd(), relativePath), "utf8")
    const entries = file
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=")

        if (separator === -1) {
          return null
        }

        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()] as const
      })
      .filter((entry): entry is readonly [string, string] => entry !== null)

    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

const apiEnv = loadEnvFile("apps/api/.env")
const webEnv = loadEnvFile("apps/web/.env.local")
const SUPABASE_URL = process.env.SUPABASE_URL ?? apiEnv.SUPABASE_URL ?? webEnv.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? apiEnv.SUPABASE_ANON_KEY ?? webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!BASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("BASE_URL and SUPABASE_SERVICE_KEY are required.")
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are also required to create and authenticate the test user.")
}

const TEST_EMAIL = `smoke-${Date.now()}@spendline.dev`
const TEST_PASSWORD = "Spendline-Smoke-123!"
const RUN_ID = `smoke-${Date.now()}`

let jwt = ""
let keyId = ""
let rawKey = ""
let userId = ""

const summary: SummaryItem[] = []

async function timed(step: string, fn: () => Promise<void>) {
  const startedAt = Date.now()

  try {
    await fn()
    summary.push({ step, passed: true, durationMs: Date.now() - startedAt })
    console.log(`PASS ${step} (${Date.now() - startedAt}ms)`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error"
    summary.push({ step, passed: false, durationMs: Date.now() - startedAt, detail })
    console.error(`FAIL ${step} (${Date.now() - startedAt}ms) - ${detail}`)
  }
}

async function createTestUser() {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    }),
  })

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload.msg ?? payload.error_description ?? "Unable to create test user.")
  }

  userId = payload.id
}

async function signInUser() {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
  })

  const payload = await response.json()

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? "Unable to sign in test user.")
  }

  jwt = payload.access_token
}

async function authedFetch(path: string, init?: RequestInit) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${jwt}`,
    ...(init?.headers as Record<string, string> | undefined),
  }

  if (init?.body !== undefined && !("Content-Type" in headers)) {
    headers["Content-Type"] = "application/json"
  }

  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  })
}

async function createApiKey() {
  const response = await authedFetch("/v1/apikeys", {
    method: "POST",
    body: JSON.stringify({ name: "Smoke Test" }),
  })

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to create API key.")
  }

  keyId = payload.id
  rawKey = payload.key
}

function buildEvents() {
  const base = {
    tokens_in: 1200,
    tokens_out: 800,
    latency_ms: 620,
    metadata: {},
  }

  const make = (model: string, count: number, start: number) =>
    Array.from({ length: count }, (_, index) => ({
      ...base,
      model,
      request_id: `${RUN_ID}-${model}-${start + index}`,
      timestamp: new Date().toISOString(),
    }))

  return [
    ...make("claude-sonnet-4-6", 5, 1),
    ...make("gpt-5-mini", 4, 101),
    ...make("gemini-2-5-flash", 3, 201),
    ...make("deepseek-chat", 2, 301),
    ...make("unknown-model-xyz", 1, 401),
  ]
}

async function ingestEvents() {
  const events = buildEvents()

  for (const event of events) {
    const response = await fetch(`${BASE_URL}/v1/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rawKey}`,
      },
      body: JSON.stringify(event),
    })

    if (!response.ok) {
      throw new Error(`Ingest failed for ${event.model}`)
    }
  }
}

async function ingestDuplicate() {
  const duplicate = {
    model: "claude-sonnet-4-6",
    tokens_in: 1200,
    tokens_out: 800,
    latency_ms: 620,
    request_id: `${RUN_ID}-claude-sonnet-4-6-1`,
    timestamp: new Date().toISOString(),
  }

  const response = await fetch(`${BASE_URL}/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rawKey}`,
    },
    body: JSON.stringify(duplicate),
  })

  if (!response.ok) {
    throw new Error("Duplicate ingest failed.")
  }
}

async function waitForQueue() {
  await new Promise((resolve) => setTimeout(resolve, 5000))
}

async function assertOverview() {
  const response = await authedFetch("/v1/stats/overview")
  const payload = (await response.json()) as StatsOverview

  if (!response.ok || payload.total_requests !== 15) {
    throw new Error(`Expected total_requests=15, received ${payload.total_requests}`)
  }
}

async function assertRequests() {
  const response = await authedFetch("/v1/stats/requests")
  const payload = await response.json()

  if (!response.ok || payload.requests?.length !== 15) {
    throw new Error("Expected 15 request rows.")
  }
}

async function assertModels() {
  const response = await authedFetch("/v1/stats/models")
  const payload = await response.json()

  if (!response.ok) {
    throw new Error("Unable to fetch models breakdown.")
  }

  const providers = new Set((payload.models ?? []).map((item: { provider: string }) => item.provider))
  if (
    !providers.has("anthropic") ||
    !providers.has("openai") ||
    !providers.has("google") ||
    !providers.has("deepseek") ||
    !providers.has("unknown")
  ) {
    throw new Error("Expected anthropic, openai, google, deepseek, and unknown providers in model breakdown.")
  }

  if (!(payload.models ?? []).some((item: { model_id: string }) => item.model_id === "unknown-model-xyz")) {
    throw new Error("Expected unknown model to be visible in model breakdown.")
  }
}

async function assertUsersEmpty() {
  const response = await authedFetch("/v1/stats/users")
  const payload = await response.json()

  if (!response.ok || (payload.users ?? []).length !== 0) {
    throw new Error("Expected no top users.")
  }
}

async function assertAlertsPersist() {
  const save = await authedFetch("/v1/alerts/settings", {
    method: "PUT",
    body: JSON.stringify({
      monthly_threshold_usd: 50,
      daily_digest_enabled: true,
      email: TEST_EMAIL,
    }),
  })

  if (!save.ok) {
    throw new Error("Unable to save alert settings.")
  }

  const read = await authedFetch("/v1/alerts/settings")
  const payload = await read.json()

  if (!read.ok || payload.email !== TEST_EMAIL) {
    throw new Error("Alert settings were not persisted.")
  }
}

async function revokeKey() {
  const response = await authedFetch(`/v1/apikeys/${keyId}`, {
    method: "DELETE",
  })

  if (response.status !== 204) {
    throw new Error("Expected 204 from API key delete.")
  }
}

async function assertRevokedKeyBlocked() {
  const response = await fetch(`${BASE_URL}/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rawKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      tokens_in: 1,
      tokens_out: 1,
      latency_ms: 1,
      timestamp: new Date().toISOString(),
    }),
  })

  if (response.status !== 401) {
    throw new Error(`Expected 401 after revoke, received ${response.status}`)
  }
}

async function deleteTestUser() {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error("Unable to delete test user.")
  }

  const requestsResponse = await fetch(`${SUPABASE_URL}/rest/v1/requests?user_id=eq.${userId}&select=id`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })

  if (!requestsResponse.ok) {
    throw new Error("Unable to verify deleted user cleanup.")
  }

  const requestsPayload = (await requestsResponse.json()) as Array<{ id: string }>
  if (requestsPayload.length !== 0) {
    throw new Error("Expected deleted user request data to be removed.")
  }
}

async function assertModelsCatalog() {
  const response = await fetch(`${BASE_URL}/v1/models`)
  const payload = await response.json()

  if (!response.ok || (payload.models ?? []).length < 20) {
    throw new Error("Expected at least 20 active models.")
  }

  if ((payload.models ?? []).some((model: { is_active: boolean }) => model.is_active !== true)) {
    throw new Error("Expected all returned models to be active.")
  }
}

async function main() {
  await timed("1. Create test user via Supabase admin API", createTestUser)
  await timed("2. Get JWT for test user", signInUser)
  await timed("3. POST /v1/apikeys", createApiKey)
  await timed("4. Send 15 varied ingest requests", ingestEvents)
  await timed("5. Send 1 duplicate", ingestDuplicate)
  await timed("6. Wait 5 seconds for queue", waitForQueue)
  await timed("7. GET /v1/stats/overview", assertOverview)
  await timed("8. GET /v1/stats/requests", assertRequests)
  await timed("9. GET /v1/stats/models", assertModels)
  await timed("10. GET /v1/stats/users", assertUsersEmpty)
  await timed("11. PUT /v1/alerts/settings", assertAlertsPersist)
  await timed("12. DELETE /v1/apikeys/:id", revokeKey)
  await timed("13. POST /v1/ingest with revoked key", assertRevokedKeyBlocked)
  await timed("14. Delete test user", deleteTestUser)
  await timed("15. GET /v1/models", assertModelsCatalog)

  const passed = summary.filter((item) => item.passed).length

  console.log(`\nSummary: ${passed}/15 tests passed.`)
  process.exit(passed === 15 ? 0 : 1)
}

void main()
