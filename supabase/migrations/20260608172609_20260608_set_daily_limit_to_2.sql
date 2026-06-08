-- 1. Change the default limit for new profiles to 2
ALTER TABLE public.profiles
ALTER COLUMN daily_limit SET DEFAULT 2;

-- 2. Update existing profiles to have a daily limit of 2
UPDATE public.profiles
SET daily_limit = 2;
