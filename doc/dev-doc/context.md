# Spendline — Project Context

## What is Spendline?
Spendline is an LLM cost monitoring tool for developers and engineering teams. It provides a lightweight SDK that wraps any LLM API call and streams telemetry (tokens, cost, latency, model) to a real-time dashboard. It is the observability HUD your dev team needs to track, understand, and control AI inference spend across every provider.

## Tagline
LLM COST MONITORING

## Target Users
- Individual developers who just received their first large LLM bill
- Small engineering teams running LLM-powered features in production
- Teams using LangChain, LlamaIndex, or raw API calls at scale
- Cost-conscious developers running DeepSeek, Gemini, or multi-provider setups

## Core Problem
Developers have no visibility into LLM spend until the bill arrives. There is no native per-feature, per-workflow, or per-request cost tracking across providers. Spendline fixes this with a one-line SDK wrapper and a real-time dashboard.

## MVP Goal
50 active developers. Validate the core pain point. Free only — no credit card. Buy installs and feedback, not revenue.

## Brand
- Logo: `$pendline` — the `$` is always in brand green `#2ECC8A`, `pendline` in white
- Tagline: LLM COST MONITORING — always uppercase
- Theme: dark-first, developer-native
- Primary background: `#0d1117`
- Primary accent: `#2ECC8A`

## Phases Overview
| Phase | Timeline | MRR Target |
|-------|----------|------------|
| MVP   | Month 0–3 | $0 (free beta) |
| V1    | Month 3–6 | $3k–$6k |
| V2    | Month 6–12 | $25k–$40k |
| V3    | Month 12–18 | $80k–$120k |
| V4    | Month 18–30 | $250k–$400k |

## MVP Features (Scope)

### SDK & Instrumentation
- Python SDK (`pip install spendline`) — OpenAI, Anthropic, Google Gemini, DeepSeek, AWS Bedrock
- JavaScript SDK (`npm install spendline`) — same providers
- Auto-captures: tokens in/out, model, cost, latency, timestamp, workflow_id, session_id, user_id, request_id
- LangChain and LlamaIndex native support
- Zero-config mode via `SPENDLINE_API_KEY` env var
- Batch ingest — up to 100 events per POST
- Request deduplication via `request_id`
- Auto-detects provider from model name

### Pricing Engine
- DB-driven pricing via Supabase `models` table
- Public `/v1/models` endpoint — no auth, CDN cached 1 hour
- SDK fetches and caches pricing map locally for 24 hours
- You update pricing with one SQL statement — no redeploy needed
- Unknown models tracked with `cost_usd = 0` and `unknown_model: true`
- 5 providers supported at launch: Anthropic, OpenAI, Google Gemini, DeepSeek, AWS Bedrock

### Dashboard (6 pages)
1. Login / Landing — combined page
2. Overview — stat cards, spend graph, model breakdown, top users, recent requests
3. Request Log — full filterable paginated table with CSV export
4. Alerts — spend threshold + daily digest
5. API Keys — generate, copy, revoke + SDK snippet
6. Settings — email, password, data export, delete account

### Alerts
- Email alert when monthly spend crosses user-defined threshold (fires once per month)
- Optional daily spend digest (only sent on days with activity)

### Onboarding
- 3-step first-run flow: create key → install SDK → detect first request
- Auto-advances when first request detected

## What is NOT in MVP
- Teams or roles
- ROI metrics
- Forecasting
- Budget caps or hard stops
- Slack / PagerDuty / Datadog integrations
- Workflow attribution (multi-step agent chain collapsing)
- Enterprise features

## Monorepo Structure
```
spendline/
├── apps/
│   ├── web/          # Next.js 14 (App Router) — dashboard + landing
│   └── api/          # Fastify Node.js — backend API
├── packages/
│   ├── sdk-python/   # Python SDK published to PyPI
│   └── sdk-js/       # JS/TS SDK published to npm
├── database/
│   └── migrations/   # SQL migration files
├── scripts/          # smoke-test.ts and utility scripts
└── package.json      # pnpm workspace root
```

## Data Flow
```
SDK call
  → Batch buffer (flush every 2s or at 100 events)
  → POST /v1/ingest (Fastify, <20ms response)
  → BullMQ queue (Upstash Redis)
  → Worker deduplicates on request_id
  → Worker writes to TimescaleDB (Supabase Postgres)
  → Next.js dashboard queries stats API
  → Recharts renders graphs
  → SWR refreshes every 30 seconds
```

## Growth Strategy (MVP)
Write 5 deeply technical articles targeting exact search queries engineers type when they get their first big LLM bill:
- "Why my LangChain agent cost $400 last week and how I fixed it"
- "How to track OpenAI spend per feature in production"
- "DeepSeek is cheap but do you know what it's actually costing you"
- "How to monitor Gemini API costs across your team"
- "Multi-provider LLM cost tracking in one dashboard"

Each article ends with `pip install spendline`. Submit to Hacker News, r/LocalLLaMA, r/MachineLearning, LangChain Discord.

## Key Decisions
- Supabase for both database and auth (no Clerk)
- DB-driven pricing model — never hardcode costs in SDK
- Batch ingest from day one — handles high-volume users
- Deduplication on request_id — prevents double-counting on retries
- Auto-detect provider from model name — reduces SDK friction
- 5 providers at launch (not 3) — Gemini and DeepSeek are mainstream now
- store model_raw AND model_normalised — preserve exact string, normalise for display
- session_id alongside workflow_id — these are different concepts
- Top users table — most actionable insight for B2C apps
- Data export in settings — removes lock-in objection
- Plain-text founder email at day 7 inactivity — highest conversion lever
