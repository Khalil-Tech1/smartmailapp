import { motion } from 'framer-motion';
import { Check, X, Gift, Crown } from 'lucide-react';
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
];

function formatLimit(val: number | null) {
  if (val === null) return '∞';
  return val.toLocaleString();
}

export default function Billing() {
  const { tier, hasUsedTrial, isOnTrial, trialEnd, startTrial } = useAuth();
  const { toast } = useToast();

  async function handleUpgrade(targetTier: SubscriptionTier) {
    if (targetTier === 'free') return;

    if (!hasUsedTrial) {
      const success = await startTrial(targetTier);
      if (success) {
        toast({
          title: '🎉 Free trial started!',
          description: `Enjoy your ${TIER_LIMITS[targetTier].label} plan free for 2 weeks!`,
        });
      } else {
        toast({ title: 'Error', description: 'Could not start trial. Please try again.', variant: 'destructive' });
      }
      return;
    }

    toast({
      title: 'PayPal Integration Coming Soon',
      description: 'PayPal subscription billing will be integrated shortly. Stay tuned!',
    });
  }

  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">Billing & Plans</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and upgrade your plan.</p>
        {isOnTrial && (
          <div className="mt-3 flex items-center gap-2 text-sm bg-primary/10 text-primary rounded-lg px-4 py-2 w-fit">
            <Gift className="w-4 h-4" />
            <span>Free trial active — <strong>{trialDaysLeft} days</strong> remaining</span>
          </div>
        )}
        {!hasUsedTrial && tier === 'free' && (
          <div className="mt-3 flex items-center gap-2 text-sm bg-accent/50 text-accent-foreground rounded-lg px-4 py-2 w-fit">
            <Gift className="w-4 h-4" />
            <span>You're eligible for a <strong>2-week free trial</strong> on any paid plan!</span>
          </div>
        )}
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
                      return (
                        <div key={f.key} className="flex items-center gap-1.5 text-xs">
                          {has ? (
                            <Check className="w-3.5 h-3.5 text-success shrink-0" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                          )}
                          <span className={has ? '' : 'text-muted-foreground/50'}>{f.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    variant={isCurrent ? 'outline' : 'gradient'}
                    className="w-full"
                    size="sm"
                    disabled={isCurrent || t === 'free'}
                    onClick={() => handleUpgrade(t)}
                  >
                    {isCurrent
                      ? (isOnTrial ? 'On Trial' : 'Current Plan')
                      : t === 'free'
                        ? 'Free'
                        : !hasUsedTrial
                          ? 'Start Free Trial'
                          : 'Upgrade'}
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
