import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';

export default function DashboardSettings() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function updateProfile() {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() || null }).eq('user_id', user.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated!' });
    }
  }

  async function handleDeleteAccount() {
    if (!user || !deleteReason.trim()) {
      toast({ title: 'Please provide a reason', description: 'We need to know why you want to delete your account.', variant: 'destructive' });
      return;
    }
    setDeleting(true);
    try {
      const { error } = await supabase.from('account_deletion_requests').insert({
        user_id: user.id,
        reason: deleteReason.trim(),
      });
      if (error) throw error;
      toast({ title: 'Account deletion requested', description: 'Your account will be deleted within 48 hours. You will be signed out now.' });
      setShowDeleteDialog(false);
      setTimeout(() => signOut(), 2000);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings.</p>
      </div>

      <Card className="max-w-lg border-border/50 mb-6">
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

      <Card className="max-w-lg border-destructive/30">
        <CardHeader>
          <CardTitle className="font-display text-destructive flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Once you delete your account, all your data will be permanently removed. This action cannot be undone.
          </p>
          <Dialog open={showDeleteDialog} onOpenChange={v => { setShowDeleteDialog(v); if (!v) setDeleteReason(''); }}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="w-4 h-4" /> Delete Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display text-destructive">Delete Your Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  We're sorry to see you go. Please tell us why you're leaving so we can improve.
                </p>
                <div className="space-y-2">
                  <Label>Reason for leaving <span className="text-destructive">*</span></Label>
                  <Textarea
                    placeholder="Please tell us why you want to delete your account..."
                    value={deleteReason}
                    onChange={e => setDeleteReason(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleting || !deleteReason.trim()}
                    className="gap-2"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Confirm Delete
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
