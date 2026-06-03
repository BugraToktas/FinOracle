-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Prodüksiyon Öncesi DB Düzeltmeleri
-- Tarih: 2026-06-03
-- İdempotent — birden fazla çalıştırmaya güvenli (IF NOT EXISTS / OR REPLACE)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Fix 1: increment_source_reputation — SECURITY DEFINER ekle ─────────────
-- SECURITY DEFINER olmadan fonksiyon çağıran kullanıcının yetkisiyle çalışır.
-- search_path sabitlenmesi SQL injection riskini azaltır.
CREATE OR REPLACE FUNCTION public.increment_source_reputation(
  p_source_id uuid,
  p_is_correct boolean
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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

-- ── Fix 2: source_documents UPDATE RLS politikası ──────────────────────────
-- storeEmbeddingsAsync .update({ embedding }) çağırıyor ama UPDATE policy yok.
-- Service role RLS'i bypass eder ama savunma derinliği için ekliyoruz.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'source_documents'
      AND policyname = 'source_documents_update_service'
  ) THEN
    CREATE POLICY "source_documents_update_service"
      ON public.source_documents FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ── Fix 3: profiles_admin_select_all — çakışan politikayı düzelt ───────────
-- Mevcut: is_admin() OR auth.uid() = id → profiles_select_own ile örtüşüyor.
-- Yeni: sadece is_admin() — geri kalanı profiles_select_own karşılar.
DROP POLICY IF EXISTS "profiles_admin_select_all" ON public.profiles;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_admin_select_all'
  ) THEN
    CREATE POLICY "profiles_admin_select_all"
      ON public.profiles FOR SELECT
      USING (public.is_admin());
  END IF;
END $$;

-- ── Fix 4: match_source_documents — provider column ekle ──────────────────────
-- Semantic search sonuçlarında provider bilgisi eksikti (provider: null).
-- Return type değiştiği için CREATE OR REPLACE yetmiyor — önce DROP gerekli.
DROP FUNCTION IF EXISTS public.match_source_documents(vector(768), float, int);
DROP FUNCTION IF EXISTS public.match_source_documents(vector, double precision, integer);

CREATE FUNCTION public.match_source_documents(
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
  provider        text,
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
    provider,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.source_documents
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
