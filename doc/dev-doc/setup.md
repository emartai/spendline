# Spendline — Setup Guide

Complete step-by-step setup for every external service. Do all of this before writing any code.

---

## 1. Supabase

### Create Project
1. Go to https://supabase.com and sign up
2. Create a new project — name it `spendline-mvp`
3. Choose a strong database password and save it
4. Select the region closest to your Railway deployment (e.g. us-east-1)

### Enable TimescaleDB
1. In your project go to **Database → Extensions**
2. Search for `timescaledb` and enable it
3. Verify in SQL Editor:
```sql
SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';
```

### Run the Database Migration
Go to **SQL Editor** and run the full contents of `database/migrations/001_initial.sql` from this repo. This creates all tables, indexes, RLS policies, triggers, and hypertable.

### Configure Auth — GitHub OAuth
1. Go to https://github.com/settings/developers → **New OAuth App**
2. Fill in:
   - Application name: `Spendline`
   - Homepage URL: `https://yourdomain.com` (or `http://localhost:3000` for local)
   - Authorization callback URL: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Copy **Client ID** and generate a **Client Secret**
4. In Supabase go to **Authentication → Providers → GitHub**
5. Paste Client ID and Client Secret, enable it

### Configure Auth — URL Settings
1. In Supabase go to **Authentication → URL Configuration**
2. Site URL: `https://yourdomain.com` (or `http://localhost:3000` for local)
3. Redirect URLs — add both:
   - `https://yourdomain.com/auth/callback`
   - `http://localhost:3000/auth/callback`

### Get Your Keys
Go to **Settings → API** and copy:
- `Project URL` → used as `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → used as `SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role secret` key → used as `SUPABASE_SERVICE_KEY` — **never expose this on the frontend**

### Verify RLS
Run this to confirm RLS is on for all tables:
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```
All tables must show `rowsecurity = true`.

---

## 2. Upstash (Redis / BullMQ)

1. Go to https://upstash.com and sign up
2. Create a new **Redis** database
   - Name: `spendline-queue`
   - Region: match your Railway region
   - Type: Regional (free tier)
3. From the database details page copy:
   - `UPSTASH_REDIS_URL` (starts with `redis://` or `rediss://`)
   - `UPSTASH_REDIS_TOKEN`
4. Free tier: 10,000 commands/day — sufficient for MVP

---

## 3. Resend (Email)

1. Go to https://resend.com and sign up
2. Go to **API Keys → Create API Key**
   - Name: `spendline-mvp`
   - Permission: Full access
3. Copy key → `RESEND_API_KEY`
4. Go to **Domains → Add Domain** and verify your sending domain
5. If you have no domain yet, use `onboarding@resend.dev` for development only
6. Free tier: 3,000 emails/month — sufficient for MVP

---

## 4. Railway (API Backend)

1. Go to https://railway.app and sign up
2. Create a new project → **Deploy from GitHub repo**
3. Select your repo, set root directory to `apps/api`
4. Set build command: `pnpm --filter @spendline/api build`
5. Set start command: `node dist/index.js`
6. Set health check path: `/health`
7. Add all environment variables from the list below
8. Free credit: $5/month. Hobby plan: $20/month when credit runs out

**Do not add a Railway Postgres or Redis** — you are using Supabase for Postgres and Upstash for Redis.

---

## 5. Vercel (Frontend)

1. Go to https://vercel.com and sign up
2. Import your GitHub repo
3. Set **Root Directory** to `apps/web`
4. Framework preset: Next.js (auto-detected)
5. Add all `NEXT_PUBLIC_` environment variables
6. Add your custom domain under **Domains**
7. Free tier covers MVP

---

## Environment Variables

### `apps/api/.env`
```env
# Supabase
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Upstash Redis
UPSTASH_REDIS_URL=rediss://default:...@...upstash.io:6379
UPSTASH_REDIS_TOKEN=...

# Resend
RESEND_API_KEY=re_...

# App
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
API_URL=http://localhost:3001
```

### `apps/web/.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Database Migration SQL

Run this entire block in Supabase SQL Editor:

```sql
-- Enable TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  onboarded BOOLEAN DEFAULT FALSE,
  timezone TEXT DEFAULT 'UTC',
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys
CREATE TABLE api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Models (pricing source of truth)
CREATE TABLE models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  input_cost_per_1m NUMERIC(12, 8) NOT NULL DEFAULT 0,
  output_cost_per_1m NUMERIC(12, 8) NOT NULL DEFAULT 0,
  context_window INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  deprecated_at TIMESTAMPTZ,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Requests (main data table)
CREATE TABLE requests (
  id UUID DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  model_raw TEXT NOT NULL,
  model_normalised TEXT NOT NULL,
  provider TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  workflow_id TEXT,
  session_id TEXT,
  request_id TEXT UNIQUE,
  metadata JSONB,
  unknown_model BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('requests', 'timestamp');

-- Alert Settings
CREATE TABLE alert_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  monthly_threshold_usd NUMERIC(10, 2),
  threshold_fired_month TEXT,
  daily_digest_enabled BOOLEAN DEFAULT FALSE,
  email TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_requests_user_timestamp ON requests(user_id, timestamp DESC);
CREATE INDEX idx_requests_model ON requests(model_normalised);
CREATE INDEX idx_requests_workflow ON requests(workflow_id);
CREATE INDEX idx_requests_session ON requests(session_id);
CREATE UNIQUE INDEX idx_requests_request_id ON requests(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE UNIQUE INDEX idx_models_model_id ON models(model_id);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

-- RLS Policies: profiles
CREATE POLICY "Users view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- RLS Policies: api_keys
CREATE POLICY "Users view own keys"
  ON api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own keys"
  ON api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own keys"
  ON api_keys FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users update own keys"
  ON api_keys FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies: requests
CREATE POLICY "Users view own requests"
  ON requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role inserts requests"
  ON requests FOR INSERT WITH CHECK (true);

-- RLS Policies: alert_settings
CREATE POLICY "Users manage own alerts"
  ON alert_settings FOR ALL USING (auth.uid() = user_id);

-- RLS Policies: models (public read)
CREATE POLICY "Anyone can read models"
  ON models FOR SELECT USING (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Seed models table with current pricing (March 2026)
INSERT INTO models (model_id, provider, display_name, input_cost_per_1m, output_cost_per_1m, context_window) VALUES

-- Anthropic Claude 4 (current)
('claude-opus-4-6',         'anthropic', 'Claude Opus 4.6',         5.00,  25.00, 200000),
('claude-sonnet-4-6',       'anthropic', 'Claude Sonnet 4.6',       3.00,  15.00, 200000),
('claude-haiku-4-5',        'anthropic', 'Claude Haiku 4.5',        1.00,   5.00, 200000),

-- Anthropic Claude 3.5 (previous gen, still in production)
('claude-3-5-sonnet-20241022', 'anthropic', 'Claude 3.5 Sonnet',    3.00,  15.00, 200000),
('claude-3-5-haiku-20241022',  'anthropic', 'Claude 3.5 Haiku',     0.25,   1.25, 200000),

-- OpenAI GPT-5 (current)
('gpt-5.2',      'openai', 'GPT-5.2',         1.75, 14.00, 200000),
('gpt-5-mini',   'openai', 'GPT-5 Mini',       0.25,  2.00, 200000),
('gpt-5-nano',   'openai', 'GPT-5 Nano',       0.05,  0.40, 128000),

-- OpenAI GPT-4 (previous gen, still widely used)
('gpt-4o',       'openai', 'GPT-4o',           2.50, 10.00, 128000),
('gpt-4o-mini',  'openai', 'GPT-4o Mini',      0.15,  0.60, 128000),
('gpt-4.1',      'openai', 'GPT-4.1',          2.00,  8.00, 1000000),
('gpt-4.1-mini', 'openai', 'GPT-4.1 Mini',     0.40,  1.60, 1000000),

-- OpenAI Reasoning
('o3',      'openai', 'o3',       2.00,  8.00, 200000),
('o4-mini', 'openai', 'o4-mini',  1.10,  4.40, 200000),

-- Google Gemini 3.x (current)
('gemini-3-1-pro-preview',   'google', 'Gemini 3.1 Pro (Preview)',    2.00, 18.00, 200000),
('gemini-3-1-flash-lite',    'google', 'Gemini 3.1 Flash-Lite',       0.25,  1.50, 1000000),
('gemini-3-flash-preview',   'google', 'Gemini 3 Flash (Preview)',     0.50,  3.00, 1000000),

-- Google Gemini 2.5 (stable)
('gemini-2-5-pro',        'google', 'Gemini 2.5 Pro',        1.25, 10.00, 2000000),
('gemini-2-5-flash',      'google', 'Gemini 2.5 Flash',      0.30,  2.50, 1000000),
('gemini-2-5-flash-lite', 'google', 'Gemini 2.5 Flash-Lite', 0.10,  0.40, 1000000),

-- DeepSeek (current unified model)
('deepseek-chat',      'deepseek', 'DeepSeek V3.2 Chat',      0.28, 0.42, 128000),
('deepseek-reasoner',  'deepseek', 'DeepSeek V3.2 Reasoner',  0.28, 0.42, 128000),

-- AWS Bedrock (Anthropic models, same pricing as direct)
('anthropic.claude-sonnet-4-5-20251022-v1:0', 'bedrock', 'Claude Sonnet 4.6 (Bedrock)', 3.00, 15.00, 200000),
('anthropic.claude-haiku-4-5-20251022-v1:0',  'bedrock', 'Claude Haiku 4.5 (Bedrock)',  1.00,  5.00, 200000),
('anthropic.claude-3-5-sonnet-20241022-v2:0', 'bedrock', 'Claude 3.5 Sonnet (Bedrock)', 3.00, 15.00, 200000);
```

---

## Model Normalisation Map

The API uses this map to normalise raw model strings to canonical IDs. Add to this as new models appear.

```typescript
// apps/api/src/lib/normalise.ts
export const MODEL_NORMALISATION_MAP: Record<string, string> = {
  // OpenAI aliases
  'gpt-4o-2024-11-20':   'gpt-4o',
  'gpt-4o-2024-08-06':   'gpt-4o',
  'gpt-4o-mini-2024-07-18': 'gpt-4o-mini',

  // Anthropic aliases
  'claude-sonnet-4-20250514':  'claude-sonnet-4-6',
  'claude-opus-4-20250514':    'claude-opus-4-6',
  'claude-haiku-4-5-20251001': 'claude-haiku-4-5',

  // Google aliases
  'gemini-2.5-pro':          'gemini-2-5-pro',
  'gemini-2.5-flash':        'gemini-2-5-flash',
  'gemini-2.5-flash-lite':   'gemini-2-5-flash-lite',
  'gemini-3.1-pro-preview':  'gemini-3-1-pro-preview',
}

export function normaliseModel(raw: string): string {
  return MODEL_NORMALISATION_MAP[raw] ?? raw
}
```

---

## Provider Auto-Detection Map

```typescript
// apps/api/src/lib/provider.ts
export function detectProvider(modelId: string): string {
  if (modelId.startsWith('claude-'))        return 'anthropic'
  if (modelId.startsWith('gpt-'))           return 'openai'
  if (modelId.startsWith('o1') ||
      modelId.startsWith('o3') ||
      modelId.startsWith('o4'))             return 'openai'
  if (modelId.startsWith('gemini-'))        return 'google'
  if (modelId.startsWith('deepseek-'))      return 'deepseek'
  if (modelId.startsWith('anthropic.'))     return 'bedrock'
  if (modelId.startsWith('amazon.'))        return 'bedrock'
  return 'unknown'
}
```
done
