# Admin Email Notifications Design

**Date:** 2026-09-15
**Status:** Approved

## Goal

Send Sam an email at `samdgammon@gmail.com` when:

1. A real Logbook Companion user signs up.
2. An authenticated user submits feedback through the app.

Delivery must not depend on a browser tab remaining open, and failures must not be silently reported as success.

## Current State

The repository and live Supabase project already contain `notify-user-signup` and `notify-feedback` Edge Functions, and the project has Resend configuration. Both paths are currently initiated by React code.

Current weaknesses:

- Feedback is inserted first, then the browser starts a fire-and-forget function call and discards any failure.
- Signup notification is invoked while the client creates or fetches a profile, so email confirmation, session timing, a closed browser, or duplicate auth callbacks can delay, drop, or duplicate attempts.
- `notify-feedback` returns success even when Resend rejects the email.
- Signup idempotency checks and updates occur on opposite sides of the email send, leaving a race window.
- Recipient configuration is inconsistent: signup supports `ADMIN_NOTIFICATION_EMAIL`; feedback hardcodes the address.

## Chosen Approach

Use server-owned database events to invoke hardened Supabase Edge Functions. Keep Resend and the current function names rather than introducing a queue/worker system.

### Event Sources

- **Signup:** an insert into `auth.users` triggers `notify-user-signup`. This is the authoritative signup event and does not depend on email-confirmation or profile-creation timing.
- **Feedback:** an insert into `public.user_feedback` triggers `notify-feedback`.

The database event wiring will be configured in Supabase using secret-backed authorization. No service-role key, webhook secret, or Resend credential will be committed to the repository.

### Edge Function Contract

Each database event sends the inserted record identity. The Edge Function then loads the canonical row from Supabase rather than trusting user-supplied names, email addresses, feedback types, or messages.

Both functions will:

1. Authenticate the server-originated request.
2. Validate the event/table and record identifier.
3. Load the canonical database row and related user/profile data. Signup delivery uses the Auth Admin API for the canonical user and treats a public profile as optional because it may not exist yet.
4. Claim the notification atomically so concurrent deliveries cannot send duplicates.
5. Send through Resend to `ADMIN_NOTIFICATION_EMAIL`, falling back to `samdgammon@gmail.com`.
6. Record successful delivery time.
7. Record an actionable failure state and return a non-2xx response when delivery fails.

### Database State

Add a small server-only delivery ledger keyed by event type and source record ID. It records status, attempt count, successful delivery time, and a bounded last-error summary. A unique constraint provides one logical delivery per signup or feedback record.

This ledger is not a general outbox and has no background worker. It exists only to make the two approved alerts idempotent, observable, and safely replayable. The migration will be additive and backward-compatible. RLS will be enabled with no client policies; only server credentials can read or update delivery state. The existing `user_profiles.admin_signup_notified_at` field becomes legacy compatibility state and is not relied on for new signup events.

### Client Changes

- Remove `notify-user-signup` calls from `AuthContext`; client profile creation remains unchanged unless live-schema inspection shows a separate profile-creation defect.
- Remove the fire-and-forget `notify-feedback` invocation from `FeedbackModal`.
- Keep feedback persistence and the existing user confirmation UI. The user-facing success state means the feedback was stored; admin email delivery is an operational side effect and does not make the feedback submission fail.

## Reliability Boundary

This design provides server-owned invocation, idempotency, visible failure state, and safe manual replay. It does not add a continuously running retry worker. That is intentionally deferred unless real delivery volume or failures justify an outbox.

A failed database webhook or Resend call remains visible through function logs and the delivery ledger. Replaying the event/function is safe because successful events are idempotently skipped.

## Security

- Keep `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, authorization material, and Supabase server keys in Supabase secrets/configuration only.
- Do not trust webhook payload fields beyond the event identity; re-query canonical rows.
- Escape all user-controlled values before rendering HTML.
- Restrict each function to expected server-originated calls.
- Do not expose service-role credentials to React or persist them in SQL migrations.

## Email Content

### Signup

- Subject: `New Logbook Companion signup: <display name or email>`
- Include display name, email, and signup/profile creation time.

### Feedback

- Subject identifies bug report, feature request, or other feedback and the submitting user.
- Include display name, account email, submission time, feedback type, and escaped message body.
- Include a link to the app feedback review page when that route is valid for the recipient.

## Verification

Before claiming completion:

1. Inspect the target live Supabase project and existing table/RLS/function state.
2. Add and test focused idempotency, authorization, canonical-data, and Resend-failure behavior.
3. Run the migration locally or through the repository-authoritative migration workflow, then verify live columns/policies.
4. Deploy both Edge Functions with intentional auth settings and verify their deployed versions.
5. Configure and inspect both database events.
6. Run lint, tests, build, and `git diff --check`.
7. Perform one controlled signup-event smoke test and one controlled feedback-event smoke test using clearly marked test records.
8. Verify both emails arrive at `samdgammon@gmail.com`, both ledger entries record success, and replay does not send duplicates.
9. Remove test records when safe and report any retained audit records explicitly.

## Rollback

- Disable the two database event hooks first; this stops new emails without affecting signups or feedback storage.
- Restore the prior Edge Function versions if needed.
- Leave the additive delivery ledger in place unless there is a concrete reason to remove it; it is inert when event hooks are disabled.

## Deferred

- Automated scheduled retries or a general notification outbox.
- Multiple recipients or admin-configurable notification preferences.
- End-user email notifications.
- Notifications for other app events.
