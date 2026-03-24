# Production Deployment Guide

This is the shipping guide for deploying Spendline to Railway and Vercel.

## Architecture

- API: Railway
- Web: Vercel
- Database/Auth: Supabase
- Queue: Upstash Redis
- Email: Resend

## Railway API

Service source:

- repo root
- Dockerfile: `apps/api/Dockerfile`

Required environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `UPSTASH_REDIS_URL`
- `UPSTASH_REDIS_TOKEN`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `PORT=3001`
- `NODE_ENV=production`
- `CORS_ORIGIN=https://your-vercel-domain`
- `API_URL=https://your-railway-domain`

Health check:

- `/health`

Required checks after deploy:

1. `GET /health`
2. `GET /v1/models`
3. API key creation
4. ingest request
5. stats endpoints
6. alert test email

## Vercel Web

Root directory:

- `apps/web`

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL=https://your-railway-domain`

Important:

- `NEXT_PUBLIC_API_URL` must include `https://`
- example: `NEXT_PUBLIC_API_URL=https://spendline-production.up.railway.app`

Required checks after deploy:

1. landing page loads
2. auth callback works
3. dashboard loads
4. API key flow works
5. logs and overview pages render

## Supabase Configuration

Set:

- Site URL: `https://your-vercel-domain`
- Redirect URL: `https://your-vercel-domain/auth/callback`

Run migrations in order:

1. `database/migrations/001_initial.sql`
2. `database/migrations/002_alert_history.sql`
3. `database/migrations/003_profiles_preferences.sql`

## GitHub OAuth

GitHub OAuth app settings:

- Homepage URL: `https://your-vercel-domain`
- Authorization callback URL: `https://<your-project-ref>.supabase.co/auth/v1/callback`

## Resend

Production sender:

- `RESEND_FROM_EMAIL=alerts@yourdomain.com`

That sender must belong to a verified Resend domain.

## Final Production Smoke Test

Run the backend smoke test against production:

```powershell
$env:BASE_URL="https://your-railway-domain"
$env:SUPABASE_SERVICE_KEY="your-service-role-key"
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_ANON_KEY="your-anon-key"
apps\api\node_modules\.bin\tsx.CMD scripts\smoke-test.ts
```

## Current Production URLs

- Web: `https://spend-line.vercel.app`
- API: `https://spendline-production.up.railway.app`
