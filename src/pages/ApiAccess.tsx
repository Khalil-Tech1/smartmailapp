import { useEffect, useState } from 'react';
import {
  Key, Plus, Trash2, Copy, Eye, EyeOff, Loader2, Lock,
  BarChart3, Code, BookOpen, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface ApiKey {
  id: string;
  label: string;
  key_prefix: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

const API_MONTHLY_LIMIT = 10000;

const ENDPOINTS = [
  { method: 'POST', path: '/api/v1/send-email', desc: 'Send email to a group or specific contacts' },
  { method: 'POST', path: '/api/v1/create-group', desc: 'Create a new mail group' },
  { method: 'POST', path: '/api/v1/add-contact', desc: 'Add a contact to a group' },
  { method: 'GET', path: '/api/v1/groups', desc: 'List all mail groups' },
  { method: 'GET', path: '/api/v1/analytics', desc: 'Get campaign analytics' },
  { method: 'DELETE', path: '/api/v1/contact', desc: 'Remove a contact from a group' },
];

const CODE_EXAMPLES = {
  javascript: `const response = await fetch(
  'https://YOUR_PROJECT.supabase.co/functions/v1/api-gateway',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'YOUR_API_KEY'
    },
    body: JSON.stringify({
      endpoint: '/api/v1/send-email',
      data: {
        group_id: 'group-uuid',
        subject: 'Hello from SmartMail',
        body: 'This is sent via the API!'
      }
    })
  }
);

const data = await response.json();
console.log(data);`,

  python: `import requests

response = requests.post(
    'https://YOUR_PROJECT.supabase.co/functions/v1/api-gateway',
    headers={
        'Content-Type': 'application/json',
        'X-API-Key': 'YOUR_API_KEY'
    },
    json={
        'endpoint': '/api/v1/send-email',
        'data': {
            'group_id': 'group-uuid',
            'subject': 'Hello from SmartMail',
            'body': 'This is sent via the API!'
        }
    }
)

print(response.json())`,

  curl: `curl -X POST \\
  'https://YOUR_PROJECT.supabase.co/functions/v1/api-gateway' \\
  -H 'Content-Type: application/json' \\
  -H 'X-API-Key: YOUR_API_KEY' \\
  -d '{
    "endpoint": "/api/v1/send-email",
    "data": {
      "group_id": "group-uuid",
      "subject": "Hello from SmartMail",
      "body": "This is sent via the API!"
    }
  }'`,
};

export default function ApiAccess() {
  const { user, tier } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [codeTab, setCodeTab] = useState<'javascript' | 'python' | 'curl'>('javascript');

  useEffect(() => {
    if (user && tier === 'enterprise') {
      loadKeys();
      loadUsage();
    } else {
      setLoading(false);
    }
  }, [user, tier]);

  async function loadKeys() {
    setLoading(true);
    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (data) setKeys(data);
    setLoading(false);
  }

  async function loadUsage() {
    if (!user) return;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('api_usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfMonth.toISOString());

    setUsageCount(count || 0);
  }

  async function generateKey() {
    if (!user || !newLabel.trim()) return;
    setCreating(true);

    // Generate a random API key
    const rawKey = `sm_${crypto.randomUUID().replace(/-/g, '')}`;
    const prefix = rawKey.slice(0, 11); // "sm_" + first 8 chars

    // Hash the key using SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(rawKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { error } = await supabase
      .from('api_keys')
      .insert({
        user_id: user.id,
        label: newLabel.trim(),
        key_hash: keyHash,
        key_prefix: prefix,
      });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setNewKey(rawKey);
      setShowNewKey(true);
      setShowCreate(false);
      setNewLabel('');
      await loadKeys();
      toast({ title: 'API key created!', description: 'Copy it now — you won\'t see it again.' });
    }
    setCreating(false);
  }

  async function revokeKey(keyId: string) {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId);

    if (!error) {
      toast({ title: 'API key revoked' });
      await loadKeys();
    }
  }

  async function deleteKey(keyId: string) {
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId);

    if (!error) {
      toast({ title: 'API key deleted' });
      await loadKeys();
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard!' });
  }

  if (tier !== 'enterprise') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="bg-muted/50 rounded-full p-6 mb-4">
          <Lock className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-display font-bold mb-2">Enterprise Plan Required</h2>
        <p className="text-muted-foreground text-sm text-center max-w-md mb-6">
          API access with key management, endpoints, and documentation is available exclusively on the Enterprise plan.
        </p>
        <Button variant="gradient" onClick={() => navigate('/dashboard/billing')}>
          Upgrade to Enterprise
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const usagePercent = Math.min((usageCount / API_MONTHLY_LIMIT) * 100, 100);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">API Access</h1>
        <p className="text-muted-foreground mt-1">Manage API keys, view usage, and explore documentation.</p>
      </div>

      <Tabs defaultValue="keys" className="space-y-6">
        <TabsList>
          <TabsTrigger value="keys" className="gap-2"><Key className="w-4 h-4" /> API Keys</TabsTrigger>
          <TabsTrigger value="usage" className="gap-2"><BarChart3 className="w-4 h-4" /> Usage</TabsTrigger>
          <TabsTrigger value="docs" className="gap-2"><BookOpen className="w-4 h-4" /> Documentation</TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="keys" className="space-y-6">
          {/* New key reveal dialog */}
          <Dialog open={showNewKey} onOpenChange={v => { setShowNewKey(v); if (!v) setNewKey(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2 text-primary">
                  <CheckCircle className="w-5 h-5" /> API Key Created
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive font-medium">
                    Copy this key now. You won't be able to see it again!
                  </p>
                </div>
                <div className="relative">
                  <Input value={newKey || ''} readOnly className="pr-10 font-mono text-xs" />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => newKey && copyToClipboard(newKey)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="gradient" className="w-full" onClick={() => { setShowNewKey(false); setNewKey(null); }}>
                  I've copied my key
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-semibold">Your API Keys</h2>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button variant="gradient" className="gap-2">
                  <Plus className="w-4 h-4" /> Generate New Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">Generate API Key</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input
                      placeholder="e.g. Website Integration, CRM Connection, Mobile App"
                      value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Give your key a descriptive name so you can identify it later.</p>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                    <Button variant="gradient" onClick={generateKey} disabled={creating || !newLabel.trim()}>
                      {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Key className="w-4 h-4 mr-2" />}
                      Generate
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {keys.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-12">
                <Key className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">No API keys yet. Generate one to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {keys.map(key => (
                <Card key={key.id} className={`border-border/50 ${!key.is_active ? 'opacity-50' : ''}`}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Key className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{key.label}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-xs text-muted-foreground font-mono">{key.key_prefix}...****</code>
                          <Badge variant={key.is_active ? 'default' : 'secondary'} className="text-xs">
                            {key.is_active ? 'Active' : 'Revoked'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Created {new Date(key.created_at).toLocaleDateString()}
                          {key.last_used_at && ` • Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {key.is_active && (
                        <Button size="sm" variant="outline" onClick={() => revokeKey(key.id)}>
                          Revoke
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteKey(key.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Monthly API Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">API Calls This Month</span>
                <span className="font-bold">{usageCount.toLocaleString()} / {API_MONTHLY_LIMIT.toLocaleString()}</span>
              </div>
              <Progress value={usagePercent} className="h-3" />
              {usagePercent >= 80 && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4" />
                  You've used {Math.round(usagePercent)}% of your monthly API limit.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documentation Tab */}
        <TabsContent value="docs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">API Endpoints</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ENDPOINTS.map(ep => (
                  <div key={ep.path} className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg">
                    <Badge variant={ep.method === 'GET' ? 'secondary' : ep.method === 'DELETE' ? 'destructive' : 'default'} className="font-mono text-xs shrink-0 mt-0.5">
                      {ep.method}
                    </Badge>
                    <div>
                      <code className="text-sm font-mono font-medium">{ep.path}</code>
                      <p className="text-xs text-muted-foreground mt-0.5">{ep.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Authentication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                All API requests must include your API key in the <code className="bg-muted px-1.5 py-0.5 rounded text-xs">X-API-Key</code> header.
                Send all requests to the gateway endpoint with the desired <code className="bg-muted px-1.5 py-0.5 rounded text-xs">endpoint</code> and <code className="bg-muted px-1.5 py-0.5 rounded text-xs">data</code> in the JSON body.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Code className="w-4 h-4" /> Code Examples
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={codeTab} onValueChange={v => setCodeTab(v as typeof codeTab)}>
                <TabsList className="mb-4">
                  <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                  <TabsTrigger value="python">Python</TabsTrigger>
                  <TabsTrigger value="curl">cURL</TabsTrigger>
                </TabsList>
                {(['javascript', 'python', 'curl'] as const).map(lang => (
                  <TabsContent key={lang} value={lang}>
                    <div className="relative">
                      <pre className="bg-muted/50 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                        {CODE_EXAMPLES[lang]}
                      </pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(CODE_EXAMPLES[lang])}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Rate Limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• <strong>10,000 API calls</strong> per month</p>
              <p>• Email alert sent at <strong>80%</strong> usage</p>
              <p>• Keys automatically blocked on suspicious activity</p>
              <p>• All API activity is logged for audit trail</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Response Format</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted/50 rounded-lg p-4 text-xs font-mono overflow-x-auto">
{`// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": "Error message description"
}`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
