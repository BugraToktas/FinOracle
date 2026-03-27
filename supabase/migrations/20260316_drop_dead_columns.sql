-- Migration 3: Drop dead columns that no edge function reads or writes.
-- IF EXISTS makes it safe to run multiple times.

ALTER TABLE public.source_documents       DROP COLUMN IF EXISTS status;
ALTER TABLE public.source_documents       DROP COLUMN IF EXISTS error_message;
ALTER TABLE public.analysis_source_links  DROP COLUMN IF EXISTS document_id;
