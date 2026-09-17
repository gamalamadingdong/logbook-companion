# Draft: Concept2 production-write requirements inquiry

**Status:** Draft only; Sam reviews and sends externally.

**To:** ranking@concept2.com  
**Subject:** Production Logbook API write approval — development evidence requirements

Hello Concept2 team,

I’m Sam Gammon, the developer of Logbook Companion and ErgLink. Both are public, open-source projects. I am preparing to request approval for Logbook Companion to create results through the production Concept2 Logbook API, and I would like to confirm what development evidence you expect before I submit the formal request.

My goal is to let an athlete define a workout in Logbook Companion, send that prescription to the ErgLink mobile application, program a PM5, capture the actual completed workout, retain the detailed training record in Logbook Companion, and—when the athlete explicitly chooses—publish the completed result to their own Concept2 Logbook.

Logbook Companion remains the durable training record and the sole Concept2 API client. It manages each user’s Concept2 authorization and performs server-side publication. ErgLink is the companion PM5 programming and capture application; it sends measured workout evidence to Logbook Companion but does not hold Concept2 credentials or publish directly.

Development testing I have completed demonstrates:

- server-side OAuth authorization, `results:write` consent, and rotating-token refresh;
- user-initiated, unverified fixed-distance RowErg result creation and exact-ID read-back;
- protection against duplicate dispatch and blind retry after an uncertain response; and
- explicit privacy, weight class, and visible Logbook Companion provenance in Concept2 comments.

Development result `86817` is a representative example that was written, read back, and linked to its originating Logbook Companion workout. I can provide additional result IDs, sanitized payloads, and detailed evidence if useful.

Before the formal production-access request, I plan to validate fixed-time and representative interval payloads with the Concept2 Online Validator and development API. Could you please confirm:

1. What workout shapes or development evidence do you require before production result-write approval?
2. Would you like Online Validator output, sanitized payload samples, or development result IDs?
3. Are there production-client, callback, rate-limit, privacy, metadata, or client-identification requirements beyond the public documentation?
4. Do you prefer the originating Logbook Companion workout ID in `comments` or `metadata.other`?

I understand trusted/verified-client status is separate, and I am not requesting verified-result status as part of this inquiry.

- Logbook Companion: https://github.com/gamalamadingdong/logbook-companion
- ErgLink: https://github.com/gamalamadingdong/erg-link
- Development application: https://logbook-dev.readyall.org

Thank you,

Sam Gammon  
samdgammon@gmail.com
