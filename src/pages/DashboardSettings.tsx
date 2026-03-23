import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function DashboardSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');

  async function updateProfile() {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() || null }).eq('user_id', user.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated!' });
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings.</p>
      </div>

      <Card className="max-w-lg border-border/50">
        <CardHeader>
          <CardTitle className="font-display">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ''} disabled />
          </div>
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input placeholder="Your name" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <Button variant="gradient" onClick={updateProfile}>Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  );
}
