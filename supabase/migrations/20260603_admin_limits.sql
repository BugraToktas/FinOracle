-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Yönetici Kontrolleri ve Dinamik Limitler
-- Tarih: 2026-06-03
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. profiles tablosuna daily_limit kolonu ekle
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_limit integer NOT NULL DEFAULT 10;

-- 2. admin_get_users fonksiyonunu daily_limit içerecek şekilde güncelle
DROP FUNCTION IF EXISTS public.admin_get_users();
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
  id            uuid,
  email         text,
  display_name  text,
  is_admin      boolean,
  daily_limit   integer,
  created_at    timestamptz,
  analysis_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Sadece yöneticiler çağırabilir
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
    SELECT
      p.id,
      p.email,
      p.display_name,
      p.is_admin,
      p.daily_limit,
      p.created_at,
      COUNT(ar.id)::bigint AS analysis_count
    FROM public.profiles p
    LEFT JOIN public.analysis_results ar ON ar.user_id = p.id
    GROUP BY p.id, p.email, p.display_name, p.is_admin, p.daily_limit, p.created_at
    ORDER BY p.created_at DESC;
END;
$$;

-- 3. admin_update_user RPC fonksiyonu
CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_user_id uuid,
  p_is_admin boolean,
  p_daily_limit integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Sadece yöneticiler çağırabilir
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  -- Kendi yöneticiliğinizi kaldıramazsınız (sistem kilitlenmesini önlemek için)
  IF p_user_id = auth.uid() AND p_is_admin = false THEN
    RAISE EXCEPTION 'Cannot remove admin role from yourself';
  END IF;

  -- Limit sıfırdan küçük olamaz
  IF p_daily_limit < 0 THEN
    RAISE EXCEPTION 'Daily limit cannot be negative';
  END IF;

  UPDATE public.profiles
  SET is_admin = p_is_admin,
      daily_limit = p_daily_limit,
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- 4. admin_delete_user RPC fonksiyonu
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Sadece yöneticiler çağırabilir
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  -- Kendinizi silemezsiniz
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;

  -- auth.users tablosundan siler (CASCADE sayesinde public.profiles ve diğerleri silinir)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;
