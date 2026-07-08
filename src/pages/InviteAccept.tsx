import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useActiveTeam } from '@/hooks/useActiveTeam';

type InviteRow = {
  id: string;
  team_id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  status: string;
  expires_at: string | null;
  token: string;
};

const roleBlurb: Record<string, string> = {
  admin: 'manage mail groups, campaigns, and send emails on their behalf',
  editor: 'create and edit mail groups and campaigns (but not send)',
  viewer: 'view mail groups, campaigns, and analytics',
};

export default function InviteAccept() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { refresh, setActiveTeamId } = useActiveTeam();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteRow | null>(null);
  const [teamName, setTeamName] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      if (!token) {
        setError('This invitation link is invalid or has already been used.');
        setLoading(false);
        return;
      }

      // If not signed in, we can still show a friendly prompt. But to load invite
      // details we need RLS access. If signed out, show a signup/login prompt.
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error: fetchErr } = await supabase
        .from('team_invites')
        .select('id, team_id, email, role, status, expires_at, token')
        .eq('token', token)
        .maybeSingle();

      if (fetchErr || !data) {
        // Some valid invites may not be readable directly because invite rows are
        // protected by account-level access rules. The acceptance RPC is the
        // source of truth and validates the token, expiry, and email securely.
        await acceptByToken(token);
        return;
      }

      const row = data as InviteRow;
      setInvite(row);

      if (row.status === 'cancelled') {
        setError('This invitation link is invalid or has already been used.');
      } else if (row.status === 'accepted') {
        await acceptByToken(row.token, row.email);
        return;
      } else if (row.expires_at && new Date(row.expires_at) < new Date()) {
        setError('This invitation has expired. Please ask the account owner to send a new invitation.');
      }

      // Load team + owner display
      const { data: team } = await supabase
        .from('teams')
        .select('id, name, owner_id')
        .eq('id', row.team_id)
        .maybeSingle();
      if (team) {
        setTeamName(team.name);
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', team.owner_id)
          .maybeSingle();
        setOwnerName(prof?.full_name || team.name);
      }

      if (row.status === 'pending') {
        const emailMatches =
          !!user.email && user.email.toLowerCase() === row.email.toLowerCase();
        if (emailMatches && !(row.expires_at && new Date(row.expires_at) < new Date())) {
          await acceptByToken(row.token, row.email);
          return;
        }
      }

      setLoading(false);
    })();
  }, [token, user, authLoading]);

  function inviteErrorMessage(message: string, email?: string) {
    const map: Record<string, string> = {
      invite_not_found: 'This invitation link is invalid or has already been used.',
      invite_cancelled: 'This invitation link is invalid or has already been used.',
      invite_expired: 'This invitation has expired. Please ask the account owner to send a new invitation.',
      invite_email_mismatch: email
        ? `This invite was sent to ${email}. Please sign in with that email.`
        : 'This invite was sent to a different email address. Please sign in with the invited email.',
      not_authenticated: 'Please sign in to accept this invitation.',
    };
    return map[message] || message || 'Could not accept invitation.';
  }

  async function acceptByToken(tokenToAccept: string, invitedEmail?: string) {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('accept_team_invite', { _token: tokenToAccept });
      if (error) throw error;
      const teamId = (data as any[])?.[0]?.team_id as string | undefined;
      toast({
        title: 'Invitation accepted',
        description: `Welcome! You now have access to ${ownerName || 'the'} SmartMail account.`,
      });
      await refresh();
      if (teamId) setActiveTeamId(teamId);
      navigate(`/dashboard${teamId ? `?team=${teamId}` : ''}`, { replace: true });
    } catch (err: any) {
      const msg = inviteErrorMessage(err.message, invitedEmail || invite?.email);
      setError(msg);
      setLoading(false);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    if (!invite) return;
    await acceptByToken(invite.token, invite.email);
  }

  async function decline() {
    if (!invite) return;
    setBusy(true);
    try {
      await supabase.from('team_invites').update({ status: 'cancelled' }).eq('id', invite.id);
      navigate('/', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  // Signed out: show sign in / sign up card
  if (!user) {
    const nextUrl = `/invite?token=${encodeURIComponent(token)}`;
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md border-border/50">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Mail className="w-5 h-5" /> You're invited to SmartMail
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To accept your invitation, sign up or sign in with the email address it was sent to.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate(`/auth?next=${encodeURIComponent(nextUrl)}`)}
              >
                Sign in
              </Button>
              <Button
                variant="gradient"
                className="flex-1"
                onClick={() => navigate(`/auth?mode=signup&next=${encodeURIComponent(nextUrl)}`)}
              >
                Sign up
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md border-border/50">
          <CardHeader>
            <CardTitle className="font-display">Invitation unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Go to dashboard
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!invite) return null;

  const emailMismatch =
    !!user.email && user.email.toLowerCase() !== invite.email.toLowerCase();

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md border-border/50">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Mail className="w-5 h-5" /> You're invited
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-sm">
              <strong>{ownerName || 'Someone'}</strong> invited you to join their SmartMail account as a{' '}
              <strong className="capitalize">{invite.role}</strong>.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              As a {invite.role}, you'll be able to {roleBlurb[invite.role]}.
            </p>
          </div>

          {emailMismatch ? (
            <div className="text-sm bg-destructive/10 text-destructive rounded-lg p-3">
              This invite was sent to <strong>{invite.email}</strong>. You are signed in as{' '}
              <strong>{user.email}</strong>.
              <Button
                variant="link"
                className="p-0 h-auto ml-1 text-destructive"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.reload();
                }}
              >
                Sign out
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" disabled={busy} onClick={decline}>
                Decline
              </Button>
              <Button variant="gradient" className="flex-1" disabled={busy} onClick={accept}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Accept invitation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
