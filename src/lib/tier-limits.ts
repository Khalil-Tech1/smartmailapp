export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'business';

export interface TierLimits {
  maxGroups: number | null;
  maxMembersPerGroup: number | null;
  maxEmailsPerMonth: number | null;
  maxTeamMembers: number | null;
  voiceNotes: boolean;
  aiMessages: boolean;
  scheduledSending: boolean;
  emailMarketing: boolean;
  campaignManagement: boolean;
  transferOwnership: boolean;
  price: number;
  label: string;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxGroups: 4,
    maxMembersPerGroup: 10,
    maxEmailsPerMonth: 500,
    maxTeamMembers: null,
    voiceNotes: true,
    aiMessages: false,
    scheduledSending: false,
    emailMarketing: false,
    campaignManagement: false,
    transferOwnership: false,
    price: 0,
    label: 'Free',
  },
  basic: {
    maxGroups: 10,
    maxMembersPerGroup: 50,
    maxEmailsPerMonth: 5000,
    maxTeamMembers: null,
    voiceNotes: true,
    aiMessages: false,
    scheduledSending: true,
    emailMarketing: false,
    campaignManagement: false,
    transferOwnership: false,
    price: 13,
    label: 'Basic',
  },
  pro: {
    maxGroups: 20,
    maxMembersPerGroup: 200,
    maxEmailsPerMonth: 20000,
    maxTeamMembers: 3,
    voiceNotes: true,
    aiMessages: false,
    scheduledSending: true,
    emailMarketing: true,
    campaignManagement: true,
    transferOwnership: false,
    price: 22,
    label: 'Pro',
  },
  business: {
    maxGroups: 50,
    maxMembersPerGroup: 500,
    maxEmailsPerMonth: 50000,
    maxTeamMembers: 6,
    voiceNotes: true,
    aiMessages: false,
    scheduledSending: true,
    emailMarketing: true,
    campaignManagement: true,
    transferOwnership: true,
    price: 35,
    label: 'Business',
  },
};
