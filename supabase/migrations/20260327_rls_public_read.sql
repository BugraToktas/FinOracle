-- Allow the anon (frontend) role to read all core tables.
-- Edge functions use service_role so they are unaffected by RLS.

-- market_events
ALTER TABLE public.market_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_market_events" ON public.market_events;
CREATE POLICY "public_read_market_events"
  ON public.market_events FOR SELECT
  TO anon, authenticated
  USING (true);

-- analysis_results
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_analysis_results" ON public.analysis_results;
CREATE POLICY "public_read_analysis_results"
  ON public.analysis_results FOR SELECT
  TO anon, authenticated
  USING (true);

-- source_documents
ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_source_documents" ON public.source_documents;
CREATE POLICY "public_read_source_documents"
  ON public.source_documents FOR SELECT
  TO anon, authenticated
  USING (true);

-- news_sources
ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_news_sources" ON public.news_sources;
CREATE POLICY "public_read_news_sources"
  ON public.news_sources FOR SELECT
  TO anon, authenticated
  USING (true);

-- analysis_document_links
ALTER TABLE public.analysis_document_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_analysis_document_links" ON public.analysis_document_links;
CREATE POLICY "public_read_analysis_document_links"
  ON public.analysis_document_links FOR SELECT
  TO anon, authenticated
  USING (true);

-- revalidations
ALTER TABLE public.revalidations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_revalidations" ON public.revalidations;
CREATE POLICY "public_read_revalidations"
  ON public.revalidations FOR SELECT
  TO anon, authenticated
  USING (true);

-- analysis_source_links
ALTER TABLE public.analysis_source_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_analysis_source_links" ON public.analysis_source_links;
CREATE POLICY "public_read_analysis_source_links"
  ON public.analysis_source_links FOR SELECT
  TO anon, authenticated
  USING (true);
