# Draft: Concept2 production-write requirements inquiry

**Status:** Draft only; Sam reviews and sends externally.

**To:** ranking@concept2.com  
**Subject:** Development evidence expected for production Logbook API result-write approval

Hello Concept2 team,

I’m Sam Gammon, the developer of Logbook Companion and ErgLink. Both are public, open-source projects. I am preparing to request approval for Logbook Companion to create results through the production Concept2 Logbook API, and I would like to confirm what development evidence you expect before I submit the formal request.

Logbook Companion is the application that stores completed workouts, manages each user’s Concept2 authorization, and publishes results through a server-side integration. ErgLink is a companion mobile application I am developing to program a PM5 and capture actual completed-workout data. ErgLink sends measured workout evidence to Logbook Companion; it does not hold Concept2 credentials or publish directly to Concept2.

The intended workflow is user-initiated and unverified:

1. Logbook Companion stores an owned completed workout.
2. The user explicitly chooses to publish it to their own Concept2 account.
3. A server-side integration creates the result and stores the returned Concept2 result ID.
4. Logbook Companion reads the result back and links it to the original workout by exact ID.

Development testing I have already completed includes:

- server-side OAuth authorization-code exchange and credential storage;
- `user:read,results:write` consent and a real rotating-token refresh;
- multiple fixed-distance RowErg result writes;
- exact result-ID validation and read-back;
- duplicate-safe re-import;
- single-dispatch/concurrency protection;
- no blind retry after an uncertain POST outcome;
- explicit privacy and weight class;
- unverified result submission; and
- visible Logbook Companion workout provenance in Concept2 comments.

Representative development result IDs are `86800`, `86805`, `86807`, and `86817`.

Before my formal production-write request, I plan to validate device-free canonical fixtures for fixed time, fixed-distance intervals, fixed-time intervals, and variable intervals. I will check interval payloads with the Concept2 Online Validator and then write/read them back through the development API. I also plan controlled duplicate (`409`) and invalid (`422`) tests.

Could you please confirm:

1. Which workout shapes do you expect to see tested before production result-write approval?
2. Do you want Online Validator output, sanitized payload samples, or development result IDs?
3. Are fixed distance, fixed time, representative interval cases, duplicate behavior, invalid behavior, and token refresh a sufficient matrix?
4. Do you prefer originating Logbook Companion workout identity in `comments` or `metadata.other`?
5. Are there additional rate-limit, client-identification, callback, privacy, or operational requirements not described in the public documentation?
6. Is trusted/verified-client status a separate process? I am not requesting verified-result status as part of this inquiry.

- Logbook Companion: https://github.com/gamalamadingdong/logbook-companion
- ErgLink: https://github.com/gamalamadingdong/erg-link
- Development application: https://logbook-dev.readyall.org

Thank you,

Sam Gammon  
samdgammon@gmail.com
