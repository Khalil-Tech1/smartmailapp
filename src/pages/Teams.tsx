import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TIER_LIMITS } from '@/lib/tier-limits';
import { UsersRound, UserPlus, Loader2, Trash2, Crown, MailIcon, RefreshCw, XCircle } from 'lucide-react';
import TransferOwnership from '@/components/teams/TransferOwnership';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function Teams() {
  const { user, tier } = useAuth();
  const { toast } = useToast();
  const limits = TIER_LIMITS[tier];

  const [team, setTeam] = useState<{ id: string; name: string; owner_id: string } | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);

  // Create team state
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) loadTeam();
  }, [user]);

  async function loadTeam() {
    if (!user) return;
    setLoading(true);
    
    // Check if user owns a team
    const { data: ownedTeam } = await supabase
      .from('teams')
      .select('id, name, owner_id')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (ownedTeam) {
      setTeam(ownedTeam);
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', ownedTeam.id);
      setMembers(teamMembers || []);
      const { data: pendingInvites } = await supabase
        .from('team_invites')
        .select('*')
        .eq('team_id', ownedTeam.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setInvites(pendingInvites || []);
    } else {
      // Check if user is a member of a team
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (membership) {
        const { data: memberTeam } = await supabase
          .from('teams')
          .select('id, name, owner_id')
          .eq('id', membership.team_id)
          .maybeSingle();
        if (memberTeam) {
          setTeam(memberTeam);
          const { data: teamMembers } = await supabase
            .from('team_members')
            .select('*')
            .eq('team_id', memberTeam.id);
          setMembers(teamMembers || []);
          setInvites([]);
        }
      }
    }
    setLoading(false);
  }

  function roleBlurb(role: string) {
    if (role === 'admin') return 'manage mail groups, campaigns, and send emails on their behalf';
    if (role === 'editor') return 'create and edit mail groups and campaigns (but not send)';
    return 'view mail groups, campaigns, and analytics';
  }

  async function sendInviteEmail(email: string, role: string, token: string, teamName: string) {
    const inviterName = user?.user_metadata?.full_name || user?.email || 'A teammate';
    const acceptUrl = `${window.location.origin}/invite?token=${token}`;
    const subject = `You have been invited to join ${inviterName}'s SmartMail account`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color:#111;">
        <h2 style="margin:0 0 12px 0;">You've been invited to join ${inviterName}'s SmartMail account</h2>
        <p>Hi there,</p>
        <p>${inviterName} has invited you to join their SmartMail account as a <strong style="text-transform:capitalize;">${role}</strong>.</p>
        <p>As a ${role}, you will be able to ${roleBlurb(role)}.</p>
        <p style="margin: 24px 0;">
          <a href="${acceptUrl}" style="background:#3B82F6;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Accept invitation</a>
        </p>
        <p style="color:#666;font-size:13px;">This invitation expires in 48 hours.</p>
        <p style="color:#666;font-size:12px;">If you did not expect this invitation, you can safely ignore this email.</p>
        <p style="color:#666;font-size:12px;">— The SmartMail Team</p>
      </div>`;

    const { data: sendData, error: sendErr } = await supabase.functions.invoke('send-group-email', {
      body: { recipients: [email], subject, body: html },
    });
    if (sendErr) throw sendErr;
    if (sendData?.status === 'failed') {
      throw new Error(sendData?.errors?.[0] || 'Email failed to send');
    }
  }

  async function createTeam() {
    if (!user || !teamName.trim()) return;
    setCreating(true);
    try {
      const { error } = await supabase.from('teams').insert({
        name: teamName.trim(),
        owner_id: user.id,
      });
      if (error) throw error;
      toast({ title: 'Team created!' });
      setTeamName('');
      loadTeam();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  async function inviteMember() {
    if (!user || !team || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const maxMembers = limits.maxTeamMembers || 0;
      if (members.length >= maxMembers) {
        toast({ title: 'Team limit reached', description: `Your plan allows up to ${maxMembers} team members.`, variant: 'destructive' });
        return;
      }
      const email = inviteEmail.trim().toLowerCase();
      const { error } = await supabase.from('team_invites').insert({
        team_id: team.id,
        email,
        role: inviteRole as any,
        invited_by: user.id,
      });
      if (error) throw error;

      const inviterName = user.user_metadata?.full_name || user.email || 'A teammate';
      const acceptUrl = `${window.location.origin}/auth?invite_email=${encodeURIComponent(email)}&team=${encodeURIComponent(team.name)}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color:#111;">You've been invited to join ${team.name}</h2>
          <p>${inviterName} invited you to join their team on SmartMail as <strong>${inviteRole}</strong>.</p>
          <p style="margin: 24px 0;">
            <a href="${acceptUrl}" style="background:#3B82F6;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">Accept invitation</a>
          </p>
          <p style="color:#666;font-size:12px;">If you weren't expecting this, you can ignore this email.</p>
        </div>`;

      const { data: sendData, error: sendErr } = await supabase.functions.invoke('send-group-email', {
        body: {
          recipients: [email],
          subject: `${inviterName} invited you to join ${team.name} on SmartMail`,
          body: html,
        },
      });
      if (sendErr) throw sendErr;
      if (sendData?.status === 'failed') {
        throw new Error(sendData?.errors?.[0] || 'Email failed to send');
      }

      toast({
        title: 'Invite sent!',
        description: `Email dispatched to ${email}. Note: until you verify a sender domain in Resend, delivery only works to your own Resend account email.`,
      });
      setInviteEmail('');
      setInviteOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(memberId: string) {
    try {
      const { error } = await supabase.from('team_members').delete().eq('id', memberId);
      if (error) throw error;
      toast({ title: 'Member removed' });
      loadTeam();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  const isOwner = team && user && team.owner_id === user.id;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">Teams</h1>
        <p className="text-muted-foreground mt-1">
          Manage your team members. Your plan supports up to {limits.maxTeamMembers} members.
        </p>
      </div>

      {!team ? (
        <Card className="max-w-lg border-border/50">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <UsersRound className="w-5 h-5" /> Create a Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input placeholder="My Team" value={teamName} onChange={e => setTeamName(e.target.value)} />
            </div>
            <Button variant="gradient" onClick={createTeam} disabled={creating || !teamName.trim()}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display flex items-center gap-2">
                <UsersRound className="w-5 h-5" /> {team.name}
              </CardTitle>
              <div className="flex gap-2">
                {isOwner && (
                  <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                    <DialogTrigger asChild>
                      <Button variant="gradient" size="sm" className="gap-1.5">
                        <UserPlus className="w-3.5 h-3.5" /> Invite Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="font-display">Invite Team Member</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input placeholder="member@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Role</Label>
                          <Select value={inviteRole} onValueChange={setInviteRole}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewer">Viewer</SelectItem>
                              <SelectItem value="editor">Editor</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button variant="gradient" onClick={inviteMember} disabled={inviting || !inviteEmail.trim()} className="w-full">
                          {inviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Send Invite
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                {tier === 'business' && isOwner && (
                  <TransferOwnership
                    teamId={team.id}
                    currentOwnerId={team.owner_id}
                    members={members}
                    onTransferred={loadTeam}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Owner */}
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                    <Crown className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user?.email}</p>
                    <Badge variant="outline" className="text-xs">Owner</Badge>
                  </div>
                </div>
              </div>

              {/* Members */}
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No team members yet. Invite someone to get started.</p>
              ) : (
                members.map(member => (
                  <div key={member.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-bold">
                        {member.user_id?.slice(0, 2)?.toUpperCase() || '??'}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{member.email || member.user_id.slice(0, 8)}</p>
                        <Badge variant="secondary" className="text-xs capitalize">{member.role}</Badge>
                      </div>
                    </div>
                    {isOwner && (
                      <ConfirmDialog
                        title="Remove team member?"
                        description={`${member.email || 'This member'} will lose access to the team.`}
                        confirmLabel="Remove"
                        onConfirm={() => removeMember(member.id)}
                        trigger={
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        }
                      />
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
