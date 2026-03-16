# Demo Team-Management Seed

This project now includes a repeatable seed script for populating a demo Supabase project with coaching and team-management data.

Script:

- `scripts/seed_demo_team_management.mjs`

NPM command:

- `npm run seed:demo:team-management`

## What It Seeds

The script creates a demo organization and five teams:

- Varsity
- Junior Varsity
- Upper Novice
- Novice
- Freshmen

It then seeds:

- a demo coach membership across the org and all teams
- a realistic mock roster of athletes
- org-wide group assignments using existing workout template names already present in the database:
  - `2k Test`
  - `6x1000m`
  - `2x2000m`
  - `4x4:00@26/5:00r`
  - `Ladder Fitness Test`
- completed `daily_workout_assignments` rows with splits, times, distances, weights, and Speed Index values
- coaching sessions
- session notes and coach-note feed entries
- erg scores
- boatings

## Required Environment Variables

The script expects these variables:

- `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEMO_COACH_USER_ID`

Optional:

- `DEMO_COACH_EMAIL`
- `DEMO_COACH_DISPLAY_NAME`

## Important Assumptions

- Run this against a demo Supabase project, not the main live project.
- The target project must already contain the referenced workout templates.
- The demo coach auth user must already exist in the target project. The script upserts the matching `user_profiles` row, but it does not create the auth user.

## Idempotency

The script is designed to be rerun safely for the demo org it manages.

Before reseeding, it deletes the previously seeded demo organization and all dependent coaching data tied to that demo org/team set, then recreates the dataset.

## Suggested Usage

1. Create a demo auth user in the target Supabase project.
2. Export the required environment variables for the target project.
3. Run `npm run seed:demo:team-management`.
4. Log in as the demo coach and verify:
   - dashboard cards are populated
   - roster has athletes across teams
   - analytics has leaderboard/result data
   - notes and boatings render as expected
