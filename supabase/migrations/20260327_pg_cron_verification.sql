-- Enable pg_cron extension (requires superuser; run via Supabase Dashboard SQL Editor)
-- Dashboard → Database → Extensions → search "pg_cron" → Enable
-- OR run: CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron_settings table to store credentials safely without superuser ALTER DATABASE permissions
CREATE TABLE IF NOT EXISTS public.cron_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- Enable Row Level Security (RLS) on cron_settings to prevent public read/write access
ALTER TABLE public.cron_settings ENABLE ROW LEVEL SECURITY;

-- Schedule run_verification_queue to fire every day at 06:00 and 18:00 UTC.
-- Uses net.http_post from the pg_net extension (enabled by default in Supabase)

-- Remove old jobs if re-running this migration
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('finoracle_verify_morning', 'finoracle_verify_evening');

-- Morning run: 06:00 UTC
SELECT cron.schedule(
  'finoracle_verify_morning',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url     := (SELECT value FROM public.cron_settings WHERE key = 'supabase_url') || '/functions/v1/run_verification_queue',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.cron_settings WHERE key = 'cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Evening run: 18:00 UTC
SELECT cron.schedule(
  'finoracle_verify_evening',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url     := (SELECT value FROM public.cron_settings WHERE key = 'supabase_url') || '/functions/v1/run_verification_queue',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.cron_settings WHERE key = 'cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ⚠️  Credentials are NOT stored here — insert them via SQL Editor after deployment:
--   INSERT INTO public.cron_settings (key, value) VALUES
--     ('supabase_url', 'https://<project>.supabase.co'),
--     ('cron_secret', '<CRON_SECRET>')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
