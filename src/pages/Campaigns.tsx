import { BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export default function Campaigns() {
  const { tier } = useAuth();

  if (tier !== 'business') return <Navigate to="/dashboard/billing" replace />;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">Email Campaigns</h1>
        <p className="text-muted-foreground mt-1">Create and manage email marketing campaigns.</p>
      </div>

      <Card className="border-border/50">
        <CardContent className="text-center py-16">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <h3 className="text-lg font-display font-semibold mb-2">Campaign Builder</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Create email templates, schedule campaigns, and track open rates. Campaign management tools are coming soon!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
