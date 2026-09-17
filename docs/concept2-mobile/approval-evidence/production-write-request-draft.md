# Draft: Concept2 production result-write request

**Status:** Prepared for Sam's review. Not sent. The 2026-09-17 requirements inquiry is still awaiting a reply; adapt this request to any instructions Concept2 sends.

**Review note (not part of the email):** Confirm the registered production OAuth client identity and callback before sending if Concept2 requests them. Do not include a client secret. Incorporate any reply to the requirements inquiry.

**To:** ranking@concept2.com  
**Subject:** Logbook Companion production result-write approval request

Hello Concept2 team,

I'm Sam Gammon, the developer of the open-source Logbook Companion and ErgLink projects. I would like to request approval for Logbook Companion to create unverified workout results in an athlete's own production Concept2 Logbook through the Logbook API.

An athlete will define a workout in Logbook Companion. The ErgLink mobile companion is intended to program a PM5 and return the actual completed workout, including detailed telemetry when available. Logbook Companion will retain that training record. Publication to Concept2 happens only when the athlete explicitly chooses it. Logbook Companion is the sole Concept2 API client: it manages the athlete's OAuth connection and sends result writes from its server. ErgLink does not receive Concept2 credentials or call the Concept2 API.

The development application has obtained `results:write` consent and created RowErg results for fixed distance, fixed time, fixed-distance intervals, fixed-time intervals and variable mixed distance/time intervals. These results were read back using Concept2's returned result IDs and linked to their originating Logbook Companion workout IDs. Representative development results are:

| Workout shape | Development result ID | Evidence |
|---|---:|---|
| Fixed distance | `86817` | Written from an LC manual workout; LC workout ID appears in the Concept2 comment; exact-ID read-back. |
| Fixed time | `86844` | Provider displayed Fixed Time and the LC workout ID comment; exact-ID read-back and repeat import. |
| Fixed-distance intervals | `86847` | Synthetic completed-workout fixture; strict Online Validator passed; interval breakdown checked on Concept2; exact-ID read-back. |
| Fixed-time intervals | `86848` | Synthetic completed-workout fixture; strict Online Validator passed; interval breakdown checked on Concept2; exact-ID read-back. |
| Variable intervals | `86849` | Synthetic mixed distance/time fixture; strict Online Validator passed; interval breakdown checked on Concept2; exact-ID read-back. |

The three interval fixtures are test data, not PM5 captures. After repeat import on 2026-09-17, the development account had nine saved rows with nine distinct result IDs. Server-side publication allows one claimed dispatch for a workout, retains an immutable payload snapshot, and blocks blind retries after an uncertain POST outcome. An expired access token was refreshed with rotating credentials while retaining write scope. The representative results are unverified. The provider-visible LC workout ID comment was confirmed for results `86817` and `86844`; the interval payloads also carry that provenance.

Our local tests cover duplicate `409` handling as an uncertain outcome that cannot be silently retried or treated as a published result, and validation `422` handling as a definite rejection that can be corrected before a new explicit attempt. We have **not** yet induced or observed those HTTP responses against the development API. We will provide controlled live evidence if you require it; the normal publication flow deliberately prevents duplicate dispatch and malformed payloads before POST.

Could you please confirm whether this evidence is sufficient for production `results:write` approval and whether you require additional workout shapes, Online Validator records, or live `409`/`422` evidence? Please also let me know any production client identification, callback, privacy, rate-limit, or other operational conditions. We currently place the originating LC workout ID in `comments`; do you prefer `metadata.other` for that provenance?

I am requesting normal unverified result writing, not trusted or verified-result status. Even after provider approval, production publication will require a separate controlled rollout on our side.

- Logbook Companion source: https://github.com/gamalamadingdong/logbook-companion
- ErgLink source: https://github.com/gamalamadingdong/erg-link
- Development application: https://logbook-dev.readyall.org
- Development OAuth callback: https://logbook-dev.readyall.org/callback

Thank you,

Sam Gammon  
samdgammon@gmail.com
