# Domain Migration Runbook (One-Pass)

> Date: 2026-02-13  
> Owner: Sam  
> Registrar/DNS: DreamHost  
> Hosting: Vercel  
> Goal: Move to `train-better.app` ecosystem without breaking auth, sync, invites, or existing users.

## Target URL Map

- **Hub/community:** `https://train-better.app`
- **Logbook Companion app:** `https://log.train-better.app`
- **ErgLink app:** `https://erg.train-better.app`
- **Docs/resources:** `https://docs.train-better.app` (or `learn.train-better.app`)
- **Brand naming in UI:** Keep “Logbook Companion” and “ErgLink” product names.

## Before You Start (Inventory)

- [ ] List all currently live domains and Vercel preview URLs used by real users.
- [ ] Export/copy current settings from:
  - [ ] Vercel Domains + Project Environment Variables
  - [ ] Supabase Auth URL settings
  - [ ] Concept2 OAuth app redirect/allowed URLs
  - [ ] Resend domain/sender configuration (if enabled)
- [ ] Create a rollback note: “Point users back to old domain if auth fails.”

## Step 1 — DreamHost DNS Setup

1. In DreamHost DNS for `train-better.app`:
   - [ ] Add apex/root records required by Vercel (`train-better.app`).
   - [ ] Add `www` record required by Vercel.
   - [ ] Add CNAME for `log` -> Vercel target shown in Vercel domain setup.
   - [ ] Add CNAME for `erg` -> Vercel target shown in Vercel domain setup.
   - [ ] Add CNAME for `docs` -> Vercel target shown in Vercel domain setup.
2. Keep TTL low during migration (e.g., 300) to speed correction if needed.
3. Wait for propagation and verify each record resolves.

## Step 2 — Vercel Domain Mapping

1. Add domains to the correct projects:
   - [ ] `train-better.app` (hub project)
   - [ ] `www.train-better.app` (redirect to apex or same project)
   - [ ] `log.train-better.app` (LogbookCompanion project)
   - [ ] `erg.train-better.app` (ErgLink project)
   - [ ] `docs.train-better.app` (docs/static project)
2. For each domain:
   - [ ] Confirm “Valid Configuration” in Vercel.
   - [ ] Confirm TLS certificate issued.
   - [ ] Confirm production deployment is assigned.
3. Add redirects in Vercel for legacy domains:
   - [ ] old LC domain -> `https://log.train-better.app`
   - [ ] old docs domain -> `https://docs.train-better.app`

## Step 3 — Application URL-Dependent Behavior

These flows are origin-based and must be validated on the new domain:

- [ ] Invite links use `window.location.origin` in `src/pages/coaching/CoachingSettings.tsx`.
  - New invite links should become `https://log.train-better.app/join?code=...`
- [ ] Concept2 callback uses `window.location.origin` in `src/pages/Callback.tsx`.
  - Redirect URI sent during token exchange becomes `https://log.train-better.app/callback`

## Step 4 — Supabase Auth & Allowed URLs

In Supabase Auth settings:

- [ ] Set Site URL to the intended primary app URL (`https://log.train-better.app`).
- [ ] Add Redirect URLs for all required environments:
  - [ ] `https://log.train-better.app/**`
  - [ ] legacy production URL(s) (temporary)
  - [ ] local dev URL(s) (if needed)
- [ ] Re-test login/logout/password reset and invite-join flow.

## Step 5 — Concept2 OAuth Settings

In Concept2 app registration/config:

- [ ] Add/replace accepted redirect URI with `https://log.train-better.app/callback`
- [ ] Keep previous production callback(s) temporarily during transition.
- [ ] Verify scopes still match app usage (`user:read,results:read`).
- [ ] Run full auth + token exchange + sync test on new domain.

## Step 6 — Resend Email Domain (if/when enabled)

If you are sending transactional emails from your own domain:

1. In Resend:
   - [ ] Add domain (recommended subdomain like `mail.train-better.app` or root policy).
   - [ ] Add required DNS records in DreamHost (SPF/DKIM/verification per Resend).
   - [ ] Verify domain status becomes active.
2. In app/backend config:
   - [ ] Update sender addresses (e.g., `noreply@...`).
   - [ ] Update environment variables/secrets in Vercel.
3. Send test emails:
   - [ ] Invite email
   - [ ] Any auth or notification email path you use

## Step 7 — GitHub & Public Surface Updates

- [ ] Update repository “Website” URL(s) to new canonical domain(s).
- [ ] Update README links to point at new production URLs.
- [ ] Update roadmap/support links if any point to old domain.
- [ ] Keep GitHub Sponsors URL unchanged unless sponsorship strategy changes.

## Step 8 — Vercel Environment Variables Review

Audit both LC and ErgLink projects for environment keys tied to URLs/integrations.

- [ ] Confirm Supabase keys are correct in each project.
- [ ] Confirm Concept2 client id/secret present where needed.
- [ ] Confirm community/support link vars:
  - [ ] `VITE_GITHUB_SPONSORS_URL`
  - [ ] `VITE_PUBLIC_ROADMAP_URL`
- [ ] Confirm any URL-like custom env vars point to new canonical hostnames.

## Step 9 — Code/Content Touchpoints to Verify

- [ ] About page links and CTA behavior on production.
- [ ] Coaching invite link copy behavior (`/join?code=`) on production.
- [ ] Any hardcoded absolute URLs in docs or markdown pages.
- [ ] Search for stale domain strings before final cutover.

## Step 10 — Cutover Validation (Run in Order)

1. [ ] Open `https://train-better.app` hub.
2. [ ] Navigate to `https://log.train-better.app` and sign in.
3. [ ] Complete Concept2 connect + callback + sync.
4. [ ] Generate/copy invite link and join from second session/account.
5. [ ] Open `https://erg.train-better.app` and validate core load/auth.
6. [ ] Validate docs/resources URL.
7. [ ] Verify legacy URLs return 301 -> canonical URL.

## Post-Cutover (Week 1)

- [ ] Monitor auth errors (Supabase + browser console).
- [ ] Monitor Concept2 OAuth failures.
- [ ] Monitor email deliverability (if Resend in use).
- [ ] Keep legacy aliases active 60–90 days.
- [ ] Announce canonical URLs to current users once stable.

## Rollback Plan (Quick)

If major auth/sync breakage occurs:

1. [ ] Re-point user-facing links back to legacy domain.
2. [ ] Keep new DNS/Vercel config in place but pause promotion.
3. [ ] Fix callback/redirect mismatch (Supabase + Concept2).
4. [ ] Re-run Step 10 validation before re-announcing.
