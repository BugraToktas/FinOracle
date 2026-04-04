-- ─────────────────────────────────────────────────────────────────────────────
-- User profiles table
-- Mirrors auth.users with public-accessible metadata.
-- Auto-created on first sign-in via trigger.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text,
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Auto-insert profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Add user_id to market_events (nullable for existing rows)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.market_events
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS market_events_user_id_idx ON public.market_events(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Add user_id to analysis_results (nullable for existing rows)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS analysis_results_user_id_idx ON public.analysis_results(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policies for profiles
-- PostgreSQL does not support CREATE POLICY IF NOT EXISTS — use DO blocks
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY "profiles_select_own"
      ON public.profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY "profiles_update_own"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policy for market_events INSERT
-- Public read is already set by earlier migration; add owner-write policy
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'market_events' AND policyname = 'market_events_insert_owner'
  ) THEN
    CREATE POLICY "market_events_insert_owner"
      ON public.market_events FOR INSERT
      WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Daily analysis count helper function (per user, UTC day)
-- Returns how many analyses the current user has created today.
-- Called by the frontend via RPC: supabase.rpc('get_today_analysis_count')
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_today_analysis_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer
  FROM public.analysis_results
  WHERE user_id = auth.uid()
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
    AND created_at <  date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day';
$$;
