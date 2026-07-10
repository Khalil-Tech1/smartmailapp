## Root cause

The tier-inheritance code from last turn is correct, but the invitee's browser can't actually read the owner's tier. The `profiles` table only has one SELECT policy:

```
Users can view their own profile — auth.uid() = user_id
```

So when `useActiveTeam` runs:

```ts
supabase.from('profiles').select('subscription_tier, trial_end').eq('user_id', activeTeam.ownerId)
```

RLS silently returns no rows. `ownerTier` stays `null`, `useEffectiveTier()` falls back to `'free'`, and `Campaigns.tsx` renders the "Pro Plan Required" locked overlay even though the owner is on Pro.

The same silent-empty read is why the account switcher shows "Owner's Account" instead of the owner's real name — the owner-profile lookup in `useActiveTeam.load()` is blocked too.

## Fix

Add one RLS policy on `public.profiles` that lets a team member read the profile row of an account they belong to. Reuse the existing `is_team_member_of_owner` security-definer function so we don't introduce recursion.

```sql
CREATE POLICY "Team members can view owner profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_team_member_of_owner(user_id, ARRAY['admin','editor','viewer']));
```

That's the whole change. No client code touched — the existing `useActiveTeam` fetch and `useEffectiveTier` hook will now see the owner's `subscription_tier` / `trial_end` and unlock Pro/Business features for members in the owner's workspace (with role gates still applied by the other tables' policies).

## Out of scope

- No new columns, no schema changes, no code edits.
- Doesn't broaden profile visibility beyond members of the same account (the definer function already scopes to `team_members` rows the caller belongs to).
- Personal-account isolation is unchanged: members querying their own profile still hit the existing self-policy; owner-tier lookup is skipped entirely when `activeTeam.role === 'owner'`.

## Files touched

- one new Supabase migration adding the policy above.
