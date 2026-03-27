-- Migration 4: Atomic reputation update function.
-- CREATE OR REPLACE is safe to run multiple times.

CREATE OR REPLACE FUNCTION public.increment_source_reputation(
  p_source_id uuid,
  p_is_correct boolean
)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.news_sources
  SET
    total_predictions   = total_predictions + 1,
    correct_predictions = correct_predictions + (CASE WHEN p_is_correct THEN 1 ELSE 0 END),
    reputation_score    = (correct_predictions + (CASE WHEN p_is_correct THEN 1 ELSE 0 END) + 1.0)
                        / (total_predictions + 1 + 2.0),
    last_updated        = now()
  WHERE id = p_source_id;
$$;
