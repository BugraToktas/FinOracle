-- Add provider column to source_documents so we know which API returned each source.
-- Possible values: 'alphavantage' | 'finnhub' | 'newsdata' | 'yahoo_news' | 'rss' | null

ALTER TABLE public.source_documents
  ADD COLUMN IF NOT EXISTS provider text;
