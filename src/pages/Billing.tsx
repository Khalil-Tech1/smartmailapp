import { motion } from 'framer-motion';
import { Check, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { TIER_LIMITS, type SubscriptionTier } from '@/lib/tier-limits';
import { useToast } from '@/hooks/use-toast';

const tiers: SubscriptionTier[] = ['free', 'basic', 'pro', 'business'];

const features: { label: string; key: keyof typeof TIER_LIMITS.free; labelOverride?: Record<string, string> }[] = [
  { label: 'Voice Notes', key: 'voiceNotes' },
  { label: 'Scheduled Sending', key: 'scheduledSending' },
  { label: 'Email Marketing Tools', key: 'emailMarketing' },
  { label: 'Campaign Management', key: 'campaignManagement', labelOverride: { business: 'Campaign Archiving' } },
  { label: 'Ownership Transfer', key: 'transferOwnership' },
];

function formatLimit(val: number | null) {
  if (val === null) return '∞';
  return val.toLocaleString();
}

export default function Billing() {
  const { user, tier, hasUsedTrial, isOnTrial, trialEnd, refreshProfile } = useAuth();
  const { toast } = useToast();

  async function handleSwitch(targetTier: SubscriptionTier) {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({
      subscription_tier: targetTier,
    }).eq('user_id', user.id);
    if (error) {
      toast({ title: 'Error', description: 'Could not switch plan. Please try again.', variant: 'destructive' });
      return;
    }
    await refreshProfile();
    toast({
      title: '✅ Plan switched!',
      description: `You're now on the ${TIER_LIMITS[targetTier].label} plan.`,
    });
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">Billing & Plans</h1>
        <p className="text-muted-foreground mt-1">Switch between plans freely.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiers.map((t, i) => {
          const limits = TIER_LIMITS[t];
          const isCurrent = t === tier;

          return (
            <motion.div
              key={t}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className={`relative overflow-hidden border ${isCurrent ? 'border-primary shadow-glow' : 'border-border/50'}`}>
                {isCurrent && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-primary" />
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-display flex items-center gap-1.5 text-base">
                      {limits.label}
                    </CardTitle>
                    {isCurrent && <Badge className="text-xs">{isOnTrial ? 'Trial' : 'Current'}</Badge>}
                  </div>
                  <div className="mt-1">
                    <span className="text-2xl font-bold font-display">
                      {limits.price === 0 ? 'Free' : `$${limits.price}`}
                    </span>
                    {limits.price > 0 && <span className="text-muted-foreground text-xs">/mo</span>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mail Groups</span>
                      <span className="font-medium">{formatLimit(limits.maxGroups)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Members/Group</span>
                      <span className="font-medium">{formatLimit(limits.maxMembersPerGroup)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Emails/Month</span>
                      <span className="font-medium">{formatLimit(limits.maxEmailsPerMonth)}</span>
                    </div>
                    {limits.maxTeamMembers !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Team Members</span>
                        <span className="font-medium">{limits.maxTeamMembers}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {features.map(f => {
                      const has = limits[f.key];
                      // For Pro: skip campaignManagement row, only show emailMarketing
                      if (f.key === 'campaignManagement' && t === 'pro') return null;
                      const displayLabel = f.labelOverride?.[t] || f.label;
                      if (!has) return null;
                      return (
                        <div key={f.key} className="flex items-center gap-1.5 text-xs">
                          <Check className="w-3.5 h-3.5 text-success shrink-0" />
                          <span>{displayLabel}</span>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    variant={isCurrent ? 'outline' : 'gradient'}
                    className="w-full"
                    size="sm"
                    disabled={isCurrent}
                    onClick={() => handleSwitch(t)}
                  >
                    {isCurrent ? 'Current Plan' : 'Switch'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
