import { useEffect, useState } from 'react';
import {
  BarChart3, Plus, Send, Loader2, Eye, MousePointer, Lock,
  FileText, GitBranch, TrendingUp, Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Navigate, useNavigate } from 'react-router-dom';
import type { Tables } from '@/integrations/supabase/types';
import TemplateSelector from '@/components/campaigns/TemplateSelector';
import EmailBlockEditor from '@/components/campaigns/EmailBlockEditor';
import EmailPreview from '@/components/campaigns/EmailPreview';
import CampaignAnalytics from '@/components/campaigns/CampaignAnalytics';
import ABTestSetup from '@/components/campaigns/ABTestSetup';
import { PRESET_TEMPLATES, type EmailTemplate, type EmailTemplateBlock, blocksToHtml } from '@/lib/email-templates';

type Campaign = Tables<'email_campaigns'>;
type MailGroup = Tables<'mail_groups'>;

function LockedOverlay() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="bg-muted/50 rounded-full p-6 mb-4">
        <Lock className="w-10 h-10 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-display font-bold mb-2">Business Plan Required</h2>
      <p className="text-muted-foreground text-sm text-center max-w-md mb-6">
        Email campaigns with templates, analytics, and A/B testing are available on the Business plan.
      </p>
      <Button variant="gradient" onClick={() => navigate('/dashboard/billing')}>
        Upgrade Now
      </Button>
    </div>
  );
}

export default function Campaigns() {
  const { user, tier } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [groups, setGroups] = useState<MailGroup[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [groupId, setGroupId] = useState('');
  const [isAbTest, setIsAbTest] = useState(false);
  const [activeTab, setActiveTab] = useState('campaigns');

  // Template editor state
  const [blocks, setBlocks] = useState<EmailTemplateBlock[]>([]);
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [createStep, setCreateStep] = useState<'template' | 'editor' | 'preview'>('template');

  // Detail view
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    if (user) {
      loadCampaigns();
      loadGroups();
    }
  }, [user]);

  if (tier !== 'business') return <LockedOverlay />;

  async function loadCampaigns() {
    const { data } = await supabase.from('email_campaigns').select('*').order('created_at', { ascending: false });
    if (data) setCampaigns(data);
  }

  async function loadGroups() {
    const { data } = await supabase.from('mail_groups').select('*').order('name');
    if (data) setGroups(data);
  }

  function handleSelectTemplate(template: EmailTemplate) {
    setSelectedTemplate(template);
    setBlocks([...template.blocks]);
    setPrimaryColor(template.primaryColor);
    setSubject(template.blocks.find(b => b.type === 'heading')?.content || '');
    setCreateStep('editor');
  }

  async function createCampaign() {
    if (!user || !name.trim() || !subject.trim()) {
      toast({ title: 'Fill campaign name and subject', variant: 'destructive' });
      return;
    }
    setCreating(true);
    const body = blocksToHtml(blocks, primaryColor);
    try {
      const { error } = await supabase.from('email_campaigns').insert({
        user_id: user.id,
        name: name.trim(),
        subject: subject.trim(),
        body,
        group_id: groupId || null,
        status: 'draft',
        is_ab_test: isAbTest,
      });
      if (error) throw error;
      toast({ title: 'Campaign created!' });
      resetForm();
      setShowCreate(false);
      loadCampaigns();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setName('');
    setSubject('');
    setGroupId('');
    setBlocks([]);
    setPrimaryColor('#3b82f6');
    setSelectedTemplate(null);
    setCreateStep('template');
    setIsAbTest(false);
  }

  async function sendCampaign(campaign: Campaign) {
    if (!campaign.group_id) {
      toast({ title: 'No group assigned', variant: 'destructive' });
      return;
    }
    const { data: members } = await supabase.from('group_members').select('*').eq('group_id', campaign.group_id);
    if (!members || members.length === 0) {
      toast({ title: 'No members in group', variant: 'destructive' });
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
      await supabase.from('email_campaigns').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_count: members.length,
        delivered_count: members.length,
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold font-display">Email Campaigns</h1>
          <p className="text-muted-foreground mt-1">Templates, analytics, and A/B testing.</p>
        </div>
        <Button variant="gradient" onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus className="w-4 h-4 mr-1" /> New Campaign
        </Button>
      </div>

      {/* Main tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-1"><FileText className="w-3.5 h-3.5" /> Campaigns</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1"><TrendingUp className="w-3.5 h-3.5" /> Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4">
          {campaigns.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="text-center py-16">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <h3 className="text-lg font-display font-semibold mb-2">No Campaigns Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">Create your first campaign to start.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {campaigns.map(campaign => (
                <Card key={campaign.id} className="border-border/50 hover:shadow-sm transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 cursor-pointer" onClick={() => setDetailCampaign(campaign)}>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-display font-semibold text-lg">{campaign.name}</h3>
                          <Badge className={`capitalize text-xs ${statusColor(campaign.status)}`}>{campaign.status}</Badge>
                          {(campaign as any).is_ab_test && (
                            <Badge variant="outline" className="text-[10px] gap-1"><GitBranch className="w-3 h-3" /> A/B</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{campaign.subject}</p>
                        <div className="flex items-center gap-6 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Send className="w-3 h-3" /> {campaign.sent_count || 0} sent</span>
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {campaign.open_count || 0} opens</span>
                          <span className="flex items-center gap-1"><MousePointer className="w-3 h-3" /> {campaign.click_count || 0} clicks</span>
                          <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {campaign.status === 'draft' && !(campaign as any).is_ab_test && (
                          <Button variant="gradient" size="sm" onClick={() => sendCampaign(campaign)}>
                            <Send className="w-3 h-3 mr-1" /> Send
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <CampaignAnalytics campaigns={campaigns as any} />
        </TabsContent>
      </Tabs>

      {/* Create campaign dialog */}
      <Dialog open={showCreate} onOpenChange={v => { if (!v) resetForm(); setShowCreate(v); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {createStep === 'template' ? 'Choose a Template' : createStep === 'editor' ? 'Customize Email' : 'Preview & Create'}
            </DialogTitle>
          </DialogHeader>

          {createStep === 'template' && (
            <div className="mt-4">
              <TemplateSelector onSelect={handleSelectTemplate} selectedId={selectedTemplate?.id} />
              <div className="flex justify-end mt-4">
                <Button variant="outline" size="sm" onClick={() => {
                  setBlocks([
                    { id: crypto.randomUUID(), type: 'heading', content: 'Your Heading', align: 'center' },
                    { id: crypto.randomUUID(), type: 'text', content: 'Your email content here...', align: 'left' },
                    { id: crypto.randomUUID(), type: 'button', content: 'Click Here', url: 'https://', align: 'center' },
                  ]);
                  setCreateStep('editor');
                }}>
                  Start from Scratch
                </Button>
              </div>
            </div>
          )}

          {createStep === 'editor' && (
            <div className="mt-4 grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input placeholder="e.g. Spring Newsletter" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Subject Line</Label>
                  <Input placeholder="Email subject..." value={subject} onChange={e => setSubject(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Target Group</Label>
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger><SelectValue placeholder="Select a group" /></SelectTrigger>
                    <SelectContent>
                      {groups.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={isAbTest} onCheckedChange={setIsAbTest} />
                  <Label className="text-sm">Enable A/B Testing</Label>
                  <GitBranch className="w-4 h-4 text-muted-foreground" />
                </div>
                <EmailBlockEditor blocks={blocks} onChange={setBlocks} primaryColor={primaryColor} onColorChange={setPrimaryColor} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Live Preview</Label>
                <EmailPreview blocks={blocks} primaryColor={primaryColor} subject={subject} />
              </div>
              <div className="md:col-span-2 flex justify-between">
                <Button variant="outline" onClick={() => setCreateStep('template')}>Back</Button>
                <Button variant="gradient" onClick={() => setCreateStep('preview')}>Next: Review</Button>
              </div>
            </div>
          )}

          {createStep === 'preview' && (
            <div className="mt-4 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Campaign Name</p>
                    <p className="font-semibold">{name || '(not set)'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Subject</p>
                    <p className="font-semibold">{subject || '(not set)'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Group</p>
                    <p className="font-semibold">{groups.find(g => g.id === groupId)?.name || '(none)'}</p>
                  </div>
                  {isAbTest && (
                    <Badge variant="outline" className="gap-1"><GitBranch className="w-3 h-3" /> A/B Test Enabled</Badge>
                  )}
                </div>
                <EmailPreview blocks={blocks} primaryColor={primaryColor} subject={subject} />
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCreateStep('editor')}>Back</Button>
                <Button variant="gradient" onClick={createCampaign} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Campaign
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Campaign detail dialog with A/B testing */}
      <Dialog open={!!detailCampaign} onOpenChange={v => { if (!v) setDetailCampaign(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {detailCampaign && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  {detailCampaign.name}
                  <Badge className={`capitalize text-xs ${statusColor(detailCampaign.status)}`}>{detailCampaign.status}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                {(detailCampaign as any).is_ab_test ? (
                  <ABTestSetup
                    campaignId={detailCampaign.id}
                    campaignSubject={detailCampaign.subject}
                    campaignBody={detailCampaign.body}
                    campaignGroupId={detailCampaign.group_id}
                    onSent={loadCampaigns}
                  />
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Subject</p>
                      <p className="font-medium">{detailCampaign.subject}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Email Body</p>
                      <div
                        className="border border-border rounded-lg p-4 text-sm max-h-60 overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: detailCampaign.body }}
                      />
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span><Send className="w-3 h-3 inline mr-1" />{detailCampaign.sent_count || 0} sent</span>
                      <span><Eye className="w-3 h-3 inline mr-1" />{detailCampaign.open_count || 0} opens</span>
                      <span><MousePointer className="w-3 h-3 inline mr-1" />{detailCampaign.click_count || 0} clicks</span>
                    </div>
                    {detailCampaign.status === 'draft' && (
                      <Button variant="gradient" onClick={() => { sendCampaign(detailCampaign); setDetailCampaign(null); }}>
                        <Send className="w-4 h-4 mr-2" /> Send Campaign
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
