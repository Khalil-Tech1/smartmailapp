import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Save, Loader2, Trash2, Upload } from 'lucide-react';
import { PRESET_TEMPLATES, type EmailTemplate } from '@/lib/email-templates';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface TemplateSelectorProps {
  onSelect: (template: EmailTemplate) => void;
  selectedId?: string;
}

export default function TemplateSelector({ onSelect, selectedId }: TemplateSelectorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [customTemplates, setCustomTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) loadCustomTemplates();
  }, [user]);

  async function loadCustomTemplates() {
    setLoading(true);
    const { data } = await supabase
      .from('email_templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setCustomTemplates(data.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        description: 'Custom template',
        primaryColor: t.primary_color || '#3b82f6',
        blocks: [
          { id: '1', type: 'heading' as const, content: t.heading, align: 'center' as const },
          { id: '2', type: 'text' as const, content: t.body_text, align: 'left' as const },
          ...(t.cta_text ? [{ id: '3', type: 'button' as const, content: t.cta_text, url: t.cta_url || '', align: 'center' as const }] : []),
          ...(t.footer_text ? [{ id: '4', type: 'footer' as const, content: t.footer_text, align: 'center' as const }] : []),
        ],
      })));
    }
    setLoading(false);
  }

  async function deleteCustomTemplate(id: string) {
    await supabase.from('email_templates').delete().eq('id', id);
    toast({ title: 'Template deleted' });
    loadCustomTemplates();
  }

  const allPreset = PRESET_TEMPLATES;
  const categories = ['all', ...new Set(allPreset.map(t => t.category))];

  const [activeCategory, setActiveCategory] = useState('all');
  const filtered = activeCategory === 'all' ? allPreset : allPreset.filter(t => t.category === activeCategory);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="presets">
        <TabsList className="w-full">
          <TabsTrigger value="presets" className="flex-1">Pre-designed</TabsTrigger>
          <TabsTrigger value="custom" className="flex-1">My Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="presets" className="mt-4">
          <div className="flex gap-2 flex-wrap mb-4">
            {categories.map(cat => (
              <Button
                key={cat}
                size="sm"
                variant={activeCategory === cat ? 'default' : 'outline'}
                onClick={() => setActiveCategory(cat)}
                className="capitalize text-xs"
              >
                {cat}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(template => (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all hover:shadow-md border-2 ${
                  selectedId === template.id ? 'border-primary' : 'border-border/50'
                }`}
                onClick={() => onSelect(template)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ background: template.primaryColor }}
                    />
                  </div>
                  <h4 className="font-semibold text-sm mb-1">{template.name}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                  <Badge variant="secondary" className="mt-2 text-[10px] capitalize">{template.category}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="custom" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : customTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Save className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No saved templates yet.</p>
              <p className="text-xs mt-1">Use the editor to create and save custom templates.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {customTemplates.map(template => (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-all hover:shadow-md border-2 ${
                    selectedId === template.id ? 'border-primary' : 'border-border/50'
                  }`}
                  onClick={() => onSelect(template)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); deleteCustomTemplate(template.id); }}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                    <h4 className="font-semibold text-sm">{template.name}</h4>
                    <Badge variant="secondary" className="mt-2 text-[10px]">Custom</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
