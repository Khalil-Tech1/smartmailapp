
-- 1. Guard trigger blocking client writes to billing columns
CREATE OR REPLACE FUNCTION public.prevent_billing_column_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bypass text := current_setting('app.bypass_billing_guard', true);
  v_role text := current_setting('request.jwt.claims', true)::json->>'role';
BEGIN
  IF v_bypass = 'on' OR v_role = 'service_role' OR v_role IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     OR NEW.has_used_trial IS DISTINCT FROM OLD.has_used_trial
     OR NEW.paypal_subscription_id IS DISTINCT FROM OLD.paypal_subscription_id
     OR NEW.trial_start IS DISTINCT FROM OLD.trial_start
     OR NEW.trial_end IS DISTINCT FROM OLD.trial_end
     OR NEW.trial_paused_tier IS DISTINCT FROM OLD.trial_paused_tier
     OR NEW.trial_paused_remaining_seconds IS DISTINCT FROM OLD.trial_paused_remaining_seconds
  THEN
    RAISE EXCEPTION 'billing_columns_readonly' USING HINT = 'Use start_trial/cancel_trial/resume_trial or server-side billing code.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_billing_updates ON public.profiles;
CREATE TRIGGER profiles_prevent_billing_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_billing_column_updates();

-- 2. Safe trial RPCs

CREATE OR REPLACE FUNCTION public.start_trial(_target_tier text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _target_tier NOT IN ('basic','pro','business') THEN
    RAISE EXCEPTION 'invalid_tier';
  END IF;
  SELECT has_used_trial INTO v_profile FROM public.profiles WHERE user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_missing'; END IF;
  IF v_profile.has_used_trial THEN RAISE EXCEPTION 'trial_already_used'; END IF;

  PERFORM set_config('app.bypass_billing_guard', 'on', true);
  UPDATE public.profiles
     SET subscription_tier = _target_tier,
         has_used_trial = true,
         trial_start = now(),
         trial_end = now() + interval '14 days',
         trial_paused_tier = NULL,
         trial_paused_remaining_seconds = NULL
   WHERE user_id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_trial()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_p RECORD;
  v_remaining bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT subscription_tier, trial_end INTO v_p FROM public.profiles WHERE user_id = v_uid;
  IF NOT FOUND OR v_p.trial_end IS NULL OR v_p.trial_end <= now() THEN
    RAISE EXCEPTION 'no_active_trial';
  END IF;
  v_remaining := GREATEST(0, EXTRACT(EPOCH FROM (v_p.trial_end - now()))::bigint);

  PERFORM set_config('app.bypass_billing_guard', 'on', true);
  UPDATE public.profiles
     SET subscription_tier = 'free',
         trial_end = NULL,
         trial_paused_tier = v_p.subscription_tier,
         trial_paused_remaining_seconds = v_remaining
   WHERE user_id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_trial()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_p RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT trial_paused_tier, trial_paused_remaining_seconds, trial_end
    INTO v_p FROM public.profiles WHERE user_id = v_uid;
  IF NOT FOUND OR v_p.trial_paused_tier IS NULL OR v_p.trial_paused_remaining_seconds IS NULL OR v_p.trial_paused_remaining_seconds <= 0 THEN
    RAISE EXCEPTION 'no_paused_trial';
  END IF;
  IF v_p.trial_end IS NOT NULL AND v_p.trial_end > now() THEN
    RAISE EXCEPTION 'trial_already_active';
  END IF;
  IF v_p.trial_paused_tier NOT IN ('basic','pro','business') THEN
    RAISE EXCEPTION 'invalid_paused_tier';
  END IF;

  PERFORM set_config('app.bypass_billing_guard', 'on', true);
  UPDATE public.profiles
     SET subscription_tier = v_p.trial_paused_tier,
         trial_start = now(),
         trial_end = now() + make_interval(secs => v_p.trial_paused_remaining_seconds),
         trial_paused_tier = NULL,
         trial_paused_remaining_seconds = NULL
   WHERE user_id = v_uid;
END;
$$;

-- Also allow the client-side "trial expired -> revert to free" flow to keep working safely
CREATE OR REPLACE FUNCTION public.expire_trial_if_needed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM set_config('app.bypass_billing_guard', 'on', true);
  UPDATE public.profiles
     SET subscription_tier = 'free'
   WHERE user_id = v_uid
     AND trial_end IS NOT NULL
     AND trial_end < now()
     AND subscription_tier <> 'free';
END;
$$;

-- 3. Lock down function execute grants
REVOKE ALL ON FUNCTION public.prevent_billing_column_updates() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_team_member_of_owner(uuid, text[]) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.start_trial(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_trial() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resume_trial() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expire_trial_if_needed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_trial(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_trial() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_trial() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_trial_if_needed() TO authenticated;
