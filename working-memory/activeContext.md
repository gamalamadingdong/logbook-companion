# Active Context

> Last updated: 2026-02-10

## Current Focus: Pass 3 — Post-Season-Start Enhancements

Season starts **February 17, 2026**. Passes 1 and 2 complete. Build is clean.

### Recent Fixes
- Removed stale `badge` rendering in `Layout.tsx` to unblock builds
- Accessibility cleanup: added `type="button"`, label associations, and icon-button `aria-label`s in `GoalsManager.tsx` and `ReconnectPrompt.tsx`
- Removed remaining `any` cast in `FeedbackModal.tsx` (typed feedback type options)
- Removed `any` from `RWNPlayground.tsx` by using `WorkoutStructure | null`
- Refactored `RWNPlayground.tsx` to derive parsed output via `useMemo` (no setState-in-effect)

### Pass 2 — Pre-Season Polish: ✅ COMPLETE
- [x] Remove "Alpha" badges from Library and Coaching nav links in `Layout.tsx`
- [x] Replace `window.confirm()` with styled dark-theme modal in `CoachingRoster.tsx`
- [x] Fix copyright `© 2024` → `© 2026` in `Layout.tsx`
- [x] Change default boat name from `'A Boat'` to placeholder in `CoachingBoatings.tsx`
- [x] Build verification (`tsc --noEmit` + `eslint src/`)

### GitHub Copilot Coding Agent: ✅ CONFIG FILES CREATED
- [x] Strengthened copilot-instructions.md — working memory rules promoted to Section 0
- [x] Created `.github/workflows/copilot-setup-steps.yml` (Node 20, npm ci, tsc --noEmit)
- [x] Created `.github/CODING_AGENT_SETUP.md` — MCP config reference (Supabase, Vercel, GitHub enhanced)
- [ ] **User action needed**: Paste MCP JSON into repo Settings → Copilot → Coding agent
- [ ] **User action needed**: Create `copilot` environment + add secrets (see CODING_AGENT_SETUP.md)

### Pass 3 (Post-Season-Start Enhancements)
- Dynamic coaching dashboard (aggregate stats, upcoming sessions)
- Form validation improvements (required fields, date ranges)
- Duplicate-athlete check on Roster add

---

## App Status

### CL → LC Merge: ✅ COMPLETE
All 5 phases done. CL repo (`gamalamadingdong/coaching-log`) archived on GitHub. Coaching module lives at `/coaching/*` with role-based gating (`isCoach` in AuthContext).

### Pass 1 — Coaching Module Hardening: ✅ COMPLETE (2026-02-10)
All 5 coaching pages have loading/error states, edit/delete UI, ESLint strict compliance:
- **CoachingSchedule** — Edit/delete sessions, `SessionForm` edit mode
- **CoachingLog** — Inline note editing, `notesVersion` counter (replaced setTimeout hack)
- **CoachingErgScores** — Delete scores
- **CoachingBoatings** — Edit/delete boatings, `BoatingForm` edit mode
- **CoachingRoster** — Full CRUD (from prior session)

### Service Layer: `src/services/coaching/coachingService.ts`
Full CRUD for all 5 Supabase coaching tables. Uses `throwOnError<T>()` with `PostgrestError`.

### Other Fixes (2026-02-10)
- `Preferences.tsx`: Added `aria-label` on sr-only toggle checkbox (axe compliance)
- `templateService.ts`: Added `canonical_name` to `fetchTemplates()` select clause

---

## Coaching Season Context
- **Season**: Feb 17 – May 2, 2026 (11 weeks to Virginia State Championships)
- **Athletes**: 13–14 year old novice boys, none have raced
- **Fleet**: 2 × 8+ (both boats race at States)
- **Staff**: Head coach + 2–3 assistants
- **Plans**: `kb/coaching-plans/novice-8th-boys-spring-2026.md`, `kb/coaching-plans/assistant-coach-cue-sheets.md`
- **Open items**: Coxswain plan TBD, assistant experience level TBD, parent email TBD

---

## Paused Work

### Digital Clipboard (Workout Capture via OCR)
Spec: `feature-specs/workout-capture-system.md`. Paused — requires Azure OCR deployment. Resume post-season.

---

## Key Architecture (Quick Reference)
- **RWN**: Rowing Workout Notation — interchange format. Spec in `rwn/RWN_spec.md`
- **Canonical Name**: Computed from main-block-only structure, used for template matching by string equality
- **Template Matching**: `canonical_name` is the join key. User templates prioritized over community.
- **Block Tags**: `[w]`/`[c]`/`[t]` for warmup/cooldown/test. Untagged = main. Tags stripped from canonical name.
- **Data Fetch Pattern**: `isLoading` initialized `true`, `.then()` in `useEffect`, `.finally(() => setIsLoading(false))`
- **ESLint**: Strict — `no-explicit-any`, `set-state-in-effect`, `no-unused-vars`
- **Sam's user ID**: `93c46300-57eb-48c8-b35c-cc49c76cfa66`, roles: `['athlete', 'coach']`

---

## ErgLink Integration (Future)
- Support `target_*_max` fields (ranges) in PM5 programming
- Enables: RWN → LC templates → ErgLink → PM5
