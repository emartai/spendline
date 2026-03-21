# Deploying Spendline

## 1. Supabase Setup
- Create a new Supabase project.
- Run the SQL from [database/migrations/002_alert_history.sql](./database/migrations/002_alert_history.sql) and [database/migrations/003_profiles_preferences.sql](./database/migrations/003_profiles_preferences.sql).
- Ensure the core MVP tables exist: `profiles`, `api_keys`, `requests`, `models`, `alert_settings`, `alert_history`.
- Enable GitHub and email/password auth in Supabase Auth.
- Copy:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_KEY`

## 2. Upstash Setup
- Create a Redis database in Upstash.
- Copy:
  - `UPSTASH_REDIS_URL`
  - `UPSTASH_REDIS_TOKEN`

## 3. Resend Setup
- Create a Resend account and verify your sending domain.
- Copy:
  - `RESEND_API_KEY`
- For development you can use `onboarding@resend.dev`.

## 4. Railway Deploy
- Create a Railway project for the API.
- Point Railway at this repository.
- Use [apps/api/Dockerfile](./apps/api/Dockerfile).
- Set these Railway environment variables:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_KEY`
  - `UPSTASH_REDIS_URL`
  - `UPSTASH_REDIS_TOKEN`
  - `RESEND_API_KEY`
  - `PORT=3001`
  - `NODE_ENV=production`
  - `CORS_ORIGIN=https://your-web-domain.vercel.app`
  - `API_URL=https://your-api-domain.up.railway.app`
- Confirm Railway uses [railway.toml](./railway.toml).

## 5. Vercel Deploy
- Import `apps/web` into Vercel as the app root.
- Set these Vercel environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_API_URL=https://your-api-domain.up.railway.app`
  - `SUPABASE_SERVICE_KEY`
- Confirm [apps/web/vercel.json](./apps/web/vercel.json) and [apps/web/next.config.js](./apps/web/next.config.js) are active.

## 6. Post-Deploy Checklist
- Open `https://your-api-domain.up.railway.app/health` and confirm `{ "status": "ok" }`.
- Sign into the Vercel app and generate an API key.
- Send a test ingest request using that key.
- Confirm the Overview page shows the request.
- Save alert settings and send a test digest.
- Run the smoke test script:
  - `npx tsx scripts/smoke-test.ts`
