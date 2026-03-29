import { useEffect, useState } from 'react';
import { Users, Plus, Trash2, UserPlus, Shield, Eye, Edit3, Crown, Loader2, Mail, Check, X } from 'lucide-react';
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
import { useNavigate } from 'react-router-dom';
import { TIER_LIMITS } from '@/lib/tier-limits';

type TeamRole = 'admin' | 'editor' | 'viewer';

interface TeamMember {
  id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
  email?: string;
}

interface TeamInvite {
  id: string;
  email: string;
  role: TeamRole;
  status: string;
  created_at: string;
}

interface PendingInvite {
  id: string;
  team_id: string;
  email: string;
  role: TeamRole;
  status: string;
  created_at: string;
  teams?: { name: string };
}

const roleIcons: Record<TeamRole, typeof Shield> = {
  admin: Shield,
  editor: Edit3,
  viewer: Eye,
};

const roleColors: Record<TeamRole, string> = {
  admin: 'bg-destructive/10 text-destructive',
  editor: 'bg-primary/10 text-primary',
  viewer: 'bg-muted text-muted-foreground',
};

export default function TeamManagement() {
  const { user, tier } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const limits = TIER_LIMITS[tier];

  const [team, setTeam] = useState<{ id: string; name: string; owner_id: string } | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('viewer');
  const [inviting, setInviting] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);

  const canManageTeam = tier === 'basic' || tier === 'pro' || tier === 'business';

  useEffect(() => {
    if (user && canManageTeam) {
      loadTeam();
      loadPendingInvites();
    } else {
      setLoading(false);
    }
  }, [user, tier]);

  async function loadTeam() {
    if (!user) return;
    setLoading(true);

    // Find team owned by user
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .eq('owner_id', user.id)
      .limit(1);

    if (teams && teams.length > 0) {
      setTeam(teams[0]);
      await loadMembers(teams[0].id);
      await loadInvites(teams[0].id);
    }
    setLoading(false);
  }

  async function loadMembers(teamId: string) {
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true });

    if (data) {
      // Fetch emails from profiles
      const userIds = data.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const membersWithEmail = data.map(m => ({
        ...m,
        role: m.role as TeamRole,
        email: profiles?.find(p => p.user_id === m.user_id)?.full_name || m.user_id.slice(0, 8),
      }));
      setMembers(membersWithEmail);
    }
  }

  async function loadInvites(teamId: string) {
    const { data } = await supabase
      .from('team_invites')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (data) {
      setInvites(data.map(i => ({ ...i, role: i.role as TeamRole })));
    }
  }

  async function loadPendingInvites() {
    if (!user?.email) return;
    const { data } = await supabase
      .from('team_invites')
      .select('*, teams(name)')
      .eq('email', user.email)
      .eq('status', 'pending');

    if (data) {
      setPendingInvites(data.map(i => ({ ...i, role: i.role as TeamRole })) as PendingInvite[]);
    }
  }

  async function createTeam() {
    if (!user || !teamName.trim()) return;
    setCreatingTeam(true);
    const { data, error } = await supabase
      .from('teams')
      .insert({ name: teamName.trim(), owner_id: user.id })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else if (data) {
      setTeam(data);
      toast({ title: 'Team created!' });
    }
    setCreatingTeam(false);
  }

  async function sendInvite() {
    if (!user || !team || !inviteEmail.trim()) return;

    const maxMembers = limits.maxTeamMembers;
    if (maxMembers !== null && members.length >= maxMembers) {
      toast({ title: 'Team limit reached', description: `Your plan supports up to ${maxMembers} team members.`, variant: 'destructive' });
      return;
    }

    setInviting(true);
    const { error } = await supabase
      .from('team_invites')
      .insert({
        team_id: team.id,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        invited_by: user.id,
      });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Invite sent!', description: `Invited ${inviteEmail} as ${inviteRole}` });
      setInviteEmail('');
      setShowInvite(false);
      await loadInvites(team.id);
    }
    setInviting(false);
  }

  async function cancelInvite(inviteId: string) {
    const { error } = await supabase
      .from('team_invites')
      .delete()
      .eq('id', inviteId);

    if (!error && team) {
      toast({ title: 'Invite cancelled' });
      await loadInvites(team.id);
    }
  }

  async function acceptInvite(invite: PendingInvite) {
    if (!user) return;
    // Add as team member
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({ team_id: invite.team_id, user_id: user.id, role: invite.role });

    if (memberError) {
      toast({ title: 'Error', description: memberError.message, variant: 'destructive' });
      return;
    }

    // Update invite status
    await supabase
      .from('team_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id);

    toast({ title: 'Invite accepted!', description: `You joined ${invite.teams?.name || 'the team'}` });
    await loadPendingInvites();
    await loadTeam();
  }

  async function declineInvite(inviteId: string) {
    await supabase
      .from('team_invites')
      .update({ status: 'declined' })
      .eq('id', inviteId);

    toast({ title: 'Invite declined' });
    await loadPendingInvites();
  }

  async function updateMemberRole(memberId: string, newRole: TeamRole) {
    const { error } = await supabase
      .from('team_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else if (team) {
      toast({ title: 'Role updated' });
      await loadMembers(team.id);
    }
  }

  async function removeMember(memberId: string) {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else if (team) {
      toast({ title: 'Member removed' });
      await loadMembers(team.id);
    }
  }

  if (!canManageTeam) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="bg-muted/50 rounded-full p-6 mb-4">
          <Users className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-display font-bold mb-2">Basic Plan Required</h2>
        <p className="text-muted-foreground text-sm text-center max-w-md mb-6">
          Upgrade to Basic for $9/month to unlock team members and collaboration.
        </p>
        <Button variant="gradient" onClick={() => navigate('/dashboard/billing')}>
          Upgrade to Basic
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">Team Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage your team members and their permissions.
          {limits.maxTeamMembers !== null && (
            <span className="ml-2 text-xs">
              ({members.length}/{limits.maxTeamMembers} members)
            </span>
          )}
        </p>
      </div>

      {/* Pending invites for current user */}
      {pendingInvites.length > 0 && (
        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Mail className="w-4 h-4" /> Pending Invitations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvites.map(invite => (
              <div key={invite.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm font-medium">
                    Invited to join <strong>{invite.teams?.name || 'a team'}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">Role: {invite.role}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="gradient" onClick={() => acceptInvite(invite)}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => declineInvite(invite.id)}>
                    <X className="w-3.5 h-3.5 mr-1" /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Create team if none exists */}
      {!team && (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="font-display">Create Your Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input
                placeholder="My Team"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
              />
            </div>
            <Button variant="gradient" onClick={createTeam} disabled={creatingTeam || !teamName.trim()}>
              {creatingTeam ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Team
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Team dashboard */}
      {team && (
        <div className="space-y-6">
          {/* Team info */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-display flex items-center gap-2">
                  <Crown className="w-5 h-5 text-primary" />
                  {team.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  You are the owner of this team
                </p>
              </div>
              <Dialog open={showInvite} onOpenChange={setShowInvite}>
                <DialogTrigger asChild>
                  <Button variant="gradient" className="gap-2">
                    <UserPlus className="w-4 h-4" /> Invite Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-display">Invite Team Member</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Email Address</Label>
                      <Input
                        type="email"
                        placeholder="colleague@company.com"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={inviteRole} onValueChange={v => setInviteRole(v as TeamRole)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin — Full access, can manage team</SelectItem>
                          <SelectItem value="editor">Editor — Can send emails, manage groups</SelectItem>
                          <SelectItem value="viewer">Viewer — Read-only access</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-3 justify-end">
                      <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
                      <Button variant="gradient" onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}>
                        {inviting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                        Send Invite
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
          </Card>

          {/* Role permissions legend */}
          <div className="grid grid-cols-3 gap-4">
            {(['admin', 'editor', 'viewer'] as TeamRole[]).map(role => {
              const Icon = roleIcons[role];
              return (
                <Card key={role} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 text-primary" />
                      <span className="font-display font-semibold capitalize">{role}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {role === 'admin' && 'Full access. Manage team, send emails, edit groups, view analytics.'}
                      {role === 'editor' && 'Can send emails, manage groups, and view campaigns.'}
                      {role === 'viewer' && 'Read-only. Can view groups, sent emails, and analytics.'}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Members list */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">
                Team Members ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No members yet. Invite someone to get started!
                </p>
              ) : (
                <div className="space-y-3">
                  {members.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                          {member.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{member.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Joined {new Date(member.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={member.role}
                          onValueChange={v => updateMemberRole(member.id, v as TeamRole)}
                        >
                          <SelectTrigger className="w-28 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeMember(member.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending invites */}
          {invites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base">
                  Pending Invites ({invites.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invites.map(invite => (
                    <div key={invite.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{invite.email}</p>
                          <Badge className={`text-xs ${roleColors[invite.role]}`}>
                            {invite.role}
                          </Badge>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => cancelInvite(invite.id)}>
                        <X className="w-4 h-4" /> Cancel
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
