import { useEffect, useState } from 'react';
import { Bold, Italic, Link as LinkIcon, CornerDownLeft, Lock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const MAX_SIG = 500;

function sanitizeSignature(html: string) {
  // Strip everything except b, strong, i, em, a (with safe href), br
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const walk = (node: Element) => {
    Array.from(node.children).forEach(child => {
      const tag = child.tagName.toLowerCase();
      const allowed = ['b', 'strong', 'i', 'em', 'a', 'br'];
      if (!allowed.includes(tag)) {
        child.replaceWith(...Array.from(child.childNodes));
      } else if (tag === 'a') {
        const href = child.getAttribute('href') || '';
        if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
          child.replaceWith(...Array.from(child.childNodes));
          return;
        }
        Array.from(child.attributes).forEach(a => {
          if (a.name !== 'href') child.removeAttribute(a.name);
        });
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noopener noreferrer');
        walk(child);
      } else {
        walk(child);
      }
    });
  };
  walk(tmp);
  return tmp.innerHTML;
}

export default function EmailIdentitySection() {
  const { user, tier } = useAuth();
  const { toast } = useToast();
  const [senderName, setSenderName] = useState('');
  const [signature, setSignature] = useState('');
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState('#3B82F6');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const canCustomSender = tier === 'pro' || tier === 'business';
  const canSignature = tier === 'basic' || tier === 'pro' || tier === 'business';
  const canBranding = tier === 'business';

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('sender_name, email_signature, brand_logo_url, brand_color')
        .eq('user_id', user.id)
        .maybeSingle();
      setSenderName(data?.sender_name || '');
      setSignature(data?.email_signature || '');
      setBrandLogoUrl((data as any)?.brand_logo_url || '');
      setBrandColor((data as any)?.brand_color || '#3B82F6');
      setLoading(false);
    })();
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const payload: any = {};
    if (canCustomSender) payload.sender_name = senderName.trim() || null;
    if (canSignature) payload.email_signature = sanitizeSignature(signature).slice(0, MAX_SIG) || null;
    if (canBranding) {
      const url = brandLogoUrl.trim();
      payload.brand_logo_url = url && /^https?:\/\//i.test(url) ? url : null;
      payload.brand_color = /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : null;
    }
    const { error } = await supabase.from('profiles').update(payload).eq('user_id', user.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Email identity saved' });
    }
  }

  function wrap(tag: 'b' | 'i') {
    const el = document.getElementById('sig-editor') as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = signature.slice(0, start);
    const sel = signature.slice(start, end) || (tag === 'b' ? 'bold text' : 'italic text');
    const after = signature.slice(end);
    setSignature(`${before}<${tag}>${sel}</${tag}>${after}`);
  }

  function insertLink() {
    const url = window.prompt('Enter URL (must start with http:// or https://)');
    if (!url) return;
    const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const label = window.prompt('Link text', safe) || safe;
    setSignature(prev => `${prev}<a href="${safe}">${label}</a>`);
  }

  const remaining = MAX_SIG - signature.length;
  const previewFrom = canCustomSender && senderName.trim()
    ? `${senderName.trim()} <hello@smartmail.ink>`
    : 'SmartMail <hello@smartmail.ink>';

  if (loading) return null;

  return (
    <Card className="max-w-3xl border-border/50 mb-6">
      <CardHeader>
        <CardTitle className="font-display">Email Identity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Sender Name */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>Sender Name</Label>
            {!canCustomSender && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
          {canCustomSender ? (
            <>
              <Input
                placeholder="e.g. Lagos Tech Ltd"
                value={senderName}
                maxLength={80}
                onChange={e => setSenderName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your emails will appear as: <span className="font-medium text-foreground">{previewFrom}</span>
              </p>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground flex items-center gap-2">
              <Lock className="w-4 h-4" /> Upgrade to Pro to customize your sender name
            </div>
          )}
        </div>

        {/* Signature */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>Email Signature</Label>
            {!canSignature && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
          {canSignature ? (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex gap-1 flex-wrap">
                  <Button type="button" variant="outline" size="sm" onClick={() => wrap('b')} className="h-8 px-2">
                    <Bold className="w-3.5 h-3.5" />
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => wrap('i')} className="h-8 px-2">
                    <Italic className="w-3.5 h-3.5" />
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={insertLink} className="h-8 px-2">
                    <LinkIcon className="w-3.5 h-3.5" />
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setSignature(s => s + '<br>')} className="h-8 px-2">
                    <CornerDownLeft className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <Textarea
                  id="sig-editor"
                  value={signature}
                  onChange={e => setSignature(e.target.value.slice(0, MAX_SIG))}
                  placeholder={'John Adeleke\nCEO Lagos Tech Ltd\n08012345678'}
                  className="min-h-[160px] font-mono text-xs"
                />
                <p className={`text-xs ${remaining < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {remaining} characters remaining
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Live preview</Label>
                <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm min-h-[160px]">
                  <hr className="border-border mb-3" />
                  <div
                    className="text-muted-foreground leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: sanitizeSignature(signature) || '<em>Your signature will appear here</em>' }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground flex items-center gap-2">
              <Lock className="w-4 h-4" /> Upgrade to Basic to add your email signature
            </div>
          )}
        </div>

        {/* Custom Branding (Business only) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>Custom Branding</Label>
            {!canBranding && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
          {canBranding ? (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Logo URL</Label>
                <Input
                  placeholder="https://yourdomain.com/logo.png"
                  value={brandLogoUrl}
                  onChange={e => setBrandLogoUrl(e.target.value)}
                />
                <Label className="text-xs">Brand Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={e => setBrandColor(e.target.value)}
                    className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer"
                  />
                  <Input
                    value={brandColor}
                    onChange={e => setBrandColor(e.target.value)}
                    placeholder="#3B82F6"
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Live preview</Label>
                <div className="rounded-md border border-border bg-background overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: brandColor }}>
                    {brandLogoUrl && /^https?:\/\//i.test(brandLogoUrl) ? (
                      <img src={brandLogoUrl} alt="Brand" className="h-8 max-w-[140px] object-contain bg-white/90 rounded px-2 py-1" />
                    ) : (
                      <div className="text-white font-semibold text-sm">Your Logo</div>
                    )}
                  </div>
                  <div className="px-4 py-3 text-xs text-muted-foreground">Email content will appear here…</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground flex items-center gap-2">
              <Lock className="w-4 h-4" /> Upgrade to Business to add your logo and brand color to emails
            </div>
          )}
        </div>

        <Button variant="gradient" onClick={save} disabled={saving || (!canCustomSender && !canSignature && !canBranding)}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Email Identity
        </Button>

      </CardContent>
    </Card>
  );
}
