import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { SubscriptionTier } from '@/lib/tier-limits';

export type ActiveTeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface AvailableTeam {
  id: string; // team id, or 'personal'
  teamId: string | null; // null for personal
  ownerId: string; // owner's user_id (== current user when personal)
  ownerName: string;
  name: string; // label shown in switcher
  role: ActiveTeamRole;
}

interface ActiveTeamContextType {
  loading: boolean;
  availableTeams: AvailableTeam[];
  activeTeam: AvailableTeam;
  setActiveTeamId: (id: string) => void;
  refresh: () => Promise<void>;
  /** Owner's current subscription tier for the active team (null while loading, or for personal context). */
  ownerTier: SubscriptionTier | null;
  ownerTrialEnd: string | null;
  isOwnerOnTrial: boolean;
}

const ActiveTeamContext = createContext<ActiveTeamContextType | undefined>(undefined);
const STORAGE_KEY = 'smartmail.activeTeam';

function personalTeam(userId: string, _email?: string | null): AvailableTeam {
  return {
    id: 'personal',
    teamId: null,
    ownerId: userId,
    ownerName: 'My Account',
    name: 'My Account',
    role: 'owner',
  };
}

function normalizeTier(raw: string | null | undefined, trialEnd: string | null | undefined): SubscriptionTier {
  const t = (raw === 'enterprise' ? 'business' : raw || 'free') as SubscriptionTier;
  if (trialEnd && new Date(trialEnd) < new Date() && t !== 'free') return 'free';
  return t;
}

export function ActiveTeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [availableTeams, setAvailableTeams] = useState<AvailableTeam[]>([]);
  const [activeId, setActiveIdState] = useState<string>('personal');
  const [loading, setLoading] = useState(true);
  const [ownerTier, setOwnerTier] = useState<SubscriptionTier | null>(null);
  const [ownerTrialEnd, setOwnerTrialEnd] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setAvailableTeams([]);
      setActiveIdState('personal');
      setLoading(false);
      return;
    }
    setLoading(true);
    const options: AvailableTeam[] = [personalTeam(user.id, user.email)];

    // Teams the user is a member of (not owned)
    const { data: memberships } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', user.id);

    if (memberships && memberships.length > 0) {
      const teamIds = memberships.map((m: any) => m.team_id);
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, owner_id')
        .in('id', teamIds);
      if (teams) {
        // Look up owner names via profiles
        const ownerIds = Array.from(new Set(teams.map((t: any) => t.owner_id)));
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', ownerIds);
        const nameByOwner: Record<string, string> = {};
        (profs || []).forEach((p: any) => {
          nameByOwner[p.user_id] = p.full_name || 'Owner';
        });
        teams.forEach((t: any) => {
          const m = memberships.find((mm: any) => mm.team_id === t.id);
          const ownerName = nameByOwner[t.owner_id] || 'Owner';
          options.push({
            id: t.id,
            teamId: t.id,
            ownerId: t.owner_id,
            ownerName,
            name: `${ownerName}'s Account`,
            role: (m?.role as ActiveTeamRole) || 'viewer',
          });
        });
      }
    }

    setAvailableTeams(options);

    // Resolve active id: URL ?team=, then localStorage, else personal
    const params = new URLSearchParams(window.location.search);
    const urlTeam = params.get('team');
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    const wanted = urlTeam || stored || 'personal';
    const exists = options.some((o) => o.id === wanted);
    setActiveIdState(exists ? wanted : 'personal');
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const setActiveTeamId = useCallback((id: string) => {
    setActiveIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }, []);

  const activeTeam =
    availableTeams.find((t) => t.id === activeId) || personalTeam(user?.id || '', user?.email);

  // Fetch the owner's tier for the active (non-personal) team. Refresh when
  // active team changes or the window regains focus so downgrades propagate.
  const fetchOwnerTier = useCallback(async () => {
    if (activeTeam.role === 'owner' || !activeTeam.ownerId) {
      setOwnerTier(null);
      setOwnerTrialEnd(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('subscription_tier, trial_end')
      .eq('user_id', activeTeam.ownerId)
      .maybeSingle();
    setOwnerTier(normalizeTier(data?.subscription_tier as any, data?.trial_end as any));
    setOwnerTrialEnd((data?.trial_end as any) ?? null);
  }, [activeTeam.role, activeTeam.ownerId]);

  useEffect(() => {
    fetchOwnerTier();
  }, [fetchOwnerTier]);

  useEffect(() => {
    const onFocus = () => {
      fetchOwnerTier();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchOwnerTier]);

  const isOwnerOnTrial = ownerTrialEnd ? new Date(ownerTrialEnd) > new Date() : false;

  return (
    <ActiveTeamContext.Provider
      value={{
        loading,
        availableTeams,
        activeTeam,
        setActiveTeamId,
        refresh: load,
        ownerTier,
        ownerTrialEnd,
        isOwnerOnTrial,
      }}
    >
      {children}
    </ActiveTeamContext.Provider>
  );
}

export function useActiveTeam() {
  const ctx = useContext(ActiveTeamContext);
  if (!ctx) throw new Error('useActiveTeam must be used within ActiveTeamProvider');
  return ctx;
}
