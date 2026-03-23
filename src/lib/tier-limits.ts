export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'business';

export interface TierLimits {
  maxGroups: number;
  maxMembersPerGroup: number;
  voiceNotes: boolean;
  aiMessages: boolean;
  scheduledSending: boolean;
  emailMarketing: boolean;
  price: number;
  label: string;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxGroups: 4,
    maxMembersPerGroup: 5,
    voiceNotes: false,
    aiMessages: false,
    scheduledSending: false,
    emailMarketing: false,
    price: 0,
    label: 'Free',
  },
  basic: {
    maxGroups: 5,
    maxMembersPerGroup: 10,
    voiceNotes: true,
    aiMessages: true,
    scheduledSending: false,
    emailMarketing: false,
    price: 19,
    label: 'Basic',
  },
  pro: {
    maxGroups: 15,
    maxMembersPerGroup: 25,
    voiceNotes: true,
    aiMessages: true,
    scheduledSending: true,
    emailMarketing: false,
    price: 31,
    label: 'Pro',
  },
  business: {
    maxGroups: 30,
    maxMembersPerGroup: 15,
    voiceNotes: true,
    aiMessages: true,
    scheduledSending: true,
    emailMarketing: true,
    price: 45,
    label: 'Business',
  },
};
