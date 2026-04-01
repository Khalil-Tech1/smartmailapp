import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Mail, Send, TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TIER_LIMITS } from '@/lib/tier-limits';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function DashboardOverview() {
  const { user, tier } = useAuth();
  const limits = TIER_LIMITS[tier];
  const [stats, setStats] = useState({ groups: 0, members: 0, sent: 0, scheduled: 0 });
  const [weeklyData, setWeeklyData] = useState<{ day: string; count: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [recentEmails, setRecentEmails] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    const [groupsRes, membersRes, sentRes] = await Promise.all([
      supabase.from('mail_groups').select('id', { count: 'exact', head: true }),
      supabase.from('group_members').select('id', { count: 'exact', head: true }),
      supabase.from('sent_emails').select('*').order('created_at', { ascending: false }).limit(50),
    ]);

    const emails = sentRes.data || [];
    const sentCount = emails.filter(e => e.status === 'sent').length;
    const scheduledCount = emails.filter(e => e.status === 'scheduled').length;

    setStats({
      groups: groupsRes.count || 0,
      members: membersRes.count || 0,
      sent: sentCount,
      scheduled: scheduledCount,
    });

    // Weekly data for chart
    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekly: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      weekly[days[d.getDay()]] = 0;
    }
    emails.forEach(e => {
      const d = new Date(e.created_at);
      const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < 7) {
        const key = days[d.getDay()];
        if (key in weekly) weekly[key] = (weekly[key] || 0) + (e.recipient_count || 0);
      }
    });
    setWeeklyData(Object.entries(weekly).map(([day, count]) => ({ day, count })));

    // Status distribution
    const statusMap: Record<string, number> = {};
    emails.forEach(e => {
      statusMap[e.status] = (statusMap[e.status] || 0) + 1;
    });
    setStatusData(Object.entries(statusMap).map(([name, value]) => ({ name, value })));

    // Recent emails
    setRecentEmails(emails.slice(0, 5));
  }

  const statCards = [
    { label: 'Mail Groups', value: `${stats.groups}/${limits.maxGroups}`, icon: Users, color: 'text-primary' },
    { label: 'Total Contacts', value: stats.members, icon: Mail, color: 'text-accent' },
    { label: 'Emails Sent', value: stats.sent, icon: Send, color: 'text-success' },
    { label: 'Scheduled', value: stats.scheduled, icon: Calendar, color: 'text-warning' },
  ];

  const PIE_COLORS = ['hsl(217, 91%, 60%)', 'hsl(262, 83%, 58%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)'];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your overview.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="bg-gradient-card border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-display">{card.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Emails Chart */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Emails This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyData}>
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(217, 91%, 60%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
                No email data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              Email Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {statusData.map((entry, i) => (
                    <div key={entry.name} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="capitalize text-muted-foreground">{entry.name}</span>
                      <span className="font-semibold">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[160px] text-muted-foreground text-sm">
                No email data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity + Plan Details */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-display">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEmails.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No emails sent yet</p>
            ) : (
              <div className="space-y-3">
                {recentEmails.map(email => (
                  <div key={email.id} className="flex items-center gap-3 p-2 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{email.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {email.recipient_count} recipients · {new Date(email.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full ${
                      email.status === 'sent' ? 'bg-success/10 text-success' :
                      email.status === 'scheduled' ? 'bg-warning/10 text-warning' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {email.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-display">Plan Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Groups</span><span className="font-medium">{stats.groups} / {limits.maxGroups}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Members per group</span><span className="font-medium">up to {limits.maxMembersPerGroup}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Voice Notes</span><span className="font-medium">{limits.voiceNotes ? '✓' : '✗'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">AI Messages</span><span className="font-medium">{limits.aiMessages ? '✓' : '✗'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Scheduled Sending</span><span className="font-medium">{limits.scheduledSending ? '✓' : '✗'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email Marketing</span><span className="font-medium">{limits.emailMarketing ? '✓' : '✗'}</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
