import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  GripVertical, Trash2, Plus, Type, AlignLeft, MousePointer,
  Minus, Image, FileText, Save, Loader2
} from 'lucide-react';
import { type EmailTemplateBlock } from '@/lib/email-templates';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface EmailBlockEditorProps {
  blocks: EmailTemplateBlock[];
  onChange: (blocks: EmailTemplateBlock[]) => void;
  primaryColor: string;
  onColorChange: (color: string) => void;
}

export default function EmailBlockEditor({ blocks, onChange, primaryColor, onColorChange }: EmailBlockEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState('');

  function updateBlock(id: string, updates: Partial<EmailTemplateBlock>) {
    onChange(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
  }

  function removeBlock(id: string) {
    onChange(blocks.filter(b => b.id !== id));
  }

  function addBlock(type: EmailTemplateBlock['type']) {
    const newBlock: EmailTemplateBlock = {
      id: crypto.randomUUID(),
      type,
      content: type === 'divider' ? '' : type === 'heading' ? 'New Heading' : type === 'button' ? 'Click Here' : type === 'footer' ? 'Footer text' : 'Your text here',
      align: 'left',
      url: type === 'button' ? 'https://' : undefined,
    };
    onChange([...blocks, newBlock]);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    const newBlocks = [...blocks];
    [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
    onChange(newBlocks);
  }

  async function saveAsTemplate() {
    if (!user || !templateName.trim()) {
      toast({ title: 'Enter a template name', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const heading = blocks.find(b => b.type === 'heading')?.content || '';
    const bodyText = blocks.filter(b => b.type === 'text').map(b => b.content).join('\n\n');
    const cta = blocks.find(b => b.type === 'button');
    const footer = blocks.find(b => b.type === 'footer');

    const { error } = await supabase.from('email_templates').insert({
      user_id: user.id,
      name: templateName.trim(),
      category: 'custom',
      heading,
      body_text: bodyText,
      cta_text: cta?.content || '',
      cta_url: cta?.url || '',
      footer_text: footer?.content || '',
      primary_color: primaryColor,
    });
    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Template saved!' });
      setTemplateName('');
    }
    setSaving(false);
  }

  const blockTypeIcon = (type: string) => {
    switch (type) {
      case 'heading': return <Type className="w-3.5 h-3.5" />;
      case 'text': return <AlignLeft className="w-3.5 h-3.5" />;
      case 'button': return <MousePointer className="w-3.5 h-3.5" />;
      case 'divider': return <Minus className="w-3.5 h-3.5" />;
      case 'image': return <Image className="w-3.5 h-3.5" />;
      case 'footer': return <FileText className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label className="text-xs">Brand Color</Label>
        <input
          type="color"
          value={primaryColor}
          onChange={e => onColorChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0"
        />
        <span className="text-xs text-muted-foreground">{primaryColor}</span>
      </div>

      <div className="space-y-2">
        {blocks.map((block, index) => (
          <Card key={block.id} className="p-3 border-border/50">
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-1 pt-1">
                <button onClick={() => moveBlock(index, -1)} className="text-muted-foreground hover:text-foreground" disabled={index === 0}>
                  <GripVertical className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  {blockTypeIcon(block.type)}
                  <span className="text-xs font-medium capitalize">{block.type}</span>
                  <Select value={block.align || 'left'} onValueChange={v => updateBlock(block.id, { align: v as any })}>
                    <SelectTrigger className="w-24 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {block.type === 'divider' ? (
                  <hr className="border-border" />
                ) : block.type === 'heading' ? (
                  <Input
                    value={block.content}
                    onChange={e => updateBlock(block.id, { content: e.target.value })}
                    className="text-sm font-semibold h-8"
                  />
                ) : (
                  <Textarea
                    value={block.content}
                    onChange={e => updateBlock(block.id, { content: e.target.value })}
                    className="text-sm min-h-[60px]"
                  />
                )}
                {block.type === 'button' && (
                  <Input
                    placeholder="Button URL"
                    value={block.url || ''}
                    onChange={e => updateBlock(block.id, { url: e.target.value })}
                    className="text-xs h-7"
                  />
                )}
                {block.type === 'image' && (
                  <Input
                    placeholder="Image URL"
                    value={block.url || ''}
                    onChange={e => updateBlock(block.id, { url: e.target.value })}
                    className="text-xs h-7"
                  />
                )}
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeBlock(block.id)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['heading', 'text', 'button', 'divider', 'footer'] as const).map(type => (
          <Button key={type} size="sm" variant="outline" onClick={() => addBlock(type)} className="text-xs gap-1">
            <Plus className="w-3 h-3" /> {type}
          </Button>
        ))}
      </div>

      <div className="border-t border-border pt-4 mt-4">
        <Label className="text-xs mb-2 block">Save as Custom Template</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Template name..."
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            className="text-sm h-9"
          />
          <Button size="sm" onClick={saveAsTemplate} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
