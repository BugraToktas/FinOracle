-- Enable pg_cron extension (requires superuser; run via Supabase Dashboard SQL Editor)
-- Dashboard → Database → Extensions → search "pg_cron" → Enable
-- OR run: CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule run_verification_queue to fire every day at 06:00 and 18:00 UTC.
-- Uses net.http_post from the pg_net extension (enabled by default in Supabase).

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
    url     := current_setting('app.supabase_url') || '/functions/v1/run_verification_queue',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
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
    url     := current_setting('app.supabase_url') || '/functions/v1/run_verification_queue',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ⚠️  Credentials are NOT stored here — see pg_cron_credentials.local.sql (gitignored).
-- Run that file separately in SQL Editor after setting your real values.
