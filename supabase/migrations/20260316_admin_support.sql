-- ── Admin support ────────────────────────────────────────────────────────────

-- 1. Add is_admin flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- 2. RLS: admins can read ALL profiles (normal users can only read their own)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_admin_select_all'
  ) THEN
    CREATE POLICY "profiles_admin_select_all"
      ON public.profiles
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true
        )
      );
  END IF;
END $$;

-- 3. RPC: admin gets all user profiles + their analysis count
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
  id            uuid,
  email         text,
  display_name  text,
  is_admin      boolean,
  created_at    timestamptz,
  analysis_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Only admins may call this function
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
      p.created_at,
      COUNT(ar.id)::bigint AS analysis_count
    FROM public.profiles p
    LEFT JOIN public.analysis_results ar ON ar.user_id = p.id
    GROUP BY p.id, p.email, p.display_name, p.is_admin, p.created_at
    ORDER BY p.created_at DESC;
END;
$$;

-- 4. RPC: admin gets pending queue count + last run info
CREATE OR REPLACE FUNCTION public.admin_queue_stats()
RETURNS TABLE (
  pending_count   bigint,
  verified_today  bigint,
  failed_total    bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending')                                    AS pending_count,
    COUNT(*) FILTER (WHERE status = 'verified'
                       AND created_at >= date_trunc('day', now()))                AS verified_today,
    COUNT(*) FILTER (WHERE status = 'failed')                                     AS failed_total
  FROM public.analysis_results;
$$;
