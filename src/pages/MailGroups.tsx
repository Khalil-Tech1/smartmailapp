import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Trash2, UserPlus, X, Pencil, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TIER_LIMITS } from '@/lib/tier-limits';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type MailGroup = Tables<'mail_groups'>;
type GroupMember = Tables<'group_members'>;

export default function MailGroups() {
  const { user, tier } = useAuth();
  const { toast } = useToast();
  const limits = TIER_LIMITS[tier];
  const [groups, setGroups] = useState<MailGroup[]>([]);
  const [members, setMembers] = useState<Record<string, GroupMember[]>>({});
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);

  // Inline editing state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberName, setEditingMemberName] = useState('');

  useEffect(() => {
    if (user) loadGroups();
  }, [user]);

  async function loadGroups() {
    const { data } = await supabase.from('mail_groups').select('*').order('created_at', { ascending: false });
    if (data) {
      setGroups(data);
      const memberData: Record<string, GroupMember[]> = {};
      for (const group of data) {
        const { data: m } = await supabase.from('group_members').select('*').eq('group_id', group.id);
        memberData[group.id] = m || [];
      }
      setMembers(memberData);
    }
  }

  async function createGroup() {
    if (!user || !newGroupName.trim()) return;
    if (groups.length >= limits.maxGroups) {
      toast({ title: 'Group limit reached', description: `Your ${limits.label} plan allows ${limits.maxGroups} groups. Upgrade for more.`, variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('mail_groups').insert({
      user_id: user.id,
      name: newGroupName.trim(),
      description: newGroupDesc.trim() || null,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Group created!' });
      setNewGroupName('');
      setNewGroupDesc('');
      setShowCreateDialog(false);
      loadGroups();
    }
  }

  async function deleteGroup(id: string) {
    await supabase.from('mail_groups').delete().eq('id', id);
    if (selectedGroup === id) setSelectedGroup(null);
    loadGroups();
  }

  async function renameGroup(id: string) {
    if (!editingGroupName.trim()) return;
    const { error } = await supabase.from('mail_groups').update({ name: editingGroupName.trim() }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Group renamed!' });
      setEditingGroupId(null);
      loadGroups();
    }
  }

  function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function addMember() {
    if (!selectedGroup || !newMemberEmail.trim()) return;
    if (!isValidEmail(newMemberEmail.trim())) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address (e.g. user@gmail.com, user@yahoo.com).', variant: 'destructive' });
      return;
    }
    const groupMembers = members[selectedGroup] || [];
    if (groupMembers.length >= limits.maxMembersPerGroup) {
      toast({ title: 'Member limit reached', description: `Your ${limits.label} plan allows ${limits.maxMembersPerGroup} members per group.`, variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('group_members').insert({
      group_id: selectedGroup,
      email: newMemberEmail.trim(),
      name: newMemberName.trim() || null,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setNewMemberEmail('');
      setNewMemberName('');
      setShowAddMemberDialog(false);
      loadGroups();
    }
  }

  async function removeMember(id: string) {
    await supabase.from('group_members').delete().eq('id', id);
    loadGroups();
  }

  async function renameMember(id: string) {
    if (!editingMemberName.trim()) return;
    const { error } = await supabase.from('group_members').update({ name: editingMemberName.trim() }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Member renamed!' });
      setEditingMemberId(null);
      loadGroups();
    }
  }

  const activeGroup = groups.find(g => g.id === selectedGroup);
  const activeMembers = selectedGroup ? (members[selectedGroup] || []) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display">Mail Groups</h1>
          <p className="text-muted-foreground mt-1">
            {groups.length}/{limits.maxGroups} groups used
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button variant="gradient">
              <Plus className="w-4 h-4 mr-1" /> New Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Create Mail Group</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input placeholder="e.g. Team Alpha" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input placeholder="What's this group for?" value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} />
              </div>
              <Button onClick={createGroup} variant="gradient" className="w-full">Create Group</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Group list */}
        <div className="space-y-3">
          <AnimatePresence>
            {groups.map(group => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card
                  className={`cursor-pointer transition-all border ${
                    selectedGroup === group.id
                      ? 'border-primary shadow-glow'
                      : 'border-border/50 hover:border-primary/30'
                  }`}
                  onClick={() => setSelectedGroup(group.id)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      {editingGroupId === group.id ? (
                        <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                          <Input
                            value={editingGroupName}
                            onChange={e => setEditingGroupName(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') renameGroup(group.id); if (e.key === 'Escape') setEditingGroupId(null); }}
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => renameGroup(group.id)}>
                            <Check className="w-4 h-4 text-success" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditingGroupId(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <p className="font-medium font-display truncate">{group.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(members[group.id] || []).length} members
                          </p>
                        </div>
                      )}
                    </div>
                    {editingGroupId !== group.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); setEditingGroupId(group.id); setEditingGroupName(group.name); }}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); deleteGroup(group.id); }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
          {groups.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No groups yet. Create one to get started!</p>
            </div>
          )}
        </div>

        {/* Member list */}
        <div className="lg:col-span-2">
          {activeGroup ? (
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-display">{activeGroup.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeMembers.length}/{limits.maxMembersPerGroup} members
                  </p>
                </div>
                <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <UserPlus className="w-4 h-4 mr-1" /> Add Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-display">Add Member</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Email Address</Label>
                        <Input type="email" placeholder="member@example.com" value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Name (optional)</Label>
                        <Input placeholder="John Doe" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} />
                      </div>
                      <Button onClick={addMember} variant="gradient" className="w-full">Add Member</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {activeMembers.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No members yet. Add someone!</p>
                ) : (
                  <div className="space-y-2">
                    {activeMembers.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                            {member.email[0].toUpperCase()}
                          </div>
                          {editingMemberId === member.id ? (
                            <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                              <Input
                                value={editingMemberName}
                                onChange={e => setEditingMemberName(e.target.value)}
                                className="h-8 text-sm"
                                placeholder="Member name"
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') renameMember(member.id); if (e.key === 'Escape') setEditingMemberId(null); }}
                              />
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => renameMember(member.id)}>
                                <Check className="w-4 h-4 text-success" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditingMemberId(null)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{member.name || member.email}</p>
                              {member.name && <p className="text-xs text-muted-foreground truncate">{member.email}</p>}
                            </div>
                          )}
                        </div>
                        {editingMemberId !== member.id && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingMemberId(member.id); setEditingMemberName(member.name || ''); }} className="text-muted-foreground hover:text-primary">
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => removeMember(member.id)} className="text-muted-foreground hover:text-destructive">
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Select a group to view its members
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
