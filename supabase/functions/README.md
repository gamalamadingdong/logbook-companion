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
