export interface EmailTemplateBlock {
  id: string;
  type: 'heading' | 'text' | 'button' | 'divider' | 'image' | 'footer';
  content: string;
  url?: string;
  align?: 'left' | 'center' | 'right';
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  blocks: EmailTemplateBlock[];
  primaryColor: string;
  previewImage?: string;
}

const uid = () => crypto.randomUUID();

export const PRESET_TEMPLATES: EmailTemplate[] = [
  {
    id: 'welcome',
    name: 'Welcome Email',
    category: 'onboarding',
    description: 'A warm welcome message for new subscribers or users.',
    primaryColor: '#3b82f6',
    blocks: [
      { id: uid(), type: 'heading', content: 'Welcome to Our Community! 🎉', align: 'center' },
      { id: uid(), type: 'text', content: "We're thrilled to have you on board. You've just joined a community of people who care about making great things happen.\n\nHere's what you can expect from us:", align: 'left' },
      { id: uid(), type: 'text', content: '✅ Weekly tips and insights\n✅ Exclusive offers\n✅ Early access to new features', align: 'left' },
      { id: uid(), type: 'button', content: 'Get Started', url: 'https://example.com', align: 'center' },
      { id: uid(), type: 'footer', content: 'Thanks for joining us!\n— The Team', align: 'center' },
    ],
  },
  {
    id: 'product-announcement',
    name: 'Product Announcement',
    category: 'announcement',
    description: 'Announce a new product, feature, or update.',
    primaryColor: '#8b5cf6',
    blocks: [
      { id: uid(), type: 'heading', content: '🚀 Introducing Our Latest Feature', align: 'center' },
      { id: uid(), type: 'text', content: "We've been working hard on something special, and we're excited to share it with you today.", align: 'left' },
      { id: uid(), type: 'text', content: "Here's what's new:\n\n• Faster performance\n• Redesigned dashboard\n• New integrations\n• Enhanced security", align: 'left' },
      { id: uid(), type: 'button', content: 'Learn More', url: 'https://example.com', align: 'center' },
      { id: uid(), type: 'footer', content: 'Have questions? Reply to this email.', align: 'center' },
    ],
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    category: 'newsletter',
    description: 'A classic newsletter layout with multiple sections.',
    primaryColor: '#059669',
    blocks: [
      { id: uid(), type: 'heading', content: '📰 Monthly Newsletter — March 2026', align: 'center' },
      { id: uid(), type: 'text', content: 'Hello! Here is your monthly roundup of the latest news, tips, and updates from our team.', align: 'left' },
      { id: uid(), type: 'divider', content: '' },
      { id: uid(), type: 'heading', content: 'Top Stories This Month', align: 'left' },
      { id: uid(), type: 'text', content: '1. Our platform reached 10,000 users\n2. New partnership announcement\n3. Community spotlight: How Jane uses our tool', align: 'left' },
      { id: uid(), type: 'divider', content: '' },
      { id: uid(), type: 'button', content: 'Read Full Newsletter', url: 'https://example.com', align: 'center' },
      { id: uid(), type: 'footer', content: 'You received this because you subscribed to our newsletter.', align: 'center' },
    ],
  },
  {
    id: 'promotional',
    name: 'Promotional Offer',
    category: 'marketing',
    description: 'Drive sales with a promotional offer or discount.',
    primaryColor: '#dc2626',
    blocks: [
      { id: uid(), type: 'heading', content: '🔥 Flash Sale — 50% Off Everything!', align: 'center' },
      { id: uid(), type: 'text', content: "For the next 48 hours, enjoy half off our entire catalog. Don't miss out on this limited-time offer!", align: 'center' },
      { id: uid(), type: 'text', content: 'Use code: FLASH50 at checkout', align: 'center' },
      { id: uid(), type: 'button', content: 'Shop Now', url: 'https://example.com', align: 'center' },
      { id: uid(), type: 'text', content: '⏰ Offer expires in 48 hours', align: 'center' },
      { id: uid(), type: 'footer', content: 'Terms and conditions apply. Cannot be combined with other offers.', align: 'center' },
    ],
  },
  {
    id: 'follow-up',
    name: 'Follow Up',
    category: 'engagement',
    description: 'Re-engage users who have gone quiet.',
    primaryColor: '#f59e0b',
    blocks: [
      { id: uid(), type: 'heading', content: "Hey, we miss you! 👋", align: 'center' },
      { id: uid(), type: 'text', content: "It's been a while since we last heard from you. We wanted to check in and let you know about some exciting updates we've made.", align: 'left' },
      { id: uid(), type: 'text', content: "Since you've been away:\n\n🆕 New dashboard design\n⚡ 2x faster performance\n🎁 Special offer just for you", align: 'left' },
      { id: uid(), type: 'button', content: 'Come Back & Explore', url: 'https://example.com', align: 'center' },
      { id: uid(), type: 'footer', content: "We'd love to have you back. If you have any questions, just reply!", align: 'center' },
    ],
  },
  {
    id: 'event-invitation',
    name: 'Event Invitation',
    category: 'events',
    description: 'Invite recipients to an event, webinar, or meetup.',
    primaryColor: '#0891b2',
    blocks: [
      { id: uid(), type: 'heading', content: "🎤 You're Invited!", align: 'center' },
      { id: uid(), type: 'text', content: "Join us for an exclusive live event where we'll share insights, answer questions, and connect with our community.", align: 'center' },
      { id: uid(), type: 'divider', content: '' },
      { id: uid(), type: 'text', content: '📅 Date: April 15, 2026\n🕐 Time: 2:00 PM EST\n📍 Location: Online (Zoom)\n🎟️ Free admission', align: 'left' },
      { id: uid(), type: 'divider', content: '' },
      { id: uid(), type: 'button', content: 'Register Now', url: 'https://example.com', align: 'center' },
      { id: uid(), type: 'footer', content: 'Spots are limited. Reserve yours today!', align: 'center' },
    ],
  },
];

export function blocksToHtml(blocks: EmailTemplateBlock[], primaryColor: string): string {
  return blocks.map(block => {
    switch (block.type) {
      case 'heading':
        return `<h2 style="color: #1a1a2e; font-size: 22px; font-weight: 700; text-align: ${block.align || 'left'}; margin: 0 0 16px;">${block.content}</h2>`;
      case 'text':
        return `<p style="color: #4a4a5a; font-size: 15px; line-height: 1.7; text-align: ${block.align || 'left'}; margin: 0 0 16px; white-space: pre-wrap;">${block.content}</p>`;
      case 'button':
        return `<div style="text-align: ${block.align || 'center'}; margin: 24px 0;"><a href="${block.url || '#'}" style="background: ${primaryColor}; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">${block.content}</a></div>`;
      case 'divider':
        return `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />`;
      case 'image':
        return `<div style="text-align: ${block.align || 'center'}; margin: 16px 0;"><img src="${block.url || ''}" alt="" style="max-width: 100%; border-radius: 8px;" /></div>`;
      case 'footer':
        return `<p style="color: #9ca3af; font-size: 12px; text-align: ${block.align || 'center'}; margin: 24px 0 0; white-space: pre-wrap;">${block.content}</p>`;
      default:
        return '';
    }
  }).join('\n');
}

export function wrapInEmailHtml(innerHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
  <div style="padding: 30px; border-radius: 12px; border: 1px solid #e5e7eb;">
    ${innerHtml}
  </div>
  <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 24px;">Sent via SmartMail</p>
</body>
</html>`;
}
