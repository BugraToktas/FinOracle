-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Fix Ambiguous ID in Admin RPC
-- Date: 2026-06-07
-- ═══════════════════════════════════════════════════════════════════════════

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
  -- Sadece yöneticiler çağırabilir (Ambiguous 'id' hatası düzeltildi: p2.id kullanıldı)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE p2.id = auth.uid() AND p2.is_admin = true
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
