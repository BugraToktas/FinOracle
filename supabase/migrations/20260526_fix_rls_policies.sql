-- ── Fix 1: profiles admin_select_all — recursive loop fix ────────────────────
-- The old policy called SELECT on profiles inside a USING clause on profiles,
-- causing infinite recursion and 500 errors.
-- Replace with a non-recursive check using auth.jwt() claims or a security
-- definer function.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Drop the recursive policy and replace with the function-based one
DROP POLICY IF EXISTS "profiles_admin_select_all" ON public.profiles;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_admin_select_all'
  ) THEN
    CREATE POLICY "profiles_admin_select_all"
      ON public.profiles
      FOR SELECT
      USING (public.is_admin() OR auth.uid() = id);
  END IF;
END $$;

-- ── Fix 2: analysis_results INSERT for authenticated users ────────────────────
-- Edge functions use service_role (bypasses RLS), but add explicit policy
-- for completeness and to avoid issues if service_role key changes.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'analysis_results'
      AND policyname = 'analysis_results_insert_owner'
  ) THEN
    CREATE POLICY "analysis_results_insert_owner"
      ON public.analysis_results FOR INSERT
      WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
  END IF;
END $$;

-- ── Fix 3: source_documents INSERT for service role (edge functions) ──────────
-- source_documents has RLS enabled but no INSERT policy — service_role bypasses
-- this, but add it defensively.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'source_documents'
      AND policyname = 'source_documents_insert_service'
  ) THEN
    CREATE POLICY "source_documents_insert_service"
      ON public.source_documents FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- ── Fix 4: analysis_document_links INSERT ─────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'analysis_document_links'
      AND policyname = 'analysis_document_links_insert'
  ) THEN
    CREATE POLICY "analysis_document_links_insert"
      ON public.analysis_document_links FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- ── Fix 5: news_sources INSERT ────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'news_sources'
      AND policyname = 'news_sources_insert'
  ) THEN
    CREATE POLICY "news_sources_insert"
      ON public.news_sources FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- ── Fix 6: analysis_source_links INSERT ───────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'analysis_source_links'
      AND policyname = 'analysis_source_links_insert'
  ) THEN
    CREATE POLICY "analysis_source_links_insert"
      ON public.analysis_source_links FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;
