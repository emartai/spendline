# Spendline API

## Local Development

```bash
pnpm --filter @spendline/api dev
```

## Environment Variables

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `UPSTASH_REDIS_URL`
- `UPSTASH_REDIS_TOKEN`
- `RESEND_API_KEY`
- `PORT`
- `NODE_ENV`
- `CORS_ORIGIN`
- `API_URL`

## API Routes

| Route | Description |
| --- | --- |
| `GET /health` | Healthcheck |
| `POST /v1/ingest` | Ingest tracked request events |
| `GET /v1/models` | Public active model pricing catalog |
| `GET /v1/stats/*` | Dashboard statistics routes |
| `GET/POST/DELETE /v1/apikeys` | API key management |
| `GET/PUT/POST /v1/alerts/*` | Alert settings, history, and test send |
