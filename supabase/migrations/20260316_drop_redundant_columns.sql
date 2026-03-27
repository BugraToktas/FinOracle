-- Migration 2: Remove redundant / never-populated columns.
-- IF EXISTS makes it safe to run multiple times.

ALTER TABLE public.analysis_results DROP COLUMN IF EXISTS verified;
ALTER TABLE public.source_documents  DROP COLUMN IF EXISTS content_hash;
