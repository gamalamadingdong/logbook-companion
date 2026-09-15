# Supabase Edge Functions

This project includes server-side functions under `supabase/functions`.

## `send-team-invite`

Sends a team invite email through Resend.

### Required Supabase secrets

Set these in your Supabase project before deploying:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (recommended: `invites@mail.readyall.org`)

Supabase provides these automatically in Edge Functions runtime:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Deploy

```bash
supabase functions deploy send-team-invite
```

### Local serve

```bash
supabase functions serve send-team-invite --env-file ./supabase/.env.local
```

And include at least:

```dotenv
RESEND_API_KEY=...
RESEND_FROM_EMAIL=invites@mail.readyall.org
```

## Admin signup and feedback notifications

`notify-user-signup` and `notify-feedback` are invoked by repository-owned
`pg_net` triggers. Deploy both with gateway JWT verification disabled; each
handler instead requires an exact bearer value from the dedicated
`ADMIN_NOTIFICATION_WEBHOOK_SECRET` Edge Function secret.

Store the same value in Vault under the name
`admin_notification_webhook_secret` before applying the notification migration.
The service-role key remains private to each function and is used only for
canonical database reads and delivery-ledger RPCs; it is never sent by a
database trigger.

The insert triggers first persist a `pending` delivery row, so a missing Vault
secret or failed `pg_net` dispatch remains discoverable and can be replayed.
Each handler claim receives a unique claim token; completion and failure RPCs
require that token so a stale worker cannot overwrite a newer retry attempt.

Required Edge Function secrets:

```dotenv
ADMIN_NOTIFICATION_WEBHOOK_SECRET=...
RESEND_API_KEY=...
ADMIN_NOTIFICATION_EMAIL=samdgammon@gmail.com
RESEND_FROM_EMAIL=notifications@mail.readyall.org
```

### Delivery ledger operations

Find work that was persisted but never dispatched:

```sql
select event_type, source_id, status, attempt_count, created_at
from public.admin_email_deliveries
where status = 'pending'
order by created_at;
```

Replay a pending row by POSTing its normal database-webhook envelope to the
matching function with the dedicated webhook bearer secret. The existing row
is claimed atomically; do not edit its status or claim token by hand.

Controlled production evidence on 2026-09-15: the signup smoke email was
confirmed in the recipient inbox with subject
`New Logbook Companion signup: Sam Gammon`, sender
`admins@mail.readyall.org`, and canonical account fields. Sender configuration
was not changed as part of the reliability hardening.
