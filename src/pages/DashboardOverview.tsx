import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Mail, Send, Calendar, BarChart3, Lock, Plus, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TIER_LIMITS } from '@/lib/tier-limits';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';

interface ActivityItem {
  id: string;
  text: string;
  time: string;
  icon: typeof Mail;
}

export default function DashboardOverview() {
  const { user, tier } = useAuth();
  const navigate = useNavigate();
  const limits = TIER_LIMITS[tier];
  const [stats, setStats] = useState({ groups: 0, contacts: 0, totalSent: 0 });
  const [weeklyData, setWeeklyData] = useState<{ day: string; count: number }[]>([]);
  const [emailStatus, setEmailStatus] = useState({ delivered: 0, failed: 0, pending: 0 });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [groupsRes, contactsRes, emailsRes] = await Promise.all([
      supabase.from('mail_groups').select('id, name', { count: 'exact' }),
      supabase.from('group_members').select('id', { count: 'exact', head: true }),
      supabase.from('sent_emails').select('*').order('created_at', { ascending: false }).limit(100),
    ]);

    const groups = groupsRes.data || [];
    const emails = emailsRes.data || [];

    setStats({
      groups: groupsRes.count || 0,
      contacts: contactsRes.count || 0,
      totalSent: emails.filter(e => e.status === 'sent').length,
    });

    // Email status counts
    const delivered = emails.filter(e => e.status === 'sent').length;
    const failed = emails.filter(e => e.status === 'failed').length;
    const pending = emails.filter(e => e.status === 'scheduled' || e.status === 'pending').length;
    setEmailStatus({ delivered, failed, pending });

    // Weekly bar chart
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

    // Recent activity feed (last 5)
    const recentActivities: ActivityItem[] = [];
    for (const email of emails.slice(0, 5)) {
      const groupName = groups.find(g => g.id === email.group_id)?.name || 'a group';
      if (email.status === 'scheduled') {
        recentActivities.push({
          id: email.id,
          text: `You scheduled an email to ${groupName}`,
          time: new Date(email.created_at).toLocaleDateString(),
          icon: Clock,
        });
      } else {
        recentActivities.push({
          id: email.id,
          text: `You sent an email to ${groupName}`,
          time: new Date(email.created_at).toLocaleDateString(),
          icon: Send,
        });
      }
    }
    setActivities(recentActivities);
    setLoading(false);
  }

  const statCards = [
    { label: 'Total Contacts', value: stats.contacts, icon: Users, color: 'text-primary' },
    { label: 'Mail Groups', value: stats.groups, icon: Mail, color: 'text-accent' },
    { label: 'Emails Sent', value: stats.totalSent, icon: Send, color: 'text-success' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your overview.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              Emails Sent This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyData.some(d => d.count > 0) ? (
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
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground text-sm">
                <Send className="w-8 h-8 mb-2 opacity-30" />
                <p>No emails sent this week yet.</p>
                <p className="text-xs mt-1">Create your first campaign to get started!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Status */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-display">Email Status</CardTitle>
          </CardHeader>
          <CardContent>
            {emailStatus.delivered === 0 && emailStatus.failed === 0 && emailStatus.pending === 0 ? (
              <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground text-sm">
                <Mail className="w-8 h-8 mb-2 opacity-30" />
                <p>No email data yet.</p>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/10">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <span className="text-sm font-medium">Delivered</span>
                  </div>
                  <span className="text-2xl font-bold font-display">{emailStatus.delivered}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-5 h-5 text-destructive" />
                    <span className="text-sm font-medium">Failed</span>
                  </div>
                  <span className="text-2xl font-bold font-display">{emailStatus.failed}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/10">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-warning" />
                    <span className="text-sm font-medium">Pending / Scheduled</span>
                  </div>
                  <span className="text-2xl font-bold font-display">{emailStatus.pending}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed + Locked Analytics */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-display">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Plus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No recent activity.</p>
                <p className="text-xs mt-1">Start by creating a mail group and sending your first email!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 p-2 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <activity.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.text}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Campaign Analytics - Locked for Free/Basic */}
        <Card className="bg-gradient-card border-border/50 relative">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> Campaign Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {limits.campaignAnalytics ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                <p>View detailed analytics in the <button onClick={() => navigate('/dashboard/campaigns')} className="text-primary underline">Campaigns</button> section.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="bg-muted/50 rounded-full p-4 mb-3">
                  <Lock className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">Campaign Analytics Locked</p>
                <p className="text-xs text-muted-foreground text-center mb-4">
                  Upgrade to Pro for ${TIER_LIMITS.pro.price}/month to unlock campaign analytics
                </p>
                <Button variant="gradient" size="sm" onClick={() => navigate('/dashboard/billing')}>
                  Upgrade to Pro
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
