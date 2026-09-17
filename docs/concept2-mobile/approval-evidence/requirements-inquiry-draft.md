# Draft: Concept2 production-write requirements inquiry

**Status:** Draft only; Sam reviews and sends externally.

**To:** ranking@concept2.com  
**Subject:** Development evidence expected for production Logbook API result-write approval

Hello Concept2 team,

I’m Sam Gammon, developer of Logbook Companion and ErgLink. We are preparing to request approval to create results through the production Concept2 Logbook API and would like to confirm what development evidence you expect before we submit the formal request.

Our intended workflow is user-initiated and unverified:

1. Logbook Companion stores an owned completed workout.
2. The user explicitly chooses to publish it to their own Concept2 account.
3. A server-side integration creates the result and stores the returned Concept2 result ID.
4. Logbook Companion reads the result back and links it to the original workout by exact ID.

Development testing already completed includes:

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

Before our formal production-write request, we plan to validate device-free canonical fixtures for fixed time, fixed-distance intervals, fixed-time intervals, and variable intervals. Interval payloads will be checked with the Concept2 Online Validator and then written/read back through the development API. We also plan controlled duplicate (`409`) and invalid (`422`) tests.

Could you please confirm:

1. Which workout shapes do you expect to see tested before production result-write approval?
2. Do you want Online Validator output, sanitized payload samples, or development result IDs?
3. Are fixed distance, fixed time, representative interval cases, duplicate behavior, invalid behavior, and token refresh a sufficient matrix?
4. Do you prefer originating Logbook Companion workout identity in `comments` or `metadata.other`?
5. Are there additional rate-limit, client-identification, callback, privacy, or operational requirements not described in the public documentation?
6. Is trusted/verified-client status a separate process? We are not requesting verified-result status as part of this inquiry.

GitHub: https://github.com/gamalamadingdong/logbook-companion  
Development application: https://logbook-dev.readyall.org

Thank you,

Sam Gammon  
samdgammon@gmail.com
