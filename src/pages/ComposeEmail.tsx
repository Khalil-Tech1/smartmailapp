import { useEffect, useState } from 'react';
import { Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type MailGroup = Tables<'mail_groups'>;
type GroupMember = Tables<'group_members'>;

export default function ComposeEmail() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<MailGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (user) loadGroups();
  }, [user]);

  useEffect(() => {
    if (selectedGroupId) loadMembers(selectedGroupId);
  }, [selectedGroupId]);

  async function loadGroups() {
    const { data } = await supabase.from('mail_groups').select('*').order('name');
    if (data) setGroups(data);
  }

  async function loadMembers(groupId: string) {
    const { data } = await supabase.from('group_members').select('*').eq('group_id', groupId);
    if (data) {
      setMembers(data);
      setSelectedMembers(new Set(data.map(m => m.id)));
    }
  }

  function toggleMember(id: string) {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedMembers.size === members.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(members.map(m => m.id)));
    }
  }

  async function handleSend() {
    if (!user || !selectedGroupId || !subject.trim() || !body.trim() || selectedMembers.size === 0) {
      toast({ title: 'Please fill all fields', description: 'Select a group, recipients, subject and message.', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      // Record the sent email
      await supabase.from('sent_emails').insert({
        user_id: user.id,
        group_id: selectedGroupId,
        subject: subject.trim(),
        body: body.trim(),
        recipient_count: selectedMembers.size,
        status: 'sent',
      });

      toast({ title: 'Email sent!', description: `Sent to ${selectedMembers.size} recipient(s).` });
      setSubject('');
      setBody('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">Compose Email</h1>
        <p className="text-muted-foreground mt-1">Send emails to your groups or selected members.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="font-display text-lg">Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Send to Group</Label>
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a mail group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input placeholder="Email subject..." value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  placeholder="Write your message..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>
              <Button onClick={handleSend} variant="gradient" className="w-full" disabled={sending}>
                <Send className="w-4 h-4 mr-2" />
                {sending ? 'Sending...' : `Send to ${selectedMembers.size} recipient(s)`}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recipients panel */}
        <div>
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display text-lg">Recipients</CardTitle>
              {members.length > 0 && (
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {selectedMembers.size === members.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!selectedGroupId ? (
                <p className="text-sm text-muted-foreground text-center py-8">Select a group first</p>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No members in this group</p>
              ) : (
                <div className="space-y-2">
                  {members.map(member => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedMembers.has(member.id)}
                        onCheckedChange={() => toggleMember(member.id)}
                      />
                      <div>
                        <p className="text-sm font-medium">{member.name || member.email}</p>
                        {member.name && <p className="text-xs text-muted-foreground">{member.email}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
