import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import { PRESET_TEMPLATES, type EmailTemplate } from '@/lib/email-templates';

interface TemplateSelectorProps {
  onSelect: (template: EmailTemplate) => void;
  selectedId?: string;
}

export default function TemplateSelector({ onSelect, selectedId }: TemplateSelectorProps) {
  const allPreset = PRESET_TEMPLATES;
  const categories = ['all', ...new Set(allPreset.map(t => t.category))];
  const [activeCategory, setActiveCategory] = useState('all');
  const filtered = activeCategory === 'all' ? allPreset : allPreset.filter(t => t.category === activeCategory);

  return (
    <div className="space-y-4">
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
    </div>
  );
}
