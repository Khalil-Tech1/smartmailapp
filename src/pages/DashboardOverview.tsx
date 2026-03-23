import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Mail, Send, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TIER_LIMITS } from '@/lib/tier-limits';

export default function DashboardOverview() {
  const { user, tier } = useAuth();
  const limits = TIER_LIMITS[tier];
  const [stats, setStats] = useState({ groups: 0, members: 0, sent: 0 });

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [groupsRes, membersRes, sentRes] = await Promise.all([
        supabase.from('mail_groups').select('id', { count: 'exact', head: true }),
        supabase.from('group_members').select('id', { count: 'exact', head: true }),
        supabase.from('sent_emails').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        groups: groupsRes.count || 0,
        members: membersRes.count || 0,
        sent: sentRes.count || 0,
      });
    }
    load();
  }, [user]);

  const cards = [
    { label: 'Mail Groups', value: `${stats.groups}/${limits.maxGroups}`, icon: Users, color: 'text-primary' },
    { label: 'Total Contacts', value: stats.members, icon: Mail, color: 'text-accent' },
    { label: 'Emails Sent', value: stats.sent, icon: Send, color: 'text-success' },
    { label: 'Current Plan', value: limits.label, icon: TrendingUp, color: 'text-warning' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
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

      {/* Quick actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-display">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a href="/dashboard/groups" className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Create a Mail Group</p>
                <p className="text-xs text-muted-foreground">Organize your contacts into groups</p>
              </div>
            </a>
            <a href="/dashboard/compose" className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <Send className="w-5 h-5 text-accent" />
              <div>
                <p className="text-sm font-medium">Compose Email</p>
                <p className="text-xs text-muted-foreground">Send emails to your groups</p>
              </div>
            </a>
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
