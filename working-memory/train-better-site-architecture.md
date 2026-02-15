# Train Better Site Architecture + Wireframes

> Date: 2026-02-13  
> Scope: High-level layout, information architecture, and communication model for `train-better.app` umbrella site and its relationship to Logbook Companion + ErgLink.
> Related execution artifact: `working-memory/train-better-change-roadmap-spec.md`

## 1) Brand and Product Architecture

## Umbrella Model
- **Brand umbrella:** Train Better
- **Product 1:** Logbook Companion (analysis, logging, coaching workflows)
- **Product 2:** ErgLink (live PM5 sessions, relay, real-time execution)

## Domain Map (aligned with rollout plan)
- Hub + marketing: `https://train-better.app`
- Logbook Companion app: `https://log.train-better.app`
- ErgLink app: `https://erg.train-better.app`
- Docs/resources: `https://docs.train-better.app`

## Core message hierarchy
1. **Top-level value:** "Train Better with connected tools for athletes and coaches."
2. **Product separation:** "Use each app independently, or together for full loop training."
3. **Flow narrative:** Capture → Analyze → Coach/Improve.

---

## 2) Information Architecture (Hub)

## Primary nav
- Products
- Athletes
- Coaches
- Docs
- Community
- Support
- CTA: Open Logbook Companion

## Core pages
1. **Home** (`/`)
2. **Products** (`/products`)
3. **Logbook Companion** (`/products/logbook-companion`)
4. **ErgLink** (`/products/erg-link`)
5. **For Athletes** (`/athletes`)
6. **For Coaches** (`/coaches`)
7. **Docs** (`/docs`) - index/hand-off to docs subdomain
8. **Community** (`/community`) - roadmap, sponsors, changelog links
9. **Support** (`/support`) - contact, troubleshooting links

## Suggested footer links
- Product links (LC, ErgLink)
- Docs and quickstart
- Community and roadmap
- Privacy / Terms / Contact

---

## 3) Cross-Site Communication Model

## Communication strategy
- Hub communicates **intent and routing**.
- Product sites communicate **task-specific workflows**.
- Docs communicate **how-to depth** and troubleshooting.

## Technical linking model (phase 1)
- Deep-link CTAs from hub to app-specific entry points.
- Keep app auth and runtime separate per subdomain.
- Use shared UTM/event naming so analytics can tie journeys.

## Technical model (phase 2, optional)
- Shared design token package across hub + both apps.
- Shared session profile hand-off where feasible.
- Lightweight central "announcements" feed surfaced in both apps.

---

## 4) Page-Level Layout Blueprint

## Home page content stack
1. Hero: umbrella message + two product CTAs
2. Product cards: LC and ErgLink side-by-side
3. "How it works" flow: Capture → Analyze → Coach/Improve
4. Audience split: Athletes vs Coaches
5. Community/support section
6. Footer

## Product detail page structure (LC / ErgLink)
1. Product hero + "best for"
2. Primary jobs-to-be-done
3. Core workflows screenshots/mock slots
4. Integration with sibling product
5. CTA to open app

## Coaches page structure
1. Coaching outcomes headline
2. Workflow strips (assign → track → adjust)
3. Links into LC coaching modules
4. ErgLink tie-in for live sessions

---

## 5) Wireframes (ASCII)

## A) Home (desktop)

```text
+------------------------------------------------------------------------------------------------+
| LOGO | Products | Athletes | Coaches | Docs | Community | Support              [Open LC App] |
+------------------------------------------------------------------------------------------------+
|                                   HERO                                                          |
|                    Train Better with connected tools for rowing teams                           |
|              [Open Logbook Companion]       [Open ErgLink]                                      |
+------------------------------------------------------------------------------------------------+
|                              PRODUCT STRIP                                                       |
|   +-------------------------------+   +-------------------------------+                         |
|   | Logbook Companion             |   | ErgLink                       |                         |
|   | Analyze, plan, coach          |   | Run live sessions with PM5    |                         |
|   | [Explore LC] [Open App]       |   | [Explore ErgLink] [Open App]  |                         |
|   +-------------------------------+   +-------------------------------+                         |
+------------------------------------------------------------------------------------------------+
|                        HOW IT WORKS: Capture -> Analyze -> Coach/Improve                        |
+------------------------------------------------------------------------------------------------+
|                 FOR ATHLETES                            FOR COACHES                              |
|               [Athlete Path CTA]                      [Coach Path CTA]                           |
+------------------------------------------------------------------------------------------------+
| COMMUNITY + SUPPORT (Roadmap, Sponsors, Changelog, Contact)                                     |
+------------------------------------------------------------------------------------------------+
| Footer links                                                                                     |
+------------------------------------------------------------------------------------------------+
```

## B) Home (mobile)

```text
+------------------------------+
| LOGO                  [Menu] |
+------------------------------+
| Hero headline                |
| Train Better...              |
| [Open LC]                    |
| [Open ErgLink]               |
+------------------------------+
| Product card: LC             |
| [Explore] [Open App]         |
+------------------------------+
| Product card: ErgLink        |
| [Explore] [Open App]         |
+------------------------------+
| Capture -> Analyze -> Improve|
+------------------------------+
| Athletes CTA                 |
| Coaches CTA                  |
+------------------------------+
| Community / Support          |
+------------------------------+
```

## C) Product Detail (generic)

```text
+------------------------------------------------------------------------------------------------+
| Product name + short promise                                                                    |
| [Open App] [Read Docs]                                                                          |
+------------------------------------------------------------------------------------------------+
| Best for: [Athletes] [Coaches]                                                                  |
+------------------------------------------------------------------------------------------------+
| Key workflows                                                                                   |
| 1) ...                                                                                          |
| 2) ...                                                                                          |
| 3) ...                                                                                          |
+------------------------------------------------------------------------------------------------+
| Works with: sibling app card + deep link                                                        |
+------------------------------------------------------------------------------------------------+
| FAQ / Troubleshooting / Community links                                                         |
+------------------------------------------------------------------------------------------------+
```

## D) Coaches Journey Page

```text
+------------------------------------------------------------------------------------------------+
| Coach better each week                                                                          |
| Assign training -> Track completion -> Adjust lineups                                            |
| [Open Coaching in LC]                                                                           |
+------------------------------------------------------------------------------------------------+
| Workflow modules                                                                                |
| [Assignments] [Roster + Missing] [Boatings] [Quick Score]                                      |
+------------------------------------------------------------------------------------------------+
| Live session add-on                                                                             |
| Use ErgLink for PM5-floor execution [Open ErgLink]                                              |
+------------------------------------------------------------------------------------------------+
```

---

## 6) Measurement and Funnel

## Top events to track
- Hub CTA click to Logbook Companion
- Hub CTA click to ErgLink
- Docs click-through
- Community click-through (roadmap/sponsors)
- Return visits and cross-product adoption

## Funnel view
1. Visit hub
2. Select persona or product
3. Open app
4. Complete first meaningful action

---

## 7) Implementation Notes (Minimal MVP)

- Build hub as a lightweight static site first (fast iteration, low ops cost).
- Keep each app deployment independent at subdomain level.
- Add cross-links in both apps back to umbrella pages (community/docs/support).
- Do not block rollout on shared auth/session; launch with clear links first.

## Suggested sequencing
1. Ship hub homepage + product pages
2. Add docs/community/support pages
3. Add analytics events and funnel dashboard
4. Iterate copy based on user feedback from spring season

---

## 8) App Boundary Strategy: Keep Unified Now, Split Later (if needed)

## Recommendation
- **Near-term (current season):** Keep Logbook + Coaching in one app.
- **Mid-term (post-season):** Split Coaching into a dedicated app only if readiness triggers are met.
- **Backend:** Remains shared (Supabase + existing team-scoped model).

## Why this recommendation
- Current coaching features are already cleanly route-scoped under `/coaching/*`.
- Data model and services are team-scoped and already separated in `coachingService.ts`.
- Immediate split adds operational complexity (auth/session, duplicated nav/layout, support burden) during active coaching season.

## Split readiness triggers (use as go/no-go gates)
Proceed with a dedicated Coaching app when **2+ triggers** are true for at least one sprint cycle:

1. **Roadmap divergence**
	- Athlete analytics and coaching operations have separate release priorities that conflict.
2. **Navigation friction**
	- Coaches repeatedly traverse athlete-first pages to do coaching tasks.
3. **Ownership split**
	- Different contributors/teams need independent deploy cadence and QA windows.
4. **Performance pressure**
	- Bundle size or route-level loading for coaching workflows becomes a measurable bottleneck.
5. **Commercial/packaging pressure**
	- Need separate trial, pricing, or onboarding for coach organizations.

## Target architecture if split happens
- `log.train-better.app` = Athlete app (history, analytics, templates, personal insights)
- `coach.train-better.app` = Coaching app (roster, assignments, boatings, notes, team dashboards)
- `erg.train-better.app` = Live session app (ErgLink)
- `train-better.app` = Hub and routing

All apps continue to use:
- Shared Supabase project and schema
- Shared auth provider/session model
- Shared design tokens and common component primitives where practical

## Phased split roadmap (planning-only)

### Phase 0: Boundary hardening inside current app
- Extract/centralize shared domain packages (auth helpers, profile/team context adapters, API clients).
- Ensure coaching code has no hidden dependencies on athlete routes/components.
- Add explicit telemetry to compare athlete vs coach journey completion.

### Phase 1: Shell-first split (no major feature moves)
- Stand up `coach.train-better.app` shell with login, team resolution, and basic nav.
- Move coaching routes/components first with minimal UX changes.
- Keep service calls and DB schema unchanged.

### Phase 2: Experience optimization
- Coach-specific onboarding, dashboard defaults, and workflow shortcuts.
- Add cross-linking between athlete and coach experiences where needed.
- Tune role-based access and invite flows for dedicated coach app context.

### Phase 3: Packaging + operations
- Optional: separate release trains, docs sections, and support surface.
- Optional: separate pricing/plan presentation if product strategy calls for it.
- Keep a rollback switch: route coach users back to unified app if issues arise.

## Risks and mitigations
- **Risk:** Session/auth edge cases across subdomains.  
  **Mitigation:** Keep auth stack shared; validate redirects and invite flows in staged environment first.
- **Risk:** Duplicate UI effort and drift.  
  **Mitigation:** Shared UI token system and component library.
- **Risk:** User confusion on where to go.  
  **Mitigation:** Strong hub messaging and in-app "Go to Coach/Athlete" CTAs.

---

## 9) Naming Exploration: Is "Logbook Companion" still right?

## Current assessment
- "Logbook Companion" is descriptive for users who already know Concept2 Logbook.
- It may under-signal broader value (analytics + coaching + planning), especially for new users entering through Train Better.

## Naming decision criteria
Score candidate names on:
1. **Clarity**: Does a new user understand what it does?
2. **Scope fit**: Can it grow beyond pure logbook analysis?
3. **Brand coherence**: Does it sit naturally under Train Better?
4. **Distinctiveness**: Is it memorable and searchable?
5. **Migration cost**: How painful is rename across docs/UI/URLs/social?

## Practical naming options

### Option A — Keep "Logbook Companion" (recommended now)
- Keep product name stable through spring season.
- Improve tagline to broaden meaning (example: "Analyze, plan, and improve every session").
- Revisit full rename post-season with usage data.

### Option B — Soft transition to "Train Better Logbook"
- Keep familiar term "Logbook" while aligning more tightly to umbrella brand.
- Can be introduced as dual-label in UI/marketing first (e.g., "Logbook Companion by Train Better").

### Option C — Rename to a broader performance identity
- Examples for exploration only: "Train Better Performance", "Train Better Insights", "Crew Performance".
- Better long-term scope fit, but highest migration/change-management cost.

## Recommended naming path
1. **Now:** Keep "Logbook Companion" for stability.
2. **Immediately:** Add stronger value subtitle in hub and product pages.
3. **Post-season checkpoint:** Run a lightweight naming test (homepage CTA copy A/B + user interviews).
4. **Decision gate:** Rename only if evidence shows improved comprehension/conversion.

---

## 10) Decision Worksheet (Split + Naming)

Use this worksheet at the end of spring season to make a decision in one session.

## A) App Split Readiness Scorecard

Rate each 0-5 (0 = no signal, 5 = strong signal):

| Criterion | Score (0-5) | Evidence / Notes |
|---|---:|---|
| Roadmap divergence (athlete vs coach priorities conflict) |  |  |
| Navigation friction for coaches in unified app |  |  |
| Team ownership/release cadence conflict |  |  |
| Performance or bundle pressure in coaching flows |  |  |
| Commercial packaging need (coach-specific pricing/onboarding) |  |  |

### Split decision rule
- **Go (split planning starts):** Total score >= 14 **and** at least 2 criteria score >= 4.
- **No-go (stay unified):** Total score < 14 or only 0-1 strong signals.

## B) Naming Evaluation Scorecard

Evaluate each candidate name from 1-5 (5 is best):

| Name Candidate | Clarity | Scope Fit | Brand Coherence | Distinctive | Migration Cost* | Total |
|---|---:|---:|---:|---:|---:|---:|
| Logbook Companion |  |  |  |  |  |  |
| Train Better Logbook |  |  |  |  |  |  |
| Candidate 3: __________ |  |  |  |  |  |  |

\* For **Migration Cost**, score 5 = low cost/easy migration, score 1 = high cost/hard migration.

### Naming decision rule
- Keep current name if it is within 2 points of the top candidate.
- Rename only if a candidate wins by >= 3 points **and** improves clarity score by at least +1.

## C) Evidence Checklist (required before deciding)

- [ ] Hub analytics for 30+ days after launch
- [ ] Coach journey completion metrics (assignment, missing-status closeout, roster actions)
- [ ] At least 5 coach interviews + 5 athlete interviews
- [ ] Support/feedback tags for confusion about product boundaries
- [ ] Release friction notes from recent sprint(s)

## D) Final Decision Template

### Split Decision
- **Decision:** Keep Unified / Split to `coach.train-better.app`
- **Date:**
- **Owner(s):**
- **Why:**
- **Earliest start sprint:**
- **Rollback condition:**

### Naming Decision
- **Decision:** Keep "Logbook Companion" / Rename to __________
- **Date:**
- **Owner(s):**
- **Why:**
- **Rollout style:** Subtitle only / Dual-label / Full rename

## E) If "Go" on split: immediate kickoff checklist

- [ ] Create split epic with Phase 0-3 tasks from Section 8
- [ ] Define app boundary contract (shared auth, shared services, shared components)
- [ ] Reserve domain + env setup for `coach.train-better.app`
- [ ] Draft user communication plan (who gets routed where, and when)
- [ ] Define cutover validation + rollback runbook
