-- Create the fundamentals table for caching P/E ratios from yfinance.
-- Run this in the Supabase SQL Editor if the table does not exist.

CREATE TABLE IF NOT EXISTS fundamentals (
  symbol TEXT PRIMARY KEY,
  pe_ratio NUMERIC NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional: index for queries that filter or sort by updated_at
CREATE INDEX IF NOT EXISTS idx_fundamentals_updated_at ON fundamentals (updated_at);

-- Optional: allow the dashboard to read (RLS can be enabled later)
-- ALTER TABLE fundamentals ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow read for authenticated" ON fundamentals FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE fundamentals IS 'Cached stock fundamentals (e.g. P/E) from yfinance; populated by backend cache_fundamentals.py';
