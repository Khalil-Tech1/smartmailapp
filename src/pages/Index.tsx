import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Users, Send, Zap, Shield, Clock, ArrowRight, Check, Gift, Crown, Infinity, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TIER_LIMITS, type SubscriptionTier } from '@/lib/tier-limits';

const features = [
  { icon: Users, title: 'Mail Groups', desc: 'Organize contacts into groups for targeted sending.' },
  { icon: Send, title: 'Instant Sending', desc: 'Send emails to entire groups or selected members.' },
  { icon: Zap, title: 'AI Personalization', desc: 'Craft personalized messages with AI assistance.' },
  { icon: Clock, title: 'Scheduled Sending', desc: 'Schedule emails to send at the perfect time.' },
  { icon: Shield, title: 'Secure & Private', desc: 'Your data is encrypted and never shared.' },
  { icon: Mail, title: 'Marketing Tools', desc: 'Templates, campaigns, and analytics for growth.' },
];

const tiers: SubscriptionTier[] = ['free', 'basic', 'pro', 'business'];

function formatLimit(val: number | null) {
  if (val === null) return 'Unlimited';
  return val.toLocaleString();
}

export default function Index() {
  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-display">SmartMail</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button variant="gradient">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium rounded-full px-4 py-1.5 mb-6">
              <Gift className="w-3.5 h-3.5" /> Start with a 2-week free trial on any paid plan
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold font-display leading-tight mb-6">
              Group emails,{' '}
              <span className="text-gradient">made simple.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Create mail groups, add your contacts, and send emails to everyone at once — or just the people you pick. No complexity, just results.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button variant="hero" size="lg">
                  Start for Free <ArrowRight className="w-5 h-5 ml-1" />
                </Button>
              </Link>
              <a href="#pricing">
                <Button variant="outline" size="lg">View Pricing</Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">Everything you need</h2>
            <p className="text-muted-foreground text-lg">Powerful features to manage your email communications.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="bg-gradient-card border-border/50 h-full">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <f.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold font-display mb-2">{f.title}</h3>
                    <p className="text-muted-foreground text-sm">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">Simple, transparent pricing</h2>
            <p className="text-muted-foreground text-lg">Start free. Upgrade when you need more.</p>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium rounded-full px-4 py-1.5 mt-4">
              <Gift className="w-4 h-4" />
              <span>All paid plans include a <strong>2-week free trial</strong> for new users</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {tiers.map((t, i) => {
              const limits = TIER_LIMITS[t];
              const isPopular = t === 'pro';
              return (
                <motion.div
                  key={t}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className={`relative overflow-hidden h-full ${isPopular ? 'border-primary shadow-glow' : 'border-border/50'}`}>
                    {isPopular && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-primary" />}
                    <CardContent className="p-5">
                      <div className="mb-4">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-display font-bold text-lg">{limits.label}</h3>
                        </div>
                        {isPopular && (
                          <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">
                            Most Popular
                          </span>
                        )}
                      </div>
                      <div className="mb-5">
                        <span className="text-3xl font-bold font-display">
                          {limits.price === 0 ? 'Free' : `$${limits.price}`}
                        </span>
                        {limits.price > 0 && <span className="text-muted-foreground text-sm">/mo</span>}
                      </div>
                      <ul className="space-y-2 text-sm mb-5">
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-success shrink-0" />
                          {formatLimit(limits.maxGroups)} mail groups
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-success shrink-0" />
                          {formatLimit(limits.maxMembersPerGroup)} members/group
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-success shrink-0" />
                          {formatLimit(limits.maxEmailsPerMonth)} emails/mo
                        </li>
                        {limits.maxTeamMembers !== null && (
                          <li className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-success shrink-0" />
                            {limits.maxTeamMembers === null ? 'Unlimited' : limits.maxTeamMembers} team members
                          </li>
                        )}
                        {t === 'enterprise' && (
                          <li className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-success shrink-0" />
                            Unlimited team members
                          </li>
                        )}
                        {limits.voiceNotes && <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-success shrink-0" /> Voice notes</li>}
                        {limits.aiMessages && <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-success shrink-0" /> AI personalization</li>}
                        {limits.scheduledSending && <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-success shrink-0" /> Scheduled sending</li>}
                        {limits.emailMarketing && <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-success shrink-0" /> Marketing tools</li>}
                        {limits.customBranding && <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-success shrink-0" /> Custom branding</li>}
                        {limits.apiAccess && <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-success shrink-0" /> API access</li>}
                      </ul>
                      {limits.price > 0 && (
                        <p className="text-xs text-primary font-medium mb-3 flex items-center gap-1">
                          <Gift className="w-3 h-3" /> 14-day free trial included
                        </p>
                      )}
                      <Link to="/auth">
                        <Button variant={isPopular || isEnterprise ? 'gradient' : 'outline'} className="w-full" size="sm">
                          {limits.price === 0 ? 'Get Started' : 'Start Free Trial'}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-primary flex items-center justify-center">
              <Mail className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-foreground">SmartMail</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://wa.me/2349169433809" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-muted-foreground hover:text-green-500 transition-colors">
              <MessageCircle className="w-5 h-5" />
              <span>WhatsApp</span>
            </a>
            <p>&copy; {new Date().getFullYear()} SmartMail. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
