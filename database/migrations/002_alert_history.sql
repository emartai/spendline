CREATE TABLE IF NOT EXISTS alert_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('threshold', 'daily_digest')),
  amount_usd NUMERIC(12, 8),
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_user_created_at
  ON alert_history(user_id, created_at DESC);

ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own alert history"
  ON alert_history FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role inserts alert history"
  ON alert_history FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION get_request_timeseries(
  p_user_id UUID,
  p_bucket INTERVAL,
  p_start TIMESTAMPTZ
)
RETURNS TABLE (
  bucket TIMESTAMPTZ,
  spend_usd NUMERIC,
  requests BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT
    date_trunc(
      CASE
        WHEN p_bucket = INTERVAL '1 hour'  THEN 'hour'
        WHEN p_bucket = INTERVAL '1 day'   THEN 'day'
        WHEN p_bucket = INTERVAL '1 week'  THEN 'week'
        ELSE 'hour'
      END,
      timestamp
    ) AS bucket,
    COALESCE(SUM(cost_usd), 0) AS spend_usd,
    COUNT(*)::BIGINT AS requests
  FROM requests
  WHERE user_id = p_user_id
    AND timestamp >= p_start
  GROUP BY 1
  ORDER BY 1 ASC;
$$;
