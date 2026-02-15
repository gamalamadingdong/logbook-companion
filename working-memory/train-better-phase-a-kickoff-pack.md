# Train Better Phase A Kickoff Pack

> Date: 2026-02-15  
> Purpose: Copy/paste-ready GitHub issues + board setup to execute Phase A from `train-better-change-roadmap-spec.md`.

## 1) Recommended Labels

Create these labels first so issues are searchable and board filters are useful:

- `program:train-better`
- `phase:A`
- `phase:B`
- `phase:C`
- `phase:D`
- `phase:E`
- `phase:F-conditional`
- `workstream:brand-ux`
- `workstream:platform-domains`
- `workstream:auth-integrations`
- `workstream:analytics-evidence`
- `workstream:change-ops`
- `risk:high`
- `dependency:external`
- `status:blocked`
- `status:ready`

---

## 2) Board Setup Checklist (Phase A)

Use one project board: **Train Better Change Program**

### Board columns
- Backlog
- Ready
- In Progress
- Blocked
- Review
- Done

### Custom fields (recommended)
- `Phase` (A, B, C, D, E, F)
- `Workstream` (Brand+UX, Platform+Domains, Auth+Integrations, Analytics+Evidence, Change Ops)
- `Owner`
- `Target Week`
- `Dependency` (DreamHost, Vercel, Supabase, Concept2, Resend, None)
- `Exit Criteria` (free text)

### Phase A definition of done
- All Phase B tasks are created, sized (S/M/L), owner-assigned, prioritized, and sequenced.
- External dependencies are identified and tagged.
- Exit criteria is attached to every epic and critical task.

---

## 3) Epic Issue Templates (Copy/Paste)

## Epic 1 — Hub MVP

### Title
`[Program][Epic 1] Hub MVP (train-better.app)`

### Body
```md
## Outcome
Ship an MVP umbrella hub that clearly routes users to Logbook Companion and ErgLink while preserving product distinction.

## Scope
- Home + Products + Athletes + Coaches + Community + Support pages
- CTA routing to `log.train-better.app`, `erg.train-better.app`, `docs.train-better.app`
- Baseline analytics instrumentation for hub routes and CTAs

## Workstream
Brand + UX, Analytics + Evidence

## Deliverables
- [ ] IA routes and page scaffolds
- [ ] Required content blocks implemented
- [ ] Navigation/footer route validation
- [ ] Baseline analytics events live in prod

## Dependencies
- [ ] Vercel deployment access
- [ ] Final copy review/approval

## Acceptance Criteria
- [ ] Hub deployed to production domain
- [ ] All primary CTAs resolve correctly
- [ ] Events: `hub_view`, `hub_cta_open_log_click`, `hub_cta_open_erg_click`, `hub_docs_click`

## Exit Criteria Mapping
Phase B exit criteria: Hub live + validated nav/CTA routes + baseline analytics flowing.

## Sizing / Priority
- Size: L
- Priority: P0
```

### Labels
`program:train-better`, `phase:B`, `workstream:brand-ux`, `workstream:analytics-evidence`, `status:ready`

---

## Epic 2 — Domain Cutover

### Title
`[Program][Epic 2] Domain + Integration Cutover` 

### Body
```md
## Outcome
Move canonical production experience to the train-better domain ecosystem with rollback safety.

## Scope
- DNS and domain mapping for canonical hosts
- TLS cert verification
- Legacy redirects
- Flow validation: login/reset/invite/C2 callback/sync

## Workstream
Platform + Domains, Auth + Integrations, Change Ops

## Deliverables
- [ ] DreamHost DNS records configured
- [ ] Vercel domain mapping complete
- [ ] Supabase Site URL + Redirect URLs updated
- [ ] Concept2 callback allowlist updated
- [ ] Validation script run + results logged
- [ ] Rollback checklist tested

## Dependencies
- [ ] DreamHost admin access
- [ ] Vercel admin access
- [ ] Supabase auth config access
- [ ] Concept2 app config access

## Acceptance Criteria
- [ ] Canonical URLs reachable with valid certs
- [ ] Legacy URLs redirect correctly
- [ ] Auth and invite flows pass
- [ ] C2 callback and sync pass

## Exit Criteria Mapping
Phase C exit criteria: runbook completion + no blocking failures + rollback tested.

## Sizing / Priority
- Size: L
- Priority: P0
```

### Labels
`program:train-better`, `phase:C`, `workstream:platform-domains`, `workstream:auth-integrations`, `workstream:change-ops`, `risk:high`, `dependency:external`

---

## Epic 3 — Analytics + Evidence

### Title
`[Program][Epic 3] Analytics + Evidence Collection` 

### Body
```md
## Outcome
Collect evidence required for split/rename decisions after stabilization.

## Scope
- Event taxonomy implementation and QA
- Weekly funnel and trend reporting
- Coach/athlete interview protocol and summaries
- Support signal logging for naming/boundary confusion

## Workstream
Analytics + Evidence, Change Ops

## Deliverables
- [ ] Required events instrumented and validated
- [ ] Weekly reporting template created
- [ ] 30+ day data collection window executed
- [ ] Interview notes and support log completed
- [ ] Decision worksheet inputs compiled

## Dependencies
- [ ] Analytics pipeline access
- [ ] Stakeholder interview availability

## Acceptance Criteria
- [ ] 30+ days of production data available
- [ ] Funnel and coach-journey trend reported weekly
- [ ] Decision worksheet evidence checklist complete

## Exit Criteria Mapping
Phase D exit criteria: worksheet complete with recommendation.

## Sizing / Priority
- Size: M
- Priority: P1
```

### Labels
`program:train-better`, `phase:D`, `workstream:analytics-evidence`, `workstream:change-ops`, `status:ready`

---

## Epic 4 — Decision Gate

### Title
`[Program][Epic 4] Decision Gate (Split + Naming)`

### Body
```md
## Outcome
Produce explicit go/no-go decisions for coaching app split and naming strategy.

## Scope
- Scorecards and thresholds from decision worksheet
- Decision memo for split/no-split
- Decision memo for keep/rename
- Next-quarter roadmap update

## Workstream
Program Governance

## Deliverables
- [ ] Decision worksheet fully scored
- [ ] Split decision memo published
- [ ] Naming decision memo published
- [ ] Roadmap updated and communicated

## Dependencies
- [ ] Phase D evidence complete

## Acceptance Criteria
- [ ] Decisions are explicit and threshold-backed
- [ ] Outcomes recorded in working memory (`decisionLog.md` and `activeContext.md`)

## Exit Criteria Mapping
Phase E exit criteria: decisions recorded and roadmap updated.

## Sizing / Priority
- Size: S
- Priority: P0
```

### Labels
`program:train-better`, `phase:E`, `status:ready`

---

## Epic 5 — Conditional Execution

### Title
`[Program][Epic 5] Conditional Execution (Split and/or Rename)`

### Body
```md
## Outcome
Execute approved split and/or rename tracks only if Phase E returns GO.

## Trigger
This epic remains blocked until Decision Gate approves execution.

## Scope
### Split track
- Boundary hardening
- `coach.train-better.app` shell
- Route migration + onboarding updates
- Support docs + rollback path

### Rename track
- Dual-label rollout
- Surface-by-surface UI/content updates
- Docs/public links refresh
- Deprecation timeline

## Workstream
Brand + UX, Platform + Domains, Auth + Integrations, Change Ops

## Deliverables
- [ ] Approved track plan converted to sprint tasks
- [ ] Cutover validation passed
- [ ] Rollback window closed
- [ ] Support/confusion metrics stable or improved

## Dependencies
- [ ] Decision Gate GO

## Acceptance Criteria
- [ ] Only approved track(s) executed
- [ ] No regression in critical auth/invite/sync flows
- [ ] User confusion/support tickets not worsened

## Exit Criteria Mapping
Phase F exit criteria: cutover pass + stable support signals.

## Sizing / Priority
- Size: L
- Priority: P1
```

### Labels
`program:train-better`, `phase:F-conditional`, `status:blocked`

---

## 4) Phase A Task Issue Template (Use for all setup tasks)

### Title
`[Program][Phase A][Task] <Short task name>`

### Body
```md
## Objective
<What this task accomplishes>

## Workstream
<Brand+UX | Platform+Domains | Auth+Integrations | Analytics+Evidence | Change Ops>

## Steps
- [ ] Step 1
- [ ] Step 2
- [ ] Step 3

## Dependencies
- [ ] <None or external dependency>

## Acceptance Criteria
- [ ] Clear, testable outcome

## Sizing / Priority
- Size: <S/M/L>
- Priority: <P0/P1/P2>

## Exit Criteria Link
<Reference the relevant phase exit criteria>
```

### Labels
`program:train-better`, `phase:A`, `status:ready`

---

## 5) Suggested Initial Phase A Task List

Create these tasks under Epic 1 and Epic 2 first:

1. `[Phase A][Task] Create Train Better project board and fields`
2. `[Phase A][Task] Add labels and naming conventions`
3. `[Phase A][Task] Break down Hub MVP into page-level tasks`
4. `[Phase A][Task] Break down Domain Cutover runbook into execution tasks`
5. `[Phase A][Task] Assign owners and target weeks for all Phase B tasks`
6. `[Phase A][Task] Size all Phase B tasks and prioritize`
7. `[Phase A][Task] Tag external dependencies and blockers`
8. `[Phase A][Task] Final Phase A review against DoD`

---

## 6) 30-Minute Kickoff Agenda (Optional)

- 5 min: Confirm phases, epics, and non-goals
- 10 min: Walk through Epic 1 + Epic 2 tasks/dependencies
- 10 min: Owner assignment + sequencing
- 5 min: Confirm Phase A DoD and next checkpoint date
