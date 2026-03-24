import { useEffect, useState } from 'react';
import { BarChart3, Plus, Send, Loader2, Eye, MousePointer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';
import type { Tables } from '@/integrations/supabase/types';

type Campaign = Tables<'email_campaigns'>;
type MailGroup = Tables<'mail_groups'>;

export default function Campaigns() {
  const { user, tier } = useAuth();
  const { toast } = useToast();

  if (tier !== 'business') return <Navigate to="/dashboard/billing" replace />;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [groups, setGroups] = useState<MailGroup[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [groupId, setGroupId] = useState('');

  useEffect(() => {
    if (user) {
      loadCampaigns();
      loadGroups();
    }
  }, [user]);

  async function loadCampaigns() {
    const { data } = await supabase.from('email_campaigns').select('*').order('created_at', { ascending: false });
    if (data) setCampaigns(data);
  }

  async function loadGroups() {
    const { data } = await supabase.from('mail_groups').select('*').order('name');
    if (data) setGroups(data);
  }

  async function createCampaign() {
    if (!user || !name.trim() || !subject.trim() || !body.trim()) {
      toast({ title: 'Fill all fields', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.from('email_campaigns').insert({
        user_id: user.id,
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
        group_id: groupId || null,
        status: 'draft',
      });
      if (error) throw error;
      toast({ title: 'Campaign created!' });
      setName('');
      setSubject('');
      setBody('');
      setGroupId('');
      setShowCreate(false);
      loadCampaigns();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  async function sendCampaign(campaign: Campaign) {
    if (!campaign.group_id) {
      toast({ title: 'No group assigned', description: 'Edit the campaign to assign a group.', variant: 'destructive' });
      return;
    }

    // Get group members
    const { data: members } = await supabase.from('group_members').select('*').eq('group_id', campaign.group_id);
    if (!members || members.length === 0) {
      toast({ title: 'No members', description: 'The assigned group has no members.', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('send-group-email', {
        body: {
          recipients: members.map(m => ({ email: m.email, name: m.name })),
          subject: campaign.subject,
          body: campaign.body,
          groupId: campaign.group_id,
        },
      });
      if (error) throw error;

      // Update campaign status
      await supabase.from('email_campaigns').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_count: members.length,
      }).eq('id', campaign.id);

      toast({ title: 'Campaign sent!', description: `Sent to ${members.length} recipients.` });
      loadCampaigns();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-success/10 text-success';
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'scheduled': return 'bg-warning/10 text-warning';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display">Email Campaigns</h1>
          <p className="text-muted-foreground mt-1">Create and manage email marketing campaigns.</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button variant="gradient">
              <Plus className="w-4 h-4 mr-1" /> New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Create Campaign</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input placeholder="e.g. Spring Newsletter" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Target Group</Label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input placeholder="Email subject..." value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email Body</Label>
                <Textarea placeholder="Write your campaign content..." value={body} onChange={e => setBody(e.target.value)} className="min-h-[150px]" />
              </div>
              <Button onClick={createCampaign} variant="gradient" className="w-full" disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Create Campaign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {campaigns.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="text-center py-16">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <h3 className="text-lg font-display font-semibold mb-2">No Campaigns Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Create your first email campaign to start reaching your audience.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map(campaign => (
            <Card key={campaign.id} className="border-border/50">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-display font-semibold text-lg">{campaign.name}</h3>
                      <Badge className={`capitalize text-xs ${statusColor(campaign.status)}`}>
                        {campaign.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{campaign.subject}</p>
                    <div className="flex items-center gap-6 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Send className="w-3 h-3" /> {campaign.sent_count || 0} sent
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {campaign.open_count || 0} opens
                      </span>
                      <span className="flex items-center gap-1">
                        <MousePointer className="w-3 h-3" /> {campaign.click_count || 0} clicks
                      </span>
                      <span>
                        {new Date(campaign.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {campaign.status === 'draft' && (
                    <Button variant="gradient" size="sm" onClick={() => sendCampaign(campaign)}>
                      <Send className="w-3 h-3 mr-1" /> Send
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
