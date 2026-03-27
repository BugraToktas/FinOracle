-- Migration 1: Add missing UNIQUE constraints for upsert + onConflict to work.
-- Safe to run multiple times (skips if already exists).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'market_events_asset_event_dir_key'
  ) THEN
    ALTER TABLE public.market_events
      ADD CONSTRAINT market_events_asset_event_dir_key
      UNIQUE (asset_code, event_date, direction);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'news_sources_org_author_key'
  ) THEN
    ALTER TABLE public.news_sources
      ADD CONSTRAINT news_sources_org_author_key
      UNIQUE (organization, author_name);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'analysis_document_links_analysis_doc_key'
  ) THEN
    ALTER TABLE public.analysis_document_links
      ADD CONSTRAINT analysis_document_links_analysis_doc_key
      UNIQUE (analysis_id, document_id);
  END IF;
END $$;
