import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { Send, Eye, MousePointer, AlertTriangle, UserMinus, TrendingUp } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  sent_count: number | null;
  open_count: number | null;
  click_count: number | null;
  bounce_count: number | null;
  unsubscribe_count: number | null;
  delivered_count: number | null;
  status: string;
  sent_at: string | null;
}

interface CampaignAnalyticsProps {
  campaigns: Campaign[];
}

const COLORS = ['hsl(217, 91%, 60%)', 'hsl(142, 71%, 45%)', 'hsl(0, 84%, 60%)', 'hsl(262, 83%, 58%)'];

export default function CampaignAnalytics({ campaigns }: CampaignAnalyticsProps) {
  const sentCampaigns = campaigns.filter(c => c.status === 'sent');
  const [selectedId, setSelectedId] = useState<string>(sentCampaigns[0]?.id || '');
  const [compareId, setCompareId] = useState<string>('');

  const selected = sentCampaigns.find(c => c.id === selectedId);
  const compare = sentCampaigns.find(c => c.id === compareId);

  function getMetrics(c: Campaign) {
    const sent = c.sent_count || 0;
    const opens = c.open_count || 0;
    const clicks = c.click_count || 0;
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

  // Simulated timeline data for opens/clicks over 24h
  function getTimeline(c: Campaign) {
    const sent = c.sent_count || 1;
    const opens = c.open_count || 0;
    const clicks = c.click_count || 0;
    const hours = Array.from({ length: 24 }, (_, i) => i);
    // Simulate bell curve distribution
    return hours.map(h => {
      const factor = Math.exp(-0.5 * Math.pow((h - 4) / 3, 2));
      return {
        hour: `${h}h`,
        opens: Math.round(opens * factor * 0.2),
        clicks: Math.round(clicks * factor * 0.2),
      };
    });
  }

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
                  <LineChart data={getTimeline(selected)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
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
