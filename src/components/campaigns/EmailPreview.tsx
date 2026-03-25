import { type EmailTemplateBlock, blocksToHtml, wrapInEmailHtml } from '@/lib/email-templates';

interface EmailPreviewProps {
  blocks: EmailTemplateBlock[];
  primaryColor: string;
  subject?: string;
}

export default function EmailPreview({ blocks, primaryColor, subject }: EmailPreviewProps) {
  const innerHtml = blocksToHtml(blocks, primaryColor);
  const fullHtml = wrapInEmailHtml(innerHtml);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
      {subject && (
        <div className="bg-card border-b border-border px-4 py-2.5">
          <p className="text-xs text-muted-foreground">Subject</p>
          <p className="text-sm font-medium truncate">{subject}</p>
        </div>
      )}
      <div className="p-4">
        <iframe
          srcDoc={fullHtml}
          className="w-full border-0 rounded bg-white"
          style={{ minHeight: 400 }}
          sandbox="allow-same-origin"
          title="Email Preview"
        />
      </div>
    </div>
  );
}
