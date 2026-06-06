-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Güvenlik Düzeltmeleri — 2026-06-07
-- İdempotent — OR REPLACE / IF EXISTS / IF NOT EXISTS kullanılıyor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Fix 1: analysis_results — anon public read kaldır, owner-only yap ─────────
-- Önceki politika: TO anon, authenticated USING (true) → Herkes okuyabiliyordu
-- Yeni politika: Sadece kendi analizini gör (authenticated) VEYA admin görsün

DROP POLICY IF EXISTS "public_read_analysis_results" ON public.analysis_results;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'analysis_results'
      AND policyname = 'analysis_results_select_own'
  ) THEN
    CREATE POLICY "analysis_results_select_own"
      ON public.analysis_results FOR SELECT
      TO authenticated
      USING (user_id = auth.uid() OR user_id IS NULL OR public.is_admin());
  END IF;
END $$;

-- ── Fix 2: source_documents — INSERT sadece service_role ──────────────────────
-- Önceki: WITH CHECK (true) → authenticated herkes yazabiliyordu
-- Yeni: service_role bypass eder, authenticated kullanıcılar yazamaz

DROP POLICY IF EXISTS "source_documents_insert_service" ON public.source_documents;

-- Not: RLS enabled + authenticated için policy yok = authenticated yazamaz
-- service_role her zaman bypass eder, ek policy gerekmez.
-- Güvenlik derinliği için explicit deny policy:
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'source_documents'
      AND policyname = 'source_documents_insert_service_only'
  ) THEN
    CREATE POLICY "source_documents_insert_service_only"
      ON public.source_documents FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- ── Fix 3: source_documents — UPDATE sadece service_role ──────────────────────
-- Önceki: USING (true) WITH CHECK (true) → herkes update edebiliyordu

DROP POLICY IF EXISTS "source_documents_update_service" ON public.source_documents;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'source_documents'
      AND policyname = 'source_documents_update_service_only'
  ) THEN
    CREATE POLICY "source_documents_update_service_only"
      ON public.source_documents FOR UPDATE
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ── Fix 4: analysis_document_links — INSERT sadece service_role ───────────────

DROP POLICY IF EXISTS "analysis_document_links_insert" ON public.analysis_document_links;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'analysis_document_links'
      AND policyname = 'analysis_document_links_insert_service_only'
  ) THEN
    CREATE POLICY "analysis_document_links_insert_service_only"
      ON public.analysis_document_links FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- ── Fix 5: news_sources — INSERT sadece service_role ──────────────────────────
-- Önceki: WITH CHECK (true) → sahte haber kaynağı oluşturulabilirdi

DROP POLICY IF EXISTS "news_sources_insert" ON public.news_sources;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'news_sources'
      AND policyname = 'news_sources_insert_service_only'
  ) THEN
    CREATE POLICY "news_sources_insert_service_only"
      ON public.news_sources FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- ── Fix 6: news_sources — UPDATE sadece service_role ─────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'news_sources'
      AND policyname = 'news_sources_update_service_only'
  ) THEN
    CREATE POLICY "news_sources_update_service_only"
      ON public.news_sources FOR UPDATE
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ── Fix 7: analysis_source_links — INSERT sadece service_role ────────────────

DROP POLICY IF EXISTS "analysis_source_links_insert" ON public.analysis_source_links;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'analysis_source_links'
      AND policyname = 'analysis_source_links_insert_service_only'
  ) THEN
    CREATE POLICY "analysis_source_links_insert_service_only"
      ON public.analysis_source_links FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- ── Fix 8: market_events — DELETE sadece sahibi silebilir ────────────────────
-- Mevcut DELETE policy eksikti

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'market_events'
      AND policyname = 'market_events_delete_owner'
  ) THEN
    CREATE POLICY "market_events_delete_owner"
      ON public.market_events FOR DELETE
      TO authenticated
      USING (
        -- Olayı bağlantılı analizi olan kullanıcı silebilir
        id IN (
          SELECT DISTINCT event_id
          FROM public.analysis_results
          WHERE user_id = auth.uid()
        )
        OR public.is_admin()
      );
  END IF;
END $$;

-- ── Fix 9: getTodayAnalysisCount fallback için get_today_analysis_count düzelt
-- Mevcut fonksiyon doğru (user_id = auth.uid() kullanıyor), yorum ekliyoruz
-- Fallback kodu frontend'de düzeltilecek (user_id filtresi eklenecek)

-- ── Özet değişiklikler ───────────────────────────────────────────────────────
-- 1. analysis_results: anon read kaldırıldı → authenticated + owner only
-- 2. source_documents: INSERT/UPDATE → service_role only
-- 3. analysis_document_links: INSERT → service_role only
-- 4. news_sources: INSERT/UPDATE → service_role only
-- 5. analysis_source_links: INSERT → service_role only
-- 6. market_events: DELETE politikası eklendi (owner/admin)
