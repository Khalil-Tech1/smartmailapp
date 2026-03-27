
-- Team roles enum
CREATE TYPE public.team_role AS ENUM ('admin', 'editor', 'viewer');

-- Teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Team members
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role team_role NOT NULL DEFAULT 'viewer',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Team invites
CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  role team_role NOT NULL DEFAULT 'viewer',
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- API keys (enterprise)
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- API usage logs
CREATE TABLE public.api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL DEFAULT 200,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check team ownership
CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams WHERE id = _team_id AND owner_id = _user_id
  )
$$;

-- Security definer function to check team membership
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = _team_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.teams WHERE id = _team_id AND owner_id = _user_id
  )
$$;

-- Security definer function to check team admin
CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = _team_id AND user_id = _user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.teams WHERE id = _team_id AND owner_id = _user_id
  )
$$;

-- Teams RLS
CREATE POLICY "Owners can manage their teams" ON public.teams
FOR ALL TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Team members can view their teams" ON public.teams
FOR SELECT TO authenticated
USING (public.is_team_member(auth.uid(), id));

-- Team members RLS
CREATE POLICY "Team admins/owners can manage members" ON public.team_members
FOR ALL TO authenticated
USING (public.is_team_admin(auth.uid(), team_id))
WITH CHECK (public.is_team_admin(auth.uid(), team_id));

CREATE POLICY "Members can view team members" ON public.team_members
FOR SELECT TO authenticated
USING (public.is_team_member(auth.uid(), team_id));

-- Team invites RLS
CREATE POLICY "Team admins/owners can manage invites" ON public.team_invites
FOR ALL TO authenticated
USING (public.is_team_admin(auth.uid(), team_id))
WITH CHECK (public.is_team_admin(auth.uid(), team_id));

CREATE POLICY "Invited users can view their invites" ON public.team_invites
FOR SELECT TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Invited users can update their invites" ON public.team_invites
FOR UPDATE TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- API keys RLS
CREATE POLICY "Users manage their own API keys" ON public.api_keys
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- API usage logs RLS
CREATE POLICY "Users view their own API usage" ON public.api_usage_logs
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System can insert usage logs" ON public.api_usage_logs
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
