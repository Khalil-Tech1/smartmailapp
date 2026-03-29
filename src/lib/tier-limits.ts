export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'business';

export interface TierLimits {
  maxGroups: number;
  maxMembersPerGroup: number;
  maxEmailsPerMonth: number;
  maxTeamMembers: number;
  scheduledSending: boolean;
  emailTemplates: boolean;
  templateCount: number;
  templateBuilder: boolean;
  campaignAnalytics: boolean;
  abTesting: boolean;
  contactTagging: boolean;
  unsubscribeManagement: boolean;
  customBranding: boolean;
  customSignature: boolean;
  removeBadge: boolean;
  price: number;
  label: string;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxGroups: 4,
    maxMembersPerGroup: 5,
    maxEmailsPerMonth: 500,
    maxTeamMembers: 1,
    scheduledSending: false,
    emailTemplates: false,
    templateCount: 0,
    templateBuilder: false,
    campaignAnalytics: false,
    abTesting: false,
    contactTagging: false,
    unsubscribeManagement: false,
    customBranding: false,
    customSignature: false,
    removeBadge: false,
    price: 0,
    label: 'Free',
  },
  basic: {
    maxGroups: 10,
    maxMembersPerGroup: 50,
    maxEmailsPerMonth: 5000,
    maxTeamMembers: 2,
    scheduledSending: true,
    emailTemplates: false,
    templateCount: 0,
    templateBuilder: false,
    campaignAnalytics: false,
    abTesting: false,
    contactTagging: false,
    unsubscribeManagement: false,
    customBranding: false,
    customSignature: true,
    removeBadge: false,
    price: 9,
    label: 'Basic',
  },
  pro: {
    maxGroups: 20,
    maxMembersPerGroup: 200,
    maxEmailsPerMonth: 20000,
    maxTeamMembers: 3,
    scheduledSending: true,
    emailTemplates: true,
    templateCount: 6,
    templateBuilder: false,
    campaignAnalytics: true,
    abTesting: false,
    contactTagging: false,
    unsubscribeManagement: false,
    customBranding: true,
    customSignature: true,
    removeBadge: true,
    price: 19,
    label: 'Pro',
  },
  business: {
    maxGroups: 50,
    maxMembersPerGroup: 500,
    maxEmailsPerMonth: 50000,
    maxTeamMembers: 5,
    scheduledSending: true,
    emailTemplates: true,
    templateCount: 10,
    templateBuilder: true,
    campaignAnalytics: true,
    abTesting: true,
    contactTagging: true,
    unsubscribeManagement: true,
    customBranding: true,
    customSignature: true,
    removeBadge: true,
    price: 35,
    label: 'Business',
  },
};
