import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trophy, GitBranch, Send, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface ABTestSetupProps {
  campaignId: string;
  campaignSubject: string;
  campaignBody: string;
  campaignGroupId: string | null;
  onSent: () => void;
}

interface ABVariant {
  id: string;
  variant: string;
  subject: string;
  body: string;
  sent_count: number;
  open_count: number;
  click_count: number;
  bounce_count: number;
  is_winner: boolean;
}

export default function ABTestSetup({ campaignId, campaignSubject, campaignBody, campaignGroupId, onSent }: ABTestSetupProps) {
  const { toast } = useToast();
  const [variants, setVariants] = useState<ABVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [winnerMetric, setWinnerMetric] = useState<'open_rate' | 'click_rate'>('open_rate');

  // Form state for creating variants
  const [subjectA, setSubjectA] = useState(campaignSubject);
  const [bodyA, setBodyA] = useState(campaignBody);
  const [subjectB, setSubjectB] = useState(campaignSubject + ' (V2)');
  const [bodyB, setBodyB] = useState(campaignBody);

  useEffect(() => {
    loadVariants();
  }, [campaignId]);

  async function loadVariants() {
    setLoading(true);
    const { data } = await supabase
      .from('campaign_ab_tests')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('variant');
    if (data && data.length > 0) {
      setVariants(data as ABVariant[]);
    }
    setLoading(false);
  }

  async function createVariants() {
    if (!subjectA.trim() || !subjectB.trim() || !bodyA.trim() || !bodyB.trim()) {
      toast({ title: 'Fill all fields for both versions', variant: 'destructive' });
      return;
    }
    setSending(true);
    const { error } = await supabase.from('campaign_ab_tests').insert([
      { campaign_id: campaignId, variant: 'A', subject: subjectA, body: bodyA },
      { campaign_id: campaignId, variant: 'B', subject: subjectB, body: bodyB },
    ]);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // Mark campaign as A/B test
      await supabase.from('email_campaigns').update({
        is_ab_test: true,
        ab_winner_metric: winnerMetric,
      }).eq('id', campaignId);
      toast({ title: 'A/B test variants created!' });
      loadVariants();
    }
    setSending(false);
  }

  async function sendABTest() {
    if (!campaignGroupId) {
      toast({ title: 'No group assigned', variant: 'destructive' });
      return;
    }
    setSending(true);

    // Get members
    const { data: members } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', campaignGroupId);

    if (!members || members.length < 2) {
      toast({ title: 'Need at least 2 members for A/B test', variant: 'destructive' });
      setSending(false);
      return;
    }

    // Split 50/50
    const shuffled = [...members].sort(() => Math.random() - 0.5);
    const midpoint = Math.ceil(shuffled.length / 2);
    const groupA = shuffled.slice(0, midpoint);
    const groupB = shuffled.slice(midpoint);

    const variantA = variants.find(v => v.variant === 'A');
    const variantB = variants.find(v => v.variant === 'B');

    if (!variantA || !variantB) {
      toast({ title: 'Missing variants', variant: 'destructive' });
      setSending(false);
      return;
    }

    try {
      // Send variant A
      await supabase.functions.invoke('send-group-email', {
        body: {
          recipients: groupA.map(m => ({ email: m.email, name: m.name })),
          subject: variantA.subject,
          body: variantA.body,
          groupId: campaignGroupId,
        },
      });

      // Send variant B
      await supabase.functions.invoke('send-group-email', {
        body: {
          recipients: groupB.map(m => ({ email: m.email, name: m.name })),
          subject: variantB.subject,
          body: variantB.body,
          groupId: campaignGroupId,
        },
      });

      // Update variant counts
      await supabase.from('campaign_ab_tests').update({ sent_count: groupA.length }).eq('id', variantA.id);
      await supabase.from('campaign_ab_tests').update({ sent_count: groupB.length }).eq('id', variantB.id);

      // Update campaign
      await supabase.from('email_campaigns').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_count: members.length,
      }).eq('id', campaignId);

      toast({ title: 'A/B test sent!', description: `Variant A: ${groupA.length}, Variant B: ${groupB.length}` });
      loadVariants();
      onSent();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSending(false);
  }

  async function declareWinner(variantId: string) {
    await supabase.from('campaign_ab_tests').update({ is_winner: false }).eq('campaign_id', campaignId);
    await supabase.from('campaign_ab_tests').update({ is_winner: true }).eq('id', variantId);
    await supabase.from('email_campaigns').update({ ab_winner_decided_at: new Date().toISOString() }).eq('id', campaignId);
    toast({ title: 'Winner declared!' });
    loadVariants();
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  // If variants exist, show results
  if (variants.length > 0) {
    const comparisonData = variants.map(v => ({
      variant: `Version ${v.variant}`,
      'Open Rate': v.sent_count > 0 ? Number(((v.open_count / v.sent_count) * 100).toFixed(1)) : 0,
      'Click Rate': v.sent_count > 0 ? Number(((v.click_count / v.sent_count) * 100).toFixed(1)) : 0,
      sent: v.sent_count,
      opens: v.open_count,
      clicks: v.click_count,
    }));

    const bestVariant = [...variants].sort((a, b) => {
      if (winnerMetric === 'open_rate') {
        return (b.open_count / Math.max(b.sent_count, 1)) - (a.open_count / Math.max(a.sent_count, 1));
      }
      return (b.click_count / Math.max(b.sent_count, 1)) - (a.click_count / Math.max(a.sent_count, 1));
    })[0];

    return (
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          {variants.map(v => (
            <Card key={v.id} className={`border-2 ${v.is_winner ? 'border-success' : 'border-border/50'}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <GitBranch className="w-4 h-4" />
                    Version {v.variant}
                    {v.is_winner && <Badge className="bg-success/10 text-success text-[10px]"><Trophy className="w-3 h-3 mr-1" />Winner</Badge>}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs"><span className="text-muted-foreground">Subject:</span> {v.subject}</p>
                <p className="text-xs text-muted-foreground line-clamp-3">{v.body}</p>
                <div className="grid grid-cols-3 gap-2 text-center pt-2">
                  <div>
                    <p className="text-lg font-bold">{v.sent_count}</p>
                    <p className="text-[10px] text-muted-foreground">Sent</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{v.open_count}</p>
                    <p className="text-[10px] text-muted-foreground">Opens</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{v.click_count}</p>
                    <p className="text-[10px] text-muted-foreground">Clicks</p>
                  </div>
                </div>
                {!v.is_winner && v.sent_count > 0 && (
                  <Button size="sm" variant="outline" className="w-full text-xs mt-2" onClick={() => declareWinner(v.id)}>
                    <Trophy className="w-3 h-3 mr-1" /> Declare Winner
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {variants.some(v => v.sent_count > 0) && (
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display">Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={comparisonData}>
                  <XAxis dataKey="variant" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Open Rate" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Click Rate" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {variants.every(v => v.sent_count === 0) && (
          <Button variant="gradient" className="w-full" onClick={sendABTest} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send A/B Test
          </Button>
        )}
      </div>
    );
  }

  // Create variants form
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <GitBranch className="w-5 h-5 text-primary" />
        <h3 className="font-display font-semibold">Set Up A/B Test</h3>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Winner determined by</Label>
        <Select value={winnerMetric} onValueChange={v => setWinnerMetric(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open_rate">Highest Open Rate</SelectItem>
            <SelectItem value="click_rate">Highest Click Rate</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Version A</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Subject Line</Label>
              <Input value={subjectA} onChange={e => setSubjectA(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Email Body</Label>
              <Textarea value={bodyA} onChange={e => setBodyA(e.target.value)} className="mt-1 min-h-[120px]" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Version B</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Subject Line</Label>
              <Input value={subjectB} onChange={e => setSubjectB(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Email Body</Label>
              <Textarea value={bodyB} onChange={e => setBodyB(e.target.value)} className="mt-1 min-h-[120px]" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Button variant="gradient" className="w-full" onClick={createVariants} disabled={sending}>
        {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GitBranch className="w-4 h-4 mr-2" />}
        Create A/B Test Variants
      </Button>
    </div>
  );
}
