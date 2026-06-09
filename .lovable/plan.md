## Problem
On `/dashboard/teams`, "Invite Member" only inserts a row into `team_invites` — no email is ever sent, so the invitee never knows. Since direct Gmail/SMTP sending from a user's own address isn't working, we need a reliable path that uses the email infrastructure already wired into the project.

## Plan

1. **Send invite emails through Lovable's built-in email system (app emails).**
   - Add a new app email template `team-invite` in `supabase/functions/_shared/transactional-email-templates/` with: team name, inviter name/email, role, and an "Accept invite" CTA button linking to `/auth?invite=<token>`.
   - Register it in the templates `registry.ts`.
   - Prerequisite: email domain + email infra must be set up. If not yet configured, I'll trigger the email domain setup dialog first; otherwise I'll go straight to scaffolding/deploying.

2. **Add a token to team invites so the link is secure.**
   - Migration: add `token uuid default gen_random_uuid()`, `expires_at timestamptz default now() + interval '7 days'`, and `status` ('pending' | 'accepted' | 'revoked') to `team_invites` (if not already present).
   - Add a `get_invite_by_token` RPC (security definer) so the Auth page can look up the invite without being logged in.

3. **Wire the Teams page to send the email.**
   - After inserting the `team_invites` row, call `supabase.functions.invoke('send-transactional-email', { templateName: 'team-invite', recipientEmail, idempotencyKey: invite.id, templateData: { teamName, inviterEmail, role, acceptUrl } })`.
   - Show the existing "Invite sent!" toast only on success; show an error toast if the email fails.

4. **Accept-invite flow on the Auth page.**
   - If `?invite=<token>` is present, fetch the invite via the RPC and show "You're being invited to <team> as <role>".
   - After successful sign-up / sign-in with the matching email, insert a `team_members` row and mark the invite `accepted`.

5. **Deploy edge functions** (`send-transactional-email`, plus infra functions if newly scaffolded).

## Technical notes
- Uses the existing Lovable Cloud email infrastructure (no Gmail/SMTP/Resend dependency).
- The "from" address will be your verified Lovable sender domain — not the inviter's personal Gmail. The email body will say "<Inviter Name> invited you…" so the invitee knows who sent it.
- No changes to PayPal/billing or other features.

## Out of scope
- Sending from the inviter's actual Gmail address (requires per-user Google OAuth — separate, larger task).
- Resending / revoking invites UI (can add later if you want).

Want me to proceed with this?