# Logbook Companion coaching assistant

Status — parked for future implementation.

## First release

Add an opt-in, read-only chat for signed-in athletes. The assistant should answer rowing questions from the training guides and use the athlete's recent workout summaries when the question calls for personal context. Start with a server endpoint and verify it with a test account before adding the chat screen.

Example questions include “What should I focus on at the catch?” and “Based on my last two weeks, what should I focus on during my next easy row?”

## Azure services

- Use the shared Foundry Responses deployment, `gpt-6-luna`.
- Query the `logbook-companion-knowledge-dev` index on the shared Azure AI Search service. Keep the index name fixed by server configuration and use a read-only query credential.
- Set the Responses URL, deployment name, model credential, Search URL, index name, and Search query credential in LC's server environment. Keep credentials out of client builds and version control.
- A backend smoke test retrieved two rowing guide excerpts from the existing 315-document index and received a Luna answer using a synthetic workout summary. The app integration remains to be built.

## Work to implement

1. Add a Vercel API route alongside `api/mcp.ts`. Verify the caller's Supabase session and enforce pilot access on the server. Apply request size limits, a per-user rate limit, and timeouts for upstream calls.
2. Reuse `getTrainingSummary` in `api/_lib/logbook.ts` using the verified athlete's identity and access token. Default to a bounded recent window, such as 14 days, and let the athlete request a supported date range. Pass only the workout totals and trends needed for the question. Store no workout data in Azure Search.
3. Retrieve a small set of guide excerpts from the app's index. Give Luna the verified summaries and relevant excerpts with clear source labels. Keep Responses requests stateless with `store: false`. Return the answer and structured references the UI can display. Distinguish guide evidence from workout observations, and say when either source lacks enough data.
4. After the endpoint passes its pilot checks, add a chat screen with starter questions, source references, and loading and error states. Keep the first pilot read-only and limit it to the athlete's own history. Defer coaching across athletes, training-plan edits, and chat history persistence.

## Pilot acceptance checks

- A general technique question returns an answer with a relevant guide reference.
- A personalized question reflects the test athlete's known workout totals for the requested window.
- Accounts with empty histories get a clear answer that reflects the missing data.
- Unauthenticated callers and accounts outside the pilot cannot use the endpoint. A second test account cannot retrieve the first account's workouts by passing another user ID.
- Search or model outages produce a recoverable error, and server logs record timing and upstream status without recording workout data or chat text.
