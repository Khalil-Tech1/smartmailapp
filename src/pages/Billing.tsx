import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { TIER_LIMITS, type SubscriptionTier } from '@/lib/tier-limits';
import { useToast } from '@/hooks/use-toast';

const tiers: SubscriptionTier[] = ['free', 'basic', 'pro', 'business'];

const features: { label: string; key: keyof typeof TIER_LIMITS.free }[] = [
  { label: 'Voice Notes', key: 'voiceNotes' },
  { label: 'AI-Personalized Messages', key: 'aiMessages' },
  { label: 'Scheduled Sending', key: 'scheduledSending' },
  { label: 'Email Marketing Tools', key: 'emailMarketing' },
];

export default function Billing() {
  const { tier } = useAuth();
  const { toast } = useToast();

  function handleUpgrade(targetTier: SubscriptionTier) {
    if (targetTier === 'free') return;
    toast({
      title: 'PayPal Integration Coming Soon',
      description: 'PayPal subscription billing will be integrated shortly. Stay tuned!',
    });
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">Billing & Plans</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and upgrade your plan.</p>
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
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-display capitalize">{limits.label}</CardTitle>
                    {isCurrent && <Badge>Current</Badge>}
                  </div>
                  <div className="mt-2">
                    <span className="text-3xl font-bold font-display">
                      {limits.price === 0 ? 'Free' : `$${limits.price}`}
                    </span>
                    {limits.price > 0 && <span className="text-muted-foreground text-sm">/mo</span>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mail Groups</span>
                      <span className="font-medium">{limits.maxGroups}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Members/Group</span>
                      <span className="font-medium">{limits.maxMembersPerGroup}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {features.map(f => {
                      const has = limits[f.key];
                      return (
                        <div key={f.key} className="flex items-center gap-2 text-sm">
                          {has ? (
                            <Check className="w-4 h-4 text-success" />
                          ) : (
                            <X className="w-4 h-4 text-muted-foreground/30" />
                          )}
                          <span className={has ? '' : 'text-muted-foreground/50'}>{f.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    variant={isCurrent ? 'outline' : 'gradient'}
                    className="w-full"
                    disabled={isCurrent || t === 'free'}
                    onClick={() => handleUpgrade(t)}
                  >
                    {isCurrent ? 'Current Plan' : t === 'free' ? 'Free' : 'Upgrade'}
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
