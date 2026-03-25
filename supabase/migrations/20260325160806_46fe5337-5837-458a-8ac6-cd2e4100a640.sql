ALTER TABLE public.profiles 
ADD COLUMN trial_start timestamp with time zone DEFAULT NULL,
ADD COLUMN trial_end timestamp with time zone DEFAULT NULL,
ADD COLUMN has_used_trial boolean NOT NULL DEFAULT false;