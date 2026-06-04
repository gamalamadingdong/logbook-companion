# Coaching Notification Plan

## Current state

- In-app notifications are persisted in `app_notifications` and remain owner-scoped by RLS.
- Assignment-created and score-entered fan-out are implemented as controlled Supabase RPCs.
- Client calls to fan-out notifications are non-blocking so coaching workflows do not fail if notification delivery fails.
- The fan-out RPCs currently no-op for real athletes unless the target athlete row is linked to an authenticated user account.

## Paused future work

### Athlete account linking and notification activation

Status: intentionally paused.

Do not link real athlete records to authenticated user accounts until the product flow and consent model are ready.

When this resumes:

- Design an explicit consent-based athlete account linking flow.
- Decide how junior athlete, parent, guardian, and team-admin cases should work before broad rollout.
- Link `athletes.user_id` only after the user relationship is confirmed.
- Re-run assignment-created and score-entered notification E2E checks with linked test athlete accounts.
- Decide whether athlete-facing notifications should remain in-app only or expand to email, push, or another channel.

Until then, the current RPCs are structurally ready and safely return `0` when no linked athlete user exists.
