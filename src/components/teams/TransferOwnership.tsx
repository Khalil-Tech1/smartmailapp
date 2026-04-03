import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRightLeft, Loader2, AlertTriangle } from 'lucide-react';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  email?: string;
  name?: string;
}

interface TransferOwnershipProps {
  teamId: string;
  currentOwnerId: string;
  members: TeamMember[];
  onTransferred: () => void;
}

export default function TransferOwnership({ teamId, currentOwnerId, members, onTransferred }: TransferOwnershipProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [transferring, setTransferring] = useState(false);

  const eligibleMembers = members.filter(m => m.user_id !== currentOwnerId);

  async function handleTransfer() {
    if (!selectedUserId) {
      toast({ title: 'Select a team member', variant: 'destructive' });
      return;
    }
    setTransferring(true);
    try {
      // Update team owner
      const { error: teamError } = await supabase
        .from('teams')
        .update({ owner_id: selectedUserId })
        .eq('id', teamId);
      if (teamError) throw teamError;

      // Make old owner an admin member
      const existingMember = members.find(m => m.user_id === currentOwnerId);
      if (!existingMember) {
        await supabase.from('team_members').insert({
          team_id: teamId,
          user_id: currentOwnerId,
          role: 'admin',
        });
      }

      // Remove new owner from members table (they're now the owner)
      await supabase.from('team_members').delete()
        .eq('team_id', teamId)
        .eq('user_id', selectedUserId);

      toast({ title: 'Ownership transferred successfully!' });
      setOpen(false);
      setSelectedUserId('');
      onTransferred();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setTransferring(false);
    }
  }

  if (eligibleMembers.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer Ownership
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" /> Transfer Team Ownership
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Transfer ownership of this team to another member. You will become an admin after the transfer. This action cannot be undone easily.
          </p>
          <div className="space-y-2">
            <Label>New Owner</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger><SelectValue placeholder="Select a team member" /></SelectTrigger>
              <SelectContent>
                {eligibleMembers.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.email || m.name || m.user_id.slice(0, 8)} ({m.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleTransfer} disabled={transferring || !selectedUserId}>
              {transferring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
              Transfer Ownership
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
