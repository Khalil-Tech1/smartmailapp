import { useAuth } from '@/hooks/useAuth';
import { useActiveTeam, type ActiveTeamRole } from '@/hooks/useActiveTeam';
import { TIER_LIMITS, type SubscriptionTier, type TierLimits } from '@/lib/tier-limits';

interface EffectiveTier {
  /** The tier whose features/quotas should govern the current context. */
  tier: SubscriptionTier;
  limits: TierLimits;
  /** Role in the active account context ('owner' when it's the user's personal account). */
  role: ActiveTeamRole;
  /** True when the user is operating in their own personal account. */
  isPersonalContext: boolean;
  /** True when the user is operating in an account they own (personal or a team they own). */
  isOwnerContext: boolean;
}

/**
 * Returns the tier that should gate features for the current active account.
 *
 * - Personal / owner context → the signed-in user's own tier.
 * - Invited into someone else's account → that owner's current tier.
 *
 * Role restrictions (admin/editor/viewer) still apply on top and are enforced
 * separately by RLS + role checks.
 */
export function useEffectiveTier(): EffectiveTier {
  const { tier: personalTier } = useAuth();
  const { activeTeam, ownerTier } = useActiveTeam();
  const isPersonalContext = activeTeam.id === 'personal';
  const isOwnerContext = activeTeam.role === 'owner';
  const tier: SubscriptionTier = isOwnerContext ? personalTier : (ownerTier ?? 'free');
  return {
    tier,
    limits: TIER_LIMITS[tier],
    role: activeTeam.role,
    isPersonalContext,
    isOwnerContext,
  };
}
