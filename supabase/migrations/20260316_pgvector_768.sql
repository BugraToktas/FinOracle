-- ─────────────────────────────────────────────────────────────────────────────
-- Switch pgvector embedding column from OpenAI 1536 dims to Gemini 768 dims.
-- Also upgrade index from ivfflat → hnsw (better for small datasets).
-- All existing embeddings are NULL so the column drop/re-add is safe.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop old index (was built for 1536 dims)
DROP INDEX IF EXISTS source_documents_embedding_idx;

-- 2. Drop and re-add embedding column at 768 dims
ALTER TABLE public.source_documents DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.source_documents ADD COLUMN embedding vector(768);

-- 3. HNSW index — works well for small-to-medium datasets, no minimum row count
CREATE INDEX IF NOT EXISTS source_documents_embedding_idx
  ON public.source_documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. Update match_source_documents RPC to use 768 dims
CREATE OR REPLACE FUNCTION public.match_source_documents(
  query_embedding  vector(768),
  match_threshold  float  DEFAULT 0.5,
  match_count      int    DEFAULT 10
)
RETURNS TABLE (
  id              uuid,
  url             text,
  domain          text,
  title           text,
  content_snippet text,
  published_at    timestamptz,
  similarity      float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    url,
    domain,
    title,
    content_snippet,
    published_at,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.source_documents
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
