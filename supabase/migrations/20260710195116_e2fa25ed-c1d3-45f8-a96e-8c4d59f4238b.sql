ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_paused_tier text,
  ADD COLUMN IF NOT EXISTS trial_paused_remaining_seconds bigint;