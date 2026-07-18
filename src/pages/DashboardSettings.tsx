import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, PauseCircle, PlayCircle, Clock } from 'lucide-react';
import TransferOwnership from '@/components/teams/TransferOwnership';
import EmailIdentitySection from '@/components/EmailIdentitySection';
import { TIER_LIMITS, type SubscriptionTier } from '@/lib/tier-limits';

export default function DashboardSettings() {
  const { user, tier, isOnTrial, trialEnd, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [trialBusy, setTrialBusy] = useState(false);
  const [pausedTier, setPausedTier] = useState<SubscriptionTier | null>(null);
  const [pausedRemainingSec, setPausedRemainingSec] = useState<number | null>(null);

  // Team state (Business tier)
  const [team, setTeam] = useState<{ id: string; owner_id: string } | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  useEffect(() => {
    if (user && tier === 'business') loadTeam();
  }, [user, tier]);

  useEffect(() => {
    if (user) loadPausedTrial();
  }, [user, tier, isOnTrial]);

  async function loadPausedTrial() {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('trial_paused_tier, trial_paused_remaining_seconds')
      .eq('user_id', user.id)
      .maybeSingle();
    setPausedTier(((data as any)?.trial_paused_tier as SubscriptionTier) ?? null);
    setPausedRemainingSec(((data as any)?.trial_paused_remaining_seconds as number) ?? null);
  }

  async function loadTeam() {
    if (!user) return;
    const { data: ownedTeam } = await supabase.from('teams').select('id, owner_id').eq('owner_id', user.id).maybeSingle();
    if (ownedTeam) {
      setTeam(ownedTeam);
      const { data: members } = await supabase.from('team_members').select('*').eq('team_id', ownedTeam.id);
      setTeamMembers(members || []);
    }
  }

  async function updateProfile() {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() || null }).eq('user_id', user.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated!' });
    }
  }

  async function cancelTrial() {
    if (!user || !isOnTrial || !trialEnd) return;
    setTrialBusy(true);
    try {
      const remainingMs = new Date(trialEnd).getTime() - Date.now();
      const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));
      const { error } = await supabase.from('profiles').update({
        subscription_tier: 'free',
        trial_end: null,
        trial_paused_tier: tier,
        trial_paused_remaining_seconds: remainingSec,
      } as any).eq('user_id', user.id);
      if (error) throw error;
      toast({ title: 'Trial paused', description: 'You can resume it any time from settings.' });
      await refreshProfile();
      await loadPausedTrial();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setTrialBusy(false);
    }
  }

  async function resumeTrial() {
    if (!user || !pausedTier || pausedRemainingSec == null) return;
    setTrialBusy(true);
    try {
      const now = new Date();
      const end = new Date(now.getTime() + pausedRemainingSec * 1000);
      const { error } = await supabase.from('profiles').update({
        subscription_tier: pausedTier,
        trial_start: now.toISOString(),
        trial_end: end.toISOString(),
        trial_paused_tier: null,
        trial_paused_remaining_seconds: null,
      } as any).eq('user_id', user.id);
      if (error) throw error;
      toast({ title: 'Trial resumed', description: `Welcome back to ${TIER_LIMITS[pausedTier].label}.` });
      await refreshProfile();
      await loadPausedTrial();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setTrialBusy(false);
    }
  }

  function formatRemaining(sec: number): string {
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    if (days > 0) return `${days} day${days === 1 ? '' : 's'}${hours ? ` ${hours}h` : ''}`;
    if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
    const mins = Math.max(1, Math.floor(sec / 60));
    return `${mins} minute${mins === 1 ? '' : 's'}`;
  }

  const canResume = !isOnTrial && pausedTier && pausedRemainingSec != null && pausedRemainingSec > 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings.</p>
      </div>

      <Card className="max-w-lg border-border/50 mb-6">
        <CardHeader>
          <CardTitle className="font-display">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ''} disabled />
          </div>
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input placeholder="Your name" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <Button variant="gradient" onClick={updateProfile}>Save Changes</Button>
        </CardContent>
      </Card>
      <EmailIdentitySection />

      {/* Transfer Ownership - Business tier only */}
      {tier === 'business' && team && (
        <Card className="max-w-lg border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Users className="w-5 h-5" /> Team Ownership
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Transfer ownership of your team to another member. The new owner will have full control over the team.
            </p>
            <TransferOwnership
              teamId={team.id}
              currentOwnerId={team.owner_id}
              members={teamMembers}
              onTransferred={loadTeam}
            />
          </CardContent>
        </Card>
      )}

      {/* Free trial management */}
      {(isOnTrial || canResume) && (
        <Card className="max-w-lg border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Clock className="w-5 h-5" /> Free Trial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isOnTrial && trialEnd && (
              <>
                <p className="text-sm text-muted-foreground">
                  You're on a <strong>{TIER_LIMITS[tier].label}</strong> free trial with{' '}
                  <strong>{formatRemaining(Math.max(0, Math.floor((new Date(trialEnd).getTime() - Date.now()) / 1000)))}</strong>{' '}
                  remaining. Cancel to switch back to Free — you can pick up right where you left off later.
                </p>
                <Button variant="outline" onClick={cancelTrial} disabled={trialBusy} className="gap-2">
                  {trialBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PauseCircle className="w-4 h-4" />}
                  Cancel free trial
                </Button>
              </>
            )}
            {!isOnTrial && canResume && (
              <>
                <p className="text-sm text-muted-foreground">
                  You paused your <strong>{TIER_LIMITS[pausedTier!].label}</strong> trial with{' '}
                  <strong>{formatRemaining(pausedRemainingSec!)}</strong> left. Resume any time to continue where you stopped.
                </p>
                <Button variant="gradient" onClick={resumeTrial} disabled={trialBusy} className="gap-2">
                  {trialBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                  Continue free trial
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
