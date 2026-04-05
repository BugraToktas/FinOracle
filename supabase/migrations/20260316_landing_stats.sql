-- Public stats for the landing page (no auth required).
CREATE OR REPLACE FUNCTION public.get_landing_stats()
RETURNS TABLE (
  total_analyses  bigint,
  total_sources   bigint,
  total_assets    bigint,
  verified_count  bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.analysis_results)                        AS total_analyses,
    (SELECT COUNT(*) FROM public.source_documents)                        AS total_sources,
    (SELECT COUNT(DISTINCT asset_code) FROM public.market_events)         AS total_assets,
    (SELECT COUNT(*) FROM public.analysis_results WHERE status = 'verified') AS verified_count;
$$;
