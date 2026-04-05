-- ── Backfill profiles for existing users ────────────────────────────────────
-- Runs safely multiple times (ON CONFLICT DO NOTHING).
-- Needed for users who signed in before the profiles table was created,
-- including Google OAuth users whose email may live in raw_user_meta_data.

INSERT INTO public.profiles (id, email, display_name)
SELECT
  u.id,
  COALESCE(u.email, u.raw_user_meta_data->>'email'),
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(COALESCE(u.email, u.raw_user_meta_data->>'email', ''), '@', 1)
  )
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ── Fix trigger to also handle Google OAuth (email in raw_user_meta_data) ───

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''), '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
