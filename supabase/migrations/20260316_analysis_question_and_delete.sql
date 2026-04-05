-- ── 1. Add question column to analysis_results ───────────────────────────────
-- Stores the original user question that generated this analysis.
ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS question text;

-- ── 2. RLS: users can delete their own market_events ─────────────────────────
-- Deleting a market_event cascades to analysis_results via ON DELETE CASCADE.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'market_events'
      AND policyname = 'market_events_delete_owner'
  ) THEN
    CREATE POLICY "market_events_delete_owner"
      ON public.market_events FOR DELETE
      USING (
        -- allow if this user has at least one analysis on this event
        EXISTS (
          SELECT 1 FROM public.analysis_results ar
          WHERE ar.event_id = id AND ar.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 3. RLS: users can delete their own analysis_results ──────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'analysis_results'
      AND policyname = 'analysis_results_delete_owner'
  ) THEN
    CREATE POLICY "analysis_results_delete_owner"
      ON public.analysis_results FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END $$;
