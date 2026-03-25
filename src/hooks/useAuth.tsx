import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { SubscriptionTier } from '@/lib/tier-limits';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  tier: SubscriptionTier;
  hasUsedTrial: boolean;
  trialEnd: string | null;
  isOnTrial: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  startTrial: (targetTier: SubscriptionTier) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [hasUsedTrial, setHasUsedTrial] = useState(false);
  const [trialEnd, setTrialEnd] = useState<string | null>(null);

  const isOnTrial = trialEnd ? new Date(trialEnd) > new Date() : false;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchProfile(session.user.id), 0);
      } else {
        setTier('free');
        setHasUsedTrial(false);
        setTrialEnd(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('subscription_tier, has_used_trial, trial_end')
      .eq('user_id', userId)
      .single();
    if (data) {
      // Check if trial has expired
      if (data.trial_end && new Date(data.trial_end) < new Date() && data.subscription_tier !== 'free') {
        // Trial expired — revert to free
        await supabase.from('profiles').update({ subscription_tier: 'free' }).eq('user_id', userId);
        setTier('free');
      } else {
        setTier(data.subscription_tier);
      }
      setHasUsedTrial(data.has_used_trial);
      setTrialEnd(data.trial_end);
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id);
  }

  async function startTrial(targetTier: SubscriptionTier): Promise<boolean> {
    if (!user || hasUsedTrial) return false;
    const now = new Date();
    const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks
    const { error } = await supabase.from('profiles').update({
      subscription_tier: targetTier,
      has_used_trial: true,
      trial_start: now.toISOString(),
      trial_end: end.toISOString(),
    }).eq('user_id', user.id);
    if (error) return false;
    await fetchProfile(user.id);
    return true;
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, tier, hasUsedTrial, trialEnd, isOnTrial, signUp, signIn, signOut, startTrial, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
