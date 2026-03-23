import { Link, useLocation } from 'react-router-dom';
import { Mail, Users, Send, BarChart3, CreditCard, Settings, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { TIER_LIMITS } from '@/lib/tier-limits';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { href: '/dashboard/groups', icon: Users, label: 'Mail Groups' },
  { href: '/dashboard/compose', icon: Send, label: 'Compose' },
  { href: '/dashboard/history', icon: Mail, label: 'Sent Emails' },
  { href: '/dashboard/campaigns', icon: BarChart3, label: 'Campaigns', tierRequired: 'business' as const },
  { href: '/dashboard/billing', icon: CreditCard, label: 'Billing' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export default function DashboardSidebar() {
  const location = useLocation();
  const { user, tier, signOut } = useAuth();
  const limits = TIER_LIMITS[tier];

  return (
    <aside className="w-64 border-r border-border bg-card h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold font-display">SmartMail</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const isLocked = item.tierRequired && tier !== item.tierRequired;

          return (
            <Link
              key={item.href}
              to={isLocked ? '/dashboard/billing' : item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              } ${isLocked ? 'opacity-50' : ''}`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
              {isLocked && (
                <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0">
                  {item.tierRequired}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + tier */}
      <div className="p-4 border-t border-border space-y-3">
        <div className="flex items-center gap-2 px-3">
          <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
            {user?.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <Badge variant="outline" className="text-xs capitalize">{limits.label}</Badge>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 px-3 py-2 w-full text-sm text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-muted"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
