# Train Better Change Program — Phased Roadmap + Execution Spec

> Date: 2026-02-15  
> Owner: Sam  
> Status: Planning artifact (pre-implementation)  
> Companion docs:
> - `working-memory/train-better-site-architecture.md`
> - `working-memory/domain-rollout-plan.md`
> - `working-memory/practice-test-scripts.md`

## 1) Program Intent

Deliver the Train Better ecosystem transition with low operational risk:
1. Launch umbrella hub and subdomain topology.
2. Preserve existing user workflows (auth, C2 sync, coaching invites, ErgLink paths).
3. Create evidence-based gate for optional coaching-app split and optional product rename.

## 2) Scope and Non-Goals

## In scope
- Hub IA/content launch (`train-better.app`) and product routing.
- Domain and auth/OAuth migration to canonical hostnames.
- Cross-product messaging updates and instrumentation.
- Decision checkpoints for:
  - Coaching split (`coach.train-better.app`) — optional.
  - Logbook Companion naming change — optional.

## Out of scope (for this program)
- Rebuilding core LC/ErgLink features unrelated to migration.
- Deep backend schema refactors not required by routing/auth decisions.
- Forced split/rename before evidence gates are met.

## 3) Principles and Constraints

- Keep backend shared (Supabase + existing team-scoped model).
- Prefer additive changes and reversible cutovers.
- Preserve stable user-facing paths during season.
- One-way door decisions (split/rename) only after scorecard thresholds.

## 4) Workstreams

1. **Brand + UX**: Hub pages, copy system, product positioning, CTA map.
2. **Platform + Domains**: DNS, Vercel mapping, certs, env vars, redirects.
3. **Auth + Integrations**: Supabase URL config, Concept2 callback allowlist, invite links.
4. **Analytics + Evidence**: Event taxonomy, funnel tracking, decision worksheet inputs.
5. **Change Ops**: Rollout comms, test scripts, rollback readiness.

## 5) Phase Plan (Roadmap)

## Phase A — Program Setup (1 week)

### Objectives
- Freeze target topology and acceptance criteria.
- Convert planning docs into execution issues.

### Deliverables
- Program board with epics/tasks for all workstreams.
- Owner assignment and timeline by phase.
- Definition of done (DoD) for each phase.

### Entry criteria
- Architecture doc and domain runbook approved.

### Exit criteria
- All Phase B tasks created, sized, and prioritized.

---

## Phase B — Hub MVP Build (1–2 weeks)

### Objectives
- Ship umbrella hub that routes users cleanly to LC and ErgLink.

### Deliverables
- Home + Products + Athletes + Coaches + Support/Community pages.
- Link strategy to `log.*`, `erg.*`, and `docs.*`.
- Initial production analytics events.

### Entry criteria
- Phase A complete.

### Exit criteria
- Hub live in production with validated nav/CTA routes.
- Baseline analytics flowing.

---

## Phase C — Domain + Integration Cutover (1 week)

### Objectives
- Move canonical production experience to `train-better.app` ecosystem.

### Deliverables
- DNS + Vercel mapping complete.
- Supabase auth URLs and Concept2 callbacks updated.
- Invite, login, reset, and sync flows validated.
- Legacy redirects active.

### Entry criteria
- Hub MVP live and smoke-tested.

### Exit criteria
- Domain runbook Step 10 completed without blocking failures.
- Rollback checklist tested and documented.

---

## Phase D — Stabilization + Evidence Collection (3–6 weeks)

### Objectives
- Observe real usage and collect data required for split/rename decisions.

### Deliverables
- 30+ days analytics data from hub and app flows.
- Interview summaries (coaches + athletes).
- Support signal log (boundary confusion, naming confusion).
- Filled decision worksheet (Section 10 in site architecture doc).

### Entry criteria
- Phase C completed.

### Exit criteria
- Decision worksheet complete with recommendation.

---

## Phase E — Decision Gate (1 week)

### Objectives
- Make explicit go/no-go decisions using evidence thresholds.

### Deliverables
- Decision memo: split/no-split.
- Decision memo: keep/rename Logbook Companion.
- Updated roadmap for next quarter.

### Entry criteria
- Phase D evidence checklist complete.

### Exit criteria
- Decisions recorded in `decisionLog.md` (if architectural) and `activeContext.md`.

---

## Phase F (Conditional) — Execute Split and/or Rename (4–8 weeks)

### Trigger
- Run only if Phase E returns a "Go" outcome.

### Split track (if approved)
1. Boundary hardening in current app.
2. `coach.train-better.app` shell.
3. Route migration + coach onboarding optimization.
4. Packaging, support docs, rollback path.

### Rename track (if approved)
1. Dual-label rollout (`Old Name by Train Better`).
2. UI/content update by surface area priority.
3. Docs/README/public links update.
4. Deprecation window and final single-label state.

### Exit criteria
- Cutover validation passes.
- User confusion/support tickets stable or improved.

## 6) Detailed Spec by Workstream

## 6.1 Brand + UX Spec
- Required pages: Home, Products, Athletes, Coaches, Community, Support.
- Required blocks: hero, product cards, "how it works", audience split, community CTA.
- Required copy constraints:
  - Keep product distinction clear (LC vs ErgLink).
  - Keep ecosystem promise clear (connected tools under Train Better).

## 6.2 Platform + Domains Spec
- Canonical URLs:
  - `train-better.app`
  - `log.train-better.app`
  - `erg.train-better.app`
  - `docs.train-better.app`
- Certificates must be valid before announcement.
- Legacy URL redirects must be in place before public cutover.

## 6.3 Auth + Integrations Spec
- Supabase Site URL and Redirect URLs aligned to canonical hosts.
- Concept2 callback allowlist includes canonical callback endpoint.
- Invite links generated from production origin must resolve correctly.
- Password reset/login flows tested on canonical domain.

## 6.4 Analytics Spec

### Required events
- `hub_view`
- `hub_cta_open_log_click`
- `hub_cta_open_erg_click`
- `hub_docs_click`
- `coaching_route_entry`
- `coaching_assignment_complete`

### Required dimensions
- source page
- persona intent (athlete/coach/unknown)
- environment (prod/preview)

### Reporting outputs
- weekly funnel snapshot
- coach journey completion trend
- cross-product click-through trend

## 6.5 Change Ops Spec
- Use existing manual validation scripts from `practice-test-scripts.md`.
- Add release comms template (what changed, where to go, rollback note).
- Establish hypercare window (7 days) post-domain cutover.

## 7) Dependencies

- DreamHost DNS control
- Vercel project/domain admin
- Supabase auth config admin
- Concept2 app config access
- Optional Resend DNS/config access

## 8) Risks and Mitigations

1. **Auth breakage across subdomains**  
   Mitigation: staged environment validation + rollback-ready redirects.
2. **Invite/callback mismatch**  
   Mitigation: validate origin-based links before cutover day.
3. **User confusion on product boundaries**  
   Mitigation: hub copy + in-app directional CTAs.
4. **Scope creep (split + rename + feature work at once)**  
   Mitigation: enforce phase gates and conditional Phase F.

## 9) Governance and Cadence

- Weekly 30-minute program check-in.
- End-of-phase review with pass/fail against exit criteria.
- No advancement to next phase without explicit sign-off.

## 10) Ready-to-Start Backlog (Issue-Ready)

## Epic 1 — Hub MVP
- Build IA routes and page scaffolds.
- Implement home/product/audience/community/support sections.
- Add final CTA routing and nav/footer links.

## Epic 2 — Domain Cutover
- Configure DNS + Vercel domain mapping.
- Configure Supabase and Concept2 callback settings.
- Run full cutover validation script.

## Epic 3 — Analytics + Evidence
- Instrument required events.
- Build weekly funnel report template.
- Run interview protocol and summarize findings.

## Epic 4 — Decision Gate
- Fill decision worksheet scorecards.
- Write split decision memo.
- Write naming decision memo.

## Epic 5 — Conditional Execution
- Split execution tasks (if approved).
- Rename execution tasks (if approved).

## 11) Definition of Program Completion

Program is complete when:
1. Canonical domain ecosystem is live and stable.
2. Hub routes users correctly to product experiences.
3. Decision memo(s) for split and naming are finalized.
4. If split/rename approved: rollout completed with rollback window closed.
5. Working-memory artifacts updated for handoff and next planning cycle.
