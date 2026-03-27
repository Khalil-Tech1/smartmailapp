export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'business' | 'enterprise';

export interface TierLimits {
  maxGroups: number | null; // null = unlimited
  maxMembersPerGroup: number | null; // null = unlimited
  maxEmailsPerMonth: number | null; // null = unlimited
  maxTeamMembers: number | null; // null = unlimited
  voiceNotes: boolean;
  aiMessages: boolean;
  scheduledSending: boolean;
  emailMarketing: boolean;
  customBranding: boolean;
  apiAccess: boolean;
  price: number;
  label: string;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxGroups: 5,
    maxMembersPerGroup: 10,
    maxEmailsPerMonth: 500,
    maxTeamMembers: null,
    voiceNotes: false,
    aiMessages: false,
    scheduledSending: false,
    emailMarketing: false,
    customBranding: false,
    apiAccess: false,
    price: 0,
    label: 'Free',
  },
  basic: {
    maxGroups: 10,
    maxMembersPerGroup: 50,
    maxEmailsPerMonth: 5000,
    maxTeamMembers: null,
    voiceNotes: true,
    aiMessages: true,
    scheduledSending: false,
    emailMarketing: false,
    customBranding: false,
    apiAccess: false,
    price: 19,
    label: 'Basic',
  },
  pro: {
    maxGroups: 20,
    maxMembersPerGroup: 200,
    maxEmailsPerMonth: 20000,
    maxTeamMembers: 5,
    voiceNotes: true,
    aiMessages: true,
    scheduledSending: true,
    emailMarketing: false,
    customBranding: false,
    apiAccess: false,
    price: 31,
    label: 'Pro',
  },
  business: {
    maxGroups: 50,
    maxMembersPerGroup: 500,
    maxEmailsPerMonth: 50000,
    maxTeamMembers: 15,
    voiceNotes: true,
    aiMessages: true,
    scheduledSending: true,
    emailMarketing: true,
    customBranding: false,
    apiAccess: false,
    price: 45,
    label: 'Business',
  },
  enterprise: {
    maxGroups: null,
    maxMembersPerGroup: null,
    maxEmailsPerMonth: 250000,
    maxTeamMembers: null,
    voiceNotes: true,
    aiMessages: true,
    scheduledSending: true,
    emailMarketing: true,
    customBranding: true,
    apiAccess: true,
    price: 99,
    label: 'Enterprise',
  },
};
