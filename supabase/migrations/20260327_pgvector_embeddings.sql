-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to source_documents (1536 dims = text-embedding-3-small / ada-002)
-- Use 768 if you plan to use a smaller model.
ALTER TABLE public.source_documents
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Index for fast ANN (approximate nearest-neighbour) search using cosine similarity
CREATE INDEX IF NOT EXISTS source_documents_embedding_idx
  ON public.source_documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Helper RPC: find source_documents semantically similar to a query embedding.
-- Usage: SELECT * FROM match_source_documents(query_embedding, 0.5, 10);
CREATE OR REPLACE FUNCTION public.match_source_documents(
  query_embedding vector(1536),
  match_threshold float  DEFAULT 0.5,
  match_count     int    DEFAULT 10
)
RETURNS TABLE (
  id             uuid,
  url            text,
  domain         text,
  title          text,
  content_snippet text,
  published_at   timestamptz,
  similarity     float
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
