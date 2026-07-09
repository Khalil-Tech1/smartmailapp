## Goal
When an invited team member switches into an owner's account (via the sidebar account switcher), the app should behave as if they're on the **owner's current tier**. When they switch back to "My Account," they see their own personal tier (Free by default). Role gates (admin/editor/viewer) continue to apply on top.

## What's wrong today
`useAuth().tier` reads the signed-in user's own `profiles.subscription_tier`. Every gate in the app (`DashboardSidebar`, `Billing`, `Campaigns`, `Teams`, `ComposeEmail`, etc.) reads `tier` from `useAuth`, so an invitee sees Free even while operating in a Pro owner's account.

## Approach

### 1. Expose the owner's tier via `ActiveTeamProvider`
- Extend `useActiveTeam` to also fetch the owner's `subscription_tier` + `trial_end` from `profiles` whenever the active team changes (and on `refresh()`).
- Add `ownerTier`, `ownerTrialEnd`, `isOwnerOnTrial` to the context. Handle expired trials the same way `useAuth.fetchProfile` does (treat as free).
- Re-fetch on window focus so downgrades propagate quickly (matches "owner's current tier always").

### 2. New `useEffectiveTier()` hook
- Returns `{ tier, limits, role, isOwnerContext, isPersonalContext }`.
- If `activeTeam.role === 'owner'` → use `useAuth().tier` (personal account, unchanged).
- Otherwise → use `activeTeam.ownerTier` (invitee viewing the owner's workspace).
- Central place so we don't touch every consumer twice.

### 3. Swap tier reads in gated UI
Replace `useAuth().tier` with `useEffectiveTier().tier` in:
- `src/components/DashboardSidebar.tsx` (nav lock badges, tier label pill)
- `src/pages/DashboardOverview.tsx`, `Campaigns.tsx`, `MailGroups.tsx`, `ComposeEmail.tsx`, `SentEmails.tsx`, `Teams.tsx`, `DashboardSettings.tsx` — anywhere tier-based feature gates or quota limits are read.
- Leave `useAuth().tier` in place for **personal-only** surfaces: `Billing.tsx` (shows/edits the signed-in user's own subscription), account deletion, trial-start button.

### 4. Keep role gates
No change to role logic. `useEffectiveTier` still returns `activeTeam.role`, and existing checks (owner-only routes in the sidebar, `is_team_member_of_owner` RLS) continue to enforce what an admin/editor/viewer can do inside the owner's account.

### 5. Billing page guard
`Billing.tsx` should only manage the signed-in user's own plan. When `activeTeam.role !== 'owner'` we already hide it from the sidebar; also add a defensive redirect from `Billing` to `/dashboard` if the active context is not personal, so a direct URL visit doesn't let a member "manage" someone else's plan.

## Out of scope
- No DB/schema/RLS changes — RLS already scopes data by `owner_id` via `is_team_member_of_owner`, so features unlock purely on the client based on the owner's tier. Server-side enforcement (edge functions checking owner tier before send) can be a follow-up if needed.
- No changes to invite acceptance, ownership transfer, or personal billing behavior.

## Files touched
- `src/hooks/useActiveTeam.tsx` — fetch + expose `ownerTier`
- `src/hooks/useEffectiveTier.ts` — new hook
- `src/components/DashboardSidebar.tsx`
- `src/pages/DashboardOverview.tsx`, `Campaigns.tsx`, `MailGroups.tsx`, `ComposeEmail.tsx`, `SentEmails.tsx`, `Teams.tsx`, `DashboardSettings.tsx`, `Billing.tsx` (redirect guard only)
