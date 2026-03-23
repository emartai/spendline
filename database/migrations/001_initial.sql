CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  onboarded BOOLEAN DEFAULT FALSE,
  timezone TEXT DEFAULT 'UTC',
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Models (pricing source of truth)
CREATE TABLE IF NOT EXISTS models (
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
CREATE TABLE IF NOT EXISTS requests (
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM timescaledb_information.hypertables
    WHERE hypertable_schema = 'public'
      AND hypertable_name = 'requests'
  ) THEN
    PERFORM create_hypertable('requests', 'timestamp');
  END IF;
END $$;

-- Alert Settings
CREATE TABLE IF NOT EXISTS alert_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  monthly_threshold_usd NUMERIC(10, 2),
  threshold_fired_month TEXT,
  daily_digest_enabled BOOLEAN DEFAULT FALSE,
  email TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_requests_user_timestamp ON requests(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_requests_model ON requests(model_normalised);
CREATE INDEX IF NOT EXISTS idx_requests_workflow ON requests(workflow_id);
CREATE INDEX IF NOT EXISTS idx_requests_session ON requests(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_request_id ON requests(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_models_model_id ON models(model_id);

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
('claude-opus-4-6',         'anthropic', 'Claude Opus 4.6',         5.00,  25.00, 200000),
('claude-sonnet-4-6',       'anthropic', 'Claude Sonnet 4.6',       3.00,  15.00, 200000),
('claude-haiku-4-5',        'anthropic', 'Claude Haiku 4.5',        1.00,   5.00, 200000),
('claude-3-5-sonnet-20241022', 'anthropic', 'Claude 3.5 Sonnet',    3.00,  15.00, 200000),
('claude-3-5-haiku-20241022',  'anthropic', 'Claude 3.5 Haiku',     0.25,   1.25, 200000),
('gpt-5.2',      'openai', 'GPT-5.2',         1.75, 14.00, 200000),
('gpt-5-mini',   'openai', 'GPT-5 Mini',       0.25,  2.00, 200000),
('gpt-5-nano',   'openai', 'GPT-5 Nano',       0.05,  0.40, 128000),
('gpt-4o',       'openai', 'GPT-4o',           2.50, 10.00, 128000),
('gpt-4o-mini',  'openai', 'GPT-4o Mini',      0.15,  0.60, 128000),
('gpt-4.1',      'openai', 'GPT-4.1',          2.00,  8.00, 1000000),
('gpt-4.1-mini', 'openai', 'GPT-4.1 Mini',     0.40,  1.60, 1000000),
('o3',      'openai', 'o3',       2.00,  8.00, 200000),
('o4-mini', 'openai', 'o4-mini',  1.10,  4.40, 200000),
('gemini-3-1-pro-preview',   'google', 'Gemini 3.1 Pro (Preview)',    2.00, 18.00, 200000),
('gemini-3-1-flash-lite',    'google', 'Gemini 3.1 Flash-Lite',       0.25,  1.50, 1000000),
('gemini-3-flash-preview',   'google', 'Gemini 3 Flash (Preview)',     0.50,  3.00, 1000000),
('gemini-2-5-pro',        'google', 'Gemini 2.5 Pro',        1.25, 10.00, 2000000),
('gemini-2-5-flash',      'google', 'Gemini 2.5 Flash',      0.30,  2.50, 1000000),
('gemini-2-5-flash-lite', 'google', 'Gemini 2.5 Flash-Lite', 0.10,  0.40, 1000000),
('deepseek-chat',      'deepseek', 'DeepSeek V3.2 Chat',      0.28, 0.42, 128000),
('deepseek-reasoner',  'deepseek', 'DeepSeek V3.2 Reasoner',  0.28, 0.42, 128000),
('anthropic.claude-sonnet-4-5-20251022-v1:0', 'bedrock', 'Claude Sonnet 4.6 (Bedrock)', 3.00, 15.00, 200000),
('anthropic.claude-haiku-4-5-20251022-v1:0',  'bedrock', 'Claude Haiku 4.5 (Bedrock)',  1.00,  5.00, 200000),
('anthropic.claude-3-5-sonnet-20241022-v2:0', 'bedrock', 'Claude 3.5 Sonnet (Bedrock)', 3.00, 15.00, 200000)
ON CONFLICT (model_id) DO NOTHING;
