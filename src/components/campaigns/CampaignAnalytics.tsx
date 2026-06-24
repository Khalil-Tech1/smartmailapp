import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { Send, Eye, MousePointer, AlertTriangle, UserMinus, TrendingUp, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Campaign {
  id: string;
  name: string;
  sent_count: number | null;
  open_count: number | null;
  click_count: number | null;
  bounce_count: number | null;
  unsubscribe_count: number | null;
  delivered_count: number | null;
  total_opened?: number | null;
  total_clicked?: number | null;
  status: string;
  sent_at: string | null;
}

interface CampaignAnalyticsProps {
  campaigns: Campaign[];
}

interface TrackEvent {
  recipient_email: string;
  event_type: 'open' | 'click';
  clicked_url: string | null;
  tracked_at: string;
}

const COLORS = ['hsl(217, 91%, 60%)', 'hsl(142, 71%, 45%)', 'hsl(0, 84%, 60%)', 'hsl(262, 83%, 58%)'];

export default function CampaignAnalytics({ campaigns }: CampaignAnalyticsProps) {
  const sentCampaigns = campaigns.filter(c => c.status === 'sent');
  const [selectedId, setSelectedId] = useState<string>(sentCampaigns[0]?.id || '');
  const [compareId, setCompareId] = useState<string>('');
  const [events, setEvents] = useState<TrackEvent[]>([]);

  const selected = sentCampaigns.find(c => c.id === selectedId);
  const compare = sentCampaigns.find(c => c.id === compareId);

  // Load real tracking events for selected campaign + subscribe to live updates
  useEffect(() => {
    if (!selectedId) { setEvents([]); return; }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('campaign_tracking')
        .select('recipient_email, event_type, clicked_url, tracked_at')
        .eq('campaign_id', selectedId)
        .order('tracked_at', { ascending: true });
      if (active && data) setEvents(data as TrackEvent[]);
    })();
    const channel = supabase
      .channel(`tracking-${selectedId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'campaign_tracking',
        filter: `campaign_id=eq.${selectedId}`,
      }, (payload) => {
        setEvents(prev => [...prev, payload.new as TrackEvent]);
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [selectedId]);

  const realStats = useMemo(() => {
    const uniqueOpens = new Set(events.filter(e => e.event_type === 'open').map(e => e.recipient_email));
    const uniqueClickPairs = new Set(
      events.filter(e => e.event_type === 'click').map(e => `${e.recipient_email}|${e.clicked_url || ''}`)
    );
    return { uniqueOpens: uniqueOpens.size, uniqueClicks: uniqueClickPairs.size };
  }, [events]);

  function getMetrics(c: Campaign) {
    const sent = c.sent_count || 0;
    // Prefer real tracked counts on the selected campaign; fall back to stored counts for comparison
    const isSelected = c.id === selectedId;
    const opens = isSelected ? realStats.uniqueOpens : (c.total_opened ?? c.open_count ?? 0);
    const clicks = isSelected ? realStats.uniqueClicks : (c.total_clicked ?? c.click_count ?? 0);
    const bounces = c.bounce_count || 0;
    const unsubs = c.unsubscribe_count || 0;
    const delivered = c.delivered_count || sent;
    return {
      sent, opens, clicks, bounces, unsubs, delivered,
      openRate: sent > 0 ? ((opens / sent) * 100).toFixed(1) : '0',
      clickRate: sent > 0 ? ((clicks / sent) * 100).toFixed(1) : '0',
      bounceRate: sent > 0 ? ((bounces / sent) * 100).toFixed(1) : '0',
      unsubRate: sent > 0 ? ((unsubs / sent) * 100).toFixed(1) : '0',
    };
  }

  // Real timeline: opens & clicks per hour relative to campaign sent_at (first 24h)
  const timeline = useMemo(() => {
    if (!selected?.sent_at) return [];
    const start = new Date(selected.sent_at).getTime();
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, opens: 0, clicks: 0 }));
    for (const e of events) {
      const diff = new Date(e.tracked_at).getTime() - start;
      const h = Math.floor(diff / 3_600_000);
      if (h >= 0 && h < 24) {
        if (e.event_type === 'open') buckets[h].opens++;
        else buckets[h].clicks++;
      }
    }
    return buckets;
  }, [events, selected?.sent_at]);

  const openersList = useMemo(() => {
    const map = new Map<string, { count: number; first: string }>();
    for (const e of events) {
      if (e.event_type !== 'open') continue;
      const cur = map.get(e.recipient_email);
      if (cur) cur.count++;
      else map.set(e.recipient_email, { count: 1, first: e.tracked_at });
    }
    return Array.from(map.entries())
      .map(([email, v]) => ({ email, ...v }))
      .sort((a, b) => new Date(b.first).getTime() - new Date(a.first).getTime());
  }, [events]);

  const topLinks = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      if (e.event_type !== 'click' || !e.clicked_url) continue;
      map.set(e.clicked_url, (map.get(e.clicked_url) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([url, count]) => ({ url, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [events]);

  if (sentCampaigns.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="text-center py-12">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <h3 className="font-display font-semibold mb-1">No Analytics Yet</h3>
          <p className="text-sm text-muted-foreground">Send a campaign to see analytics data.</p>
        </CardContent>
      </Card>
    );
  }

  const metrics = selected ? getMetrics(selected) : null;
  const compareMetrics = compare ? getMetrics(compare) : null;

  const pieData = metrics ? [
    { name: 'Delivered', value: metrics.delivered },
    { name: 'Bounced', value: metrics.bounces },
    { name: 'Unsubscribed', value: metrics.unsubs },
  ].filter(d => d.value > 0) : [];

  const comparisonData = metrics && compareMetrics ? [
    { metric: 'Open Rate', [selected!.name]: Number(metrics.openRate), [compare!.name]: Number(compareMetrics.openRate) },
    { metric: 'Click Rate', [selected!.name]: Number(metrics.clickRate), [compare!.name]: Number(compareMetrics.clickRate) },
    { metric: 'Bounce Rate', [selected!.name]: Number(metrics.bounceRate), [compare!.name]: Number(compareMetrics.bounceRate) },
    { metric: 'Unsub Rate', [selected!.name]: Number(metrics.unsubRate), [compare!.name]: Number(compareMetrics.unsubRate) },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Campaign</label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {sentCampaigns.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Compare with</label>
          <Select value={compareId} onValueChange={setCompareId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {sentCampaigns.filter(c => c.id !== selectedId).map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-md p-3">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <p>
          Open tracking may not work in all email clients as some block tracking pixels
          (e.g. Apple Mail Privacy Protection, image blocking in Outlook). Click tracking is more reliable.
        </p>
      </div>

      {metrics && selected && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total Sent', value: metrics.sent, icon: Send, color: 'text-primary' },
              { label: 'Open Rate', value: `${metrics.openRate}%`, icon: Eye, color: 'text-success' },
              { label: 'Click Rate', value: `${metrics.clickRate}%`, icon: MousePointer, color: 'text-accent' },
              { label: 'Bounce Rate', value: `${metrics.bounceRate}%`, icon: AlertTriangle, color: 'text-destructive' },
              { label: 'Unsub Rate', value: `${metrics.unsubRate}%`, icon: UserMinus, color: 'text-warning' },
            ].map(stat => (
              <Card key={stat.label} className="border-border/50">
                <CardContent className="p-4 text-center">
                  <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                  <p className="text-xl font-bold font-display">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">Opens & Clicks Over 24h</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="opens" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="clicks" stroke="hsl(262, 83%, 58%)" strokeWidth={2} dot={false} />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">Delivery Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData.length > 0 ? pieData : [{ name: 'Sent', value: 1 }]} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {(pieData.length > 0 ? pieData : [{ name: 'Sent', value: 1 }]).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Openers + top links */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Recipients who opened ({openersList.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {openersList.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">No opens recorded yet.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-border/40">
                    {openersList.map(o => (
                      <div key={o.email} className="flex items-center justify-between py-2 text-sm">
                        <span className="truncate mr-2">{o.email}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {o.count > 1 ? `${o.count} opens` : '1 open'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <MousePointer className="w-4 h-4" /> Top clicked links
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topLinks.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">No clicks recorded yet.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-border/40">
                    {topLinks.map(l => (
                      <div key={l.url} className="flex items-center justify-between py-2 text-sm gap-2">
                        <a href={l.url} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline">
                          {l.url}
                        </a>
                        <Badge variant="outline" className="text-[10px] shrink-0">{l.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Comparison chart */}
          {compareMetrics && compare && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">
                  Campaign Comparison: {selected.name} vs {compare.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey={selected.name} fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={compare.name} fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
