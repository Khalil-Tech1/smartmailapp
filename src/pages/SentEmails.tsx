import { useEffect, useState } from 'react';
import { Mail, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type SentEmail = Tables<'sent_emails'>;

export default function SentEmails() {
  const { user } = useAuth();
  const [emails, setEmails] = useState<SentEmail[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('sent_emails')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setEmails(data); });
  }, [user]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">Sent Emails</h1>
        <p className="text-muted-foreground mt-1">Your email sending history.</p>
      </div>

      {emails.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No emails sent yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map(email => (
            <Card key={email.id} className="border-border/50">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{email.subject}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(email.created_at).toLocaleDateString()} · {email.recipient_count} recipient(s)
                    </p>
                  </div>
                </div>
                <Badge variant={email.status === 'sent' ? 'default' : 'secondary'} className="capitalize">
                  {email.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
