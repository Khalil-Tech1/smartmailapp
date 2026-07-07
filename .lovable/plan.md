# Plan: Billing tweak + Team Invites rebuild

## 1. Billing page — Business tier

- On `src/pages/Billing.tsx`, in the Business plan feature list, add the item **"Transfer team ownership"** so it matches the homepage pricing card.
- No other billing change.

## 2. Team Invites — full rebuild

### 2a. Database migration

Add the missing columns and helpers to make token-based invites work:

- `team_invites`: add `token TEXT UNIQUE`, `expires_at TIMESTAMPTZ`, and extend status to allow `pending | accepted | expired | cancelled` (kept as `TEXT` for flexibility).
- `team_members`: add `email TEXT` (denormalized copy so the UI can show who a member is without a join to `auth.users`).
- New index on `team_invites(token)` and `team_invites(email, status)`.
- New RLS policy: allow any authenticated user to **read a single invite row by token** (needed for the acceptance page before the user is on the team). Owner/team scoped policies stay as-is for list/update.
- New SECURITY DEFINER function `public.accept_team_invite(_token text)` that, running as the caller (`auth.uid()`):
  1. Loads the invite by token.
  2. Rejects if not `pending`, expired, or email mismatch with the caller's `auth.users.email`.
  3. Inserts the caller into `team_members` (idempotent — no-op if already a member).
  4. Marks the invite `accepted`.
  5. Returns the `team_id` so the client can redirect.

### 2b. Invite send flow (`src/pages/Teams.tsx`)

- Generate a token with `crypto.randomUUID()` (or `gen_random_uuid()` DB-side) on invite creation.
- Set `expires_at = now() + 48h`, `status = 'pending'`.
- Email body's Accept button links to `${window.location.origin}/invite?token=<token>` instead of the current `/auth?invite_email=...` URL.
- Subject and body updated to the spec wording (owner name, role, 48h expiry, role capability line).
- Add per-invite actions in the Teams UI:
  - **Resend**: sets old invite to `cancelled`, inserts a new one with a fresh token, resends the email.
  - **Cancel**: sets `status = 'cancelled'`.
- Show a "Pending invites" section listing pending invites with email, role, expiry, and Resend/Cancel buttons.

### 2c. Invite acceptance page — new route `/invite`

New file `src/pages/InviteAccept.tsx`, wired in `src/App.tsx` as `<Route path="/invite" element={<InviteAccept />} />`.

Behavior:

1. Read `token` from the URL.
2. Fetch the invite row via a `read_invite_by_token` path (RLS allows selecting a single row by matching token).
3. Validate:
   - Missing token / no row → "This invitation link is invalid or has already been used."
   - `status = 'expired'` or `expires_at < now()` → "This invitation has expired. Please ask the account owner to send a new invitation." (also flip DB status to `expired`.)
   - `status = 'cancelled'` → invalid-link message.
   - `status = 'accepted'` → "This invitation has already been accepted. Please log in to access the account."
4. If valid and user is signed out:
   - Show a branded card explaining the invite ("You've been invited to join **[Owner Name]**'s SmartMail account as a **[Role]**").
   - Buttons: **Sign up** and **Sign in** — both link to `/auth?next=/invite?token=<token>` (Auth.tsx already honors `next`).
   - After auth, they land back on `/invite` with the same token; the page auto-runs the accept RPC when a session is present AND email matches.
5. If valid and user is signed in:
   - If session email ≠ invite email → show "This invite was sent to <email>. Please sign in with that email." with a Sign-out link.
   - Otherwise show **Accept invitation** and **Decline** buttons.
6. On Accept: call `supabase.rpc('accept_team_invite', { _token })`, then navigate to `/dashboard?team=<team_id>` (account switcher below reads this).
7. On Decline: mark invite `cancelled`, redirect to `/`.

### 2d. Account switcher + active-team context

- New `src/hooks/useActiveTeam.tsx` context, mounted inside `AuthProvider`. It exposes:
  - `activeTeamId` (null = personal account, else the team's id)
  - `activeTeam` (name, owner_id, role — role is `'owner'` for personal or the joined role for a team)
  - `availableTeams` (personal + every team the user owns or is a member of)
  - `setActiveTeam(teamId | null)` — persists to `localStorage` under `smartmail.activeTeam`.
- On mount, if `?team=<id>` is in the URL, adopt it; else use localStorage; else personal.
- Add a compact switcher to `DashboardSidebar` (above the nav) showing the current context and a dropdown with "My Account" plus each shared team labeled "[Owner Name]'s Account". Owner names come from `profiles.full_name` (fallback to email prefix). Selecting an option calls `setActiveTeam` and hard-reloads the dashboard.

### 2e. Scoping data by active team + role

Data pages need to read as owner when a team is active. Two changes:

- **RLS additions** (same migration): extend SELECT policies on `mail_groups`, `group_members`, `sent_emails`, `email_campaigns` to also allow rows where `user_id` equals a team owner whose team the caller belongs to. Extend INSERT/UPDATE/DELETE similarly but gated by role:
  - `admin`: full CRUD on owner's data except billing/team settings.
  - `editor`: SELECT/INSERT/UPDATE (no DELETE, no `sent_emails` insert / send action).
  - `viewer`: SELECT only.
- **Client**: pages that write with `user_id: user.id` (MailGroups, ComposeEmail, Campaigns) switch to `user_id: activeTeam?.ownerId ?? user.id` so inserts land on the owner's data when a team is active. Reads already benefit from the widened RLS.
- **Nav gating** in `DashboardSidebar`: hide **Billing**, **Teams**, **Settings** when `activeTeam.role !== 'owner'`. Hide **Send** buttons for editors/viewers. Disable edit UI entirely for viewers.

### 2f. Auth flow tweaks

- `useAuth.processPendingInvites` is removed (its email-match auto-join is superseded by the token flow). This also removes the current bug where it tries to insert `email` into `team_members`.
- `Auth.tsx` already honors `?next=...`. No change beyond re-verifying that both Sign in and Sign up redirect through `next`.

### 2g. Error states / edge cases

- Token page handles all four spec states (valid, expired, invalid, already accepted, cancelled) with matching copy.
- Accept RPC is idempotent — clicking a stale link that already added them just redirects to the owner's dashboard.
- Rate-limiting isn't added (out of scope; not requested).

## Technical notes

- `crypto.randomUUID()` gives a strong 128-bit token; stored `UNIQUE` in `team_invites.token`.
- The accept RPC is `SECURITY DEFINER` with `SET search_path = public` and validates `auth.uid()` + email match server-side, so RLS can stay strict.
- Existing `TransferOwnership` component and Teams page keep working; the migration doesn't touch `teams` or the ownership transfer path.
- No Supabase-dashboard steps required from the user; migration + code changes only.

## Files touched

```text
supabase/migrations/<new>.sql        # columns, RPC, RLS extensions
src/pages/Billing.tsx                # add "Transfer team ownership" bullet
src/pages/Teams.tsx                  # token invites, resend/cancel, pending list, new email body
src/pages/InviteAccept.tsx           # NEW /invite route
src/App.tsx                          # register /invite route + wrap ActiveTeamProvider
src/hooks/useAuth.tsx                # remove processPendingInvites
src/hooks/useActiveTeam.tsx          # NEW context + hook
src/components/DashboardSidebar.tsx  # account switcher + role-based nav gating
src/pages/MailGroups.tsx             # write with activeTeam owner_id
src/pages/ComposeEmail.tsx           # write/send with activeTeam owner_id + role gating
src/pages/Campaigns.tsx              # same
```
