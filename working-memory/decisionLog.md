# Decision Log: Architectural Decision Records (ADRs)

**Format**: Each decision includes Context, Decision, Rationale, Consequences, and Alternatives Considered

---

## ADR-021: Public workout detail should lead with whiteboard + RWN, backed by a normalized DTO

**Date**: March 26, 2026
**Status**: Accepted
**Author**: User + AI Assistant

### Context

The public workout library and moderated proposal flow were already in place, but the detail page still reflected an internal template-management mindset:

1. the visualizer was the primary explanation surface,
2. RWN was present but secondary,
3. whiteboard format was not shown,
4. and raw JSON existed only as a developer-facing collapse block.

At the same time, the user wanted the library to be useful not only for humans browsing workouts, but also for AI-assisted workout-plan generation.

### Decision

Adopt a **three-layer public detail model**:

1. **Whiteboard view first** — the fastest human-readable explanation
2. **RWN second** — the canonical portable notation
3. **Structured data third** — a stable machine-readable contract

Back the detail page with a normalized public template DTO derived from `workout_templates` rather than letting each UI or future AI consumer reconstruct tier, whiteboard lines, and aggregate usage semantics independently.

Ratings are intentionally **not** a headline public signal in this slice; usage and reference counts are the primary trust signals until a proper rating model exists.

### Rationale

1. **Faster human understanding** — coaches and athletes can recognize the workout from the whiteboard view immediately
2. **Preserves RWN centrality** — RWN stays the canonical workout “DNA”
3. **Supports AI/planning reuse** — a normalized DTO is a better external contract than raw database rows
4. **Reduces drift** — derived semantics like tier and whiteboard lines are computed once in the service layer
5. **Avoids false authority** — ratings without trust thresholds or anti-gaming rules can mislead more than they help

### Consequences

**Positive**:
- the public library feels more like a knowledge base and less like an admin surface
- future AI/planning features can consume a stable template shape
- tiering and derived public fields are centralized

**Negative**:
- the app now maintains one more explicit read-model type
- a future public endpoint / Edge Function should reuse the DTO rather than bypass it
- ratings remain deferred work rather than immediate visible social proof

### Alternatives Considered

1. **Keep the visualizer as the dominant public explanation**
   - Rejected because it is useful but slower to parse than whiteboard text for most humans

2. **Expose raw `workout_templates` rows directly as the public AI contract**
   - Rejected because it would couple consumers to DB details and force duplicated tier/whiteboard derivation

3. **Prominently show ratings immediately**
   - Rejected because the current product does not yet have a trustworthy rating workflow or sampling policy

---

## ADR-020: Public workout library with separate moderated proposal queue

**Date**: March 25, 2026
**Status**: Accepted
**Author**: User + AI Assistant

### Context

The existing template system already had a global/shared library shape, RWN-backed authoring, and personal usage overlays. The open product question was how to evolve it into a community library without either:

1. requiring login for all browsing,
2. letting anonymous/unreviewed submissions pollute the canonical library,
3. or splitting workout definition logic across multiple incompatible models.

The user explicitly wanted a donation-funded, open-source, community-friendly direction where workout discovery should be public and contribution should be easy.

### Decision

Adopt a **three-layer workout library model**:

1. **Draft** — personal/in-progress templates (`status = 'draft'`)
2. **Community library** — public templates that are visible but not fully validated (`status = 'published'` and `validated = false`)
3. **Standard library** — public curated templates that are validated (`status = 'published'` and `validated = true`)

Raw submissions do **not** go directly into `workout_templates`. Instead, they enter a separate moderation queue in `workout_template_proposals`, where reviewers can:

- mark a proposal under review
- reject it
- promote it into the community library
- promote it into the standard library

### Rationale

1. **Supports public discovery** — the main library can be read without login
2. **Protects quality** — moderation becomes the control point instead of access friction
3. **Preserves canonical data hygiene** — unreviewed proposals stay out of the library table
4. **Reuses existing schema semantics** — `status` + `validated` already expressed most of the tier model
5. **Keeps RWN central** — proposals stay aligned with the existing RWN → structure → canonical-name pipeline

### Consequences

**Positive**:
- the app can evolve into a real community workout library without abandoning the existing template architecture
- public readers and anonymous contributors no longer require the same trust level
- admins can promote community knowledge into higher-trust library tiers

**Negative**:
- proposal moderation now needs its own RLS and reviewer UI
- public aggregate template stats may still require follow-up if related tables stay private under anon RLS
- the current admin-review policy still depends on the project’s existing single-admin ID convention

### Alternatives Considered

1. **Keep the entire library behind login**
   - Rejected because it weakens the open/community discovery goal

2. **Allow direct public inserts into `workout_templates`**
   - Rejected because it would mix unreviewed content with canonical library content immediately

3. **Create a completely separate public-library system unrelated to templates**
   - Rejected because it would duplicate workout-definition logic and drift away from the RWN-centered architecture already in place

---

## ADR-018: Coaching boats vs boating logs vs sessions

**Date**: March 20, 2026
**Status**: Accepted
**Author**: User + AI Assistant

### Context

The coaching module already had:

- `coaching_sessions` for dated practice sessions,
- `coaching_boatings` for dated lineups/notes,
- `coaching_athlete_notes` for rower-specific session notes.

However, the user’s mental model is not “a boating is just a one-off lineup.” It is:

1. the club has a finite set of real boats/shells in the boathouse,
2. each outing/session creates a dated record of how a given boat was rigged/rowed that day,
3. schedule and boating work should feel tightly coupled, especially for water sessions,
4. rower note context should be visible from the boating surface.

Live schema inspection showed that `coaching_boatings` already had a nullable `session_id`, which made it look more like an outing-log table than a persistent boat entity.

### Decision

Adopt a three-level model:

1. **Session** (`coaching_sessions`) = overall practice container
2. **Persistent boat/shell** (`coaching_boats`) = reusable physical boat
3. **Boating log** (`coaching_boatings`) = dated lineup/narrative record for a specific outing, optionally linked to a session

`coaching_boatings` keeps snapshot fields like `boat_name` and `boat_type` for historical stability, but now also gains `boat_id` pointing at the persistent parent.

### Rationale

1. **Matches the user’s real-world model** — coaches think about shells over time, not just anonymous daily lineups
2. **Preserves history safely** — old boating rows remain valid outing logs
3. **Fits live schema direction** — `session_id` already existed on `coaching_boatings`
4. **Supports tighter schedule coupling** — water sessions can own boating logs without forcing boating concepts onto erg/land/meeting sessions
5. **Avoids premature overbuild** — the expanded boating card can act as the first detail surface before committing to a dedicated route

### Consequences

**Positive**:
- schedule can remain the main planning/review hub
- water sessions can visibly own boating work
- boating logs can expose rower note context inline
- persistent boats can accumulate outing history over time

**Negative**:
- there is still some UI split between Schedule and Boatings in the first pass
- the first boating “detail” experience is an expanded card, not a dedicated page
- manual TypeScript coaching models still create some schema-drift risk without generated DB types

### Alternatives Considered

1. **Keep `coaching_boatings` as the only model**  
   Rejected because it does not represent persistent physical boats well and makes long-term boat history awkward.

2. **Fully merge boating CRUD into the schedule page immediately**  
   Deferred. Stronger coupling is desirable, but a full UI merge in one pass would have created more risk and surface area than needed.

3. **Create a separate boat-scoped rower-note table**  
   Rejected for v1. Existing athlete/session note models are sufficient for crew-context display and inline session-note editing.

---

## ADR-019: Session report becomes the canonical daily coaching record

**Date**: March 20, 2026
**Status**: Accepted
**Author**: User + AI Assistant

### Context

After multiple UX improvements, the coaching workflow was internally more consistent but still felt conceptually awkward to the user. The problem was not just page routing; it was the product model itself.

The current implementation still asks the coach to reason about:

- a session,
- a boating/log/lineup record,
- and the link between them.

The user clarified the real job-to-be-done:

1. click a day,
2. add a session report,
3. record what was done,
4. record who was in each boat,
5. leave notes another coach can later understand.

The user also clarified that lineups often change day to day, especially early in the season, which makes a live linked-boating mental model less useful than a daily snapshot model.

### Decision

Adopt a **session-first coaching model**:

1. **Session report** is the canonical daily record.
2. Daily crew/boat lineups should be stored as **snapshots inside the session report**.
3. `CoachingBoatings` should evolve into a **secondary templates/history surface** for reusable lineups, recent crews, and shell history.
4. The primary coach workflow should no longer depend on the concept of "linking a boating to a session" for ordinary daily use.

### Rationale

1. **Matches coaching workflow** — coaches think in terms of a practice day first, not cross-linked entities.
2. **Preserves historical truth** — once a session is saved, the lineup for that day should remain stable even if templates change later.
3. **Improves collaboration** — one coach can open the session report and immediately see the narrative plus who rowed where.
4. **Reduces UX overhead** — the primary action becomes "open session and record the day" instead of navigating between two co-equal pages.

### Consequences

**Positive**:
- the main schedule/session surface can become the true rowing-day workspace
- lineup templates can still exist without being the canonical saved record
- historical session review becomes clearer because lineups live with the session narrative

**Negative**:
- the current "session child boating log" implementation will need a follow-up redesign
- one open storage question remains: whether `coaching_boatings` becomes template/history storage or whether new session-owned snapshot tables should be introduced

### Alternatives Considered

1. **Keep improving the linked session + boating model**  
   Rejected. Although recent changes reduced confusion, the underlying concept still asks coaches to think about the wrong primary object.

2. **Fully remove the boating concept**  
   Rejected. Reusable lineups, recent crews, and shell history still provide value as helper/template tooling.

3. **Make Boatings the primary page and demote Schedule**  
   Rejected. The user explicitly wants to click a day and write the daily report from there.

---

## ADR-020: Session crew snapshots use dedicated tables; boatings remain templates/history

**Date**: March 21, 2026
**Status**: Accepted
**Author**: User + AI Assistant

### Context

ADR-019 established that the session report should become the canonical daily coaching record, but it intentionally left one implementation detail open:

- repurpose `coaching_boatings` into template/history storage,
- or introduce dedicated session-owned snapshot tables alongside it.

By implementation time, the existing system already had:

- `coaching_boats` as persistent physical shells,
- `coaching_boatings` as dated boating/log/history rows,
- `coaching_sessions` as the daily session report container.

The new requirement was to store the actual saved crew truth **inside the session** without making that truth depend on live boating linkage.

### Decision

Adopt **dedicated session-owned snapshot tables**:

1. `coaching_session_crews`
   - one row per saved crew snapshot inside a coaching session
   - includes boat snapshot fields plus optional references to a persistent boat and source boating template/history row

2. `coaching_session_crew_positions`
   - one row per seat assignment inside a session crew snapshot
   - includes `athlete_name` snapshot storage so historical reports survive later athlete deletion or roster changes

`coaching_boatings` remains a reusable **templates/history** source and is not repurposed into the canonical daily-report table.

### Rationale

1. **Preserves clean product boundaries** — session report owns daily truth; boating history remains helper tooling
2. **Avoids risky repurposing** — existing boating/history workflows and prior data stay valid
3. **Supports historical stability** — session snapshots keep their own copied crew state even if templates later change
4. **Enables safe migration** — existing `coaching_boatings.session_id` data could be backfilled into the new session-owned model

### Consequences

**Positive**:
- daily rowing records now have a dedicated storage model that matches the user workflow
- boating history can still power prefills/templates without being a fragile live dependency
- Schedule can evolve further without inheriting boating-linking constraints

**Negative**:
- coaching data model now has another pair of tables to maintain
- some product/UI copy still needs follow-up so the secondary Boatings page is consistently framed as templates/history

### Alternatives Considered

1. **Repurpose `coaching_boatings` into templates/history only**  
   Rejected. It would have mixed a product reframing with riskier storage/meaning changes to an already-used table.

2. **Keep `coaching_boatings` as the canonical daily session-child record**  
   Rejected. That would preserve the very abstraction ADR-019 was intended to move away from.

---

## ADR-017: ErgLink ↔ LogbookCompanion Integration Contract

**Date**: June 2025
**Status**: Accepted
**Author**: Sam Gammon + AI
**Cross-ref**: ErgLink ADR-007

### Context
ErgLink (EL) and LogbookCompanion (LC) share a single Supabase backend. Coaches create live erg sessions in LC and athletes join from EL. However, the data path between the two apps had 6 critical gaps:

1. **No shared workout identity** — EL uploads with generic name `'Live Session Workout'`, no `canonical_name` or `template_id`, so LC can't match to templates or assignments.
2. **No assignment linkage** — LC creates `group_assignments`, but EL has no visibility into them and doesn't tag uploads with `group_assignment_id`.
3. **`erg_sessions.active_workout` untyped** — The JSONB column was used by both apps with divergent local interfaces and `as any` casts.
4. **Reconciliation blind spot** — ADR-015 defines Gold/Silver/Bronze priority but EL wasn't populating the fields needed for matching (no `external_id`, timestamps approximate).
5. **EL data invisible to coaching views** — no LC queries filter for `source = 'erg_link_live'`.
6. **No C2 Logbook upload from EL** (future).

Two separate `WorkoutConfig` interfaces existed: EL's in `commands.ts` (PM5-centric) and LC's in `CoachSessions.tsx` (session-management-centric). Neither was shared, documented, or versioned.

### Decision
Define a **typed integration contract** in `src/types/ergSession.types.ts` (canonical in LC, mirrored in EL) covering:

1. **`ActiveWorkoutSpec`** — the shape LC writes to `erg_sessions.active_workout` and EL reads. Includes PM5 programming fields (`type`, `value`, `split_value`, `rest`, `repeats`, `intervals`) AND metadata fields (`canonical_name`, `template_id`, `group_assignment_id`, `title`, `start_type`). Versioned with `_v: 1`.

2. **`ErgLinkUploadMeta`** — the shape EL writes to `workout_logs.raw_data`. Includes `session_id`, `participant_id`, echoed metadata (`canonical_name`, `template_id`, `group_assignment_id`), and full stroke buffer.

3. **`SOURCE_PRIORITY`** — codifies ADR-015 priority: `manual/ocr=1`, `erg_link_live=2`, `concept2=3`.

4. **`ReconciliationMatch`** — defines dedup tolerances: ±5min timestamp, ±10m distance, ±2s duration.

5. **Column-level contract** — documents which `workout_logs` columns EL must populate vs which LC sets on reconciliation.

### Rationale
- **Shared types prevent integration bugs** — no more `as any` casts or divergent local interfaces.
- **Metadata passthrough** — EL echoes `canonical_name`/`template_id`/`group_assignment_id` from the active workout spec, enabling LC to auto-complete assignments and match templates without heuristic guessing.
- **Versioning** — `_v` field allows backward-compatible evolution. EL must handle missing fields gracefully.
- **Manual sync, not shared package** — Both repos get a copy of the contract file. A shared npm package is overkill for 2 consumers. Divergence risk is acceptable given low change frequency.

### Consequences
**Positive**:
- Both apps can type-check their Supabase reads/writes against the same interface
- EL uploads become visible in LC coaching views (template matching, assignment completion)
- Reconciliation can match EL uploads against C2 syncs reliably
- Clear documentation of which app owns which columns

**Negative**:
- Manual sync between repos — contract changes require updating both files
- EL needs code changes to populate new fields (migration work)
- LC's `CoachSessions.tsx` needs refactoring to use `ActiveWorkoutSpec` instead of local `WorkoutConfig`

### Alternatives Considered
1. **Shared npm package**: Type-safe but adds build complexity, versioning overhead, and publish pipeline for ~200 lines of types. Rejected as premature.
2. **Database-level validation (CHECK constraints / generated columns)**: Would enforce schema at DB layer but adds migration complexity and can't express the full TypeScript type system. May add later.
3. **No contract — just document column expectations**: Too fragile. Without types, `as any` casts proliferate and integration bugs surface in production.

### Implementation Notes
- Contract files: `LogbookCompanion/src/types/ergSession.types.ts` (canonical), `erg-link/src/types/ergSession.types.ts` (mirror)
- EL's internal `WorkoutConfig` (in `commands.ts`) remains for CSAFE frame construction — it's a PM5-specific concern. A conversion function will map `ActiveWorkoutSpec` → `WorkoutConfig`.
- LC's `CoachSessions.tsx` local `WorkoutConfig` should be replaced with `ActiveWorkoutSpec` in a follow-up PR.
- EL's `sessionService.ts` `uploadWorkoutLog()` needs updating to read metadata from the active workout spec and include it in the `workout_logs` insert.
- EL's `appStore.ts` `activeWorkout` type should be updated to `ActiveWorkoutSpec | null`.

---

## ADR-016: Organizations Layer (Org > Team Hierarchy)

**Date**: February 22, 2026
**Status**: Accepted
**Author**: User + AI Assistant

### Context
A coach may work at multiple clubs (e.g., Riverside RC + State University). Each club has multiple boats/squads represented as separate teams. The existing flat `teams` table + multi-team switcher produces a noisy dropdown when a coach has 5+ teams across clubs.

Additionally, the invite flow is team-level — athletes must know which specific boat to join. In practice, athletes join a *club* and the coach assigns them to a boat later.

### Decision
Add an `organizations` table as an optional grouping layer above `teams`:
- `organizations` — club/program with its own `invite_code`
- `organization_members` — owner/admin/coach roles (staff, not athletes)
- `teams.org_id` — nullable FK linking a team to its parent org

Athletes join an org via invite code; coaches assign them to teams within the org. Existing teams with `org_id = NULL` continue to work unchanged.

### Rationale
1. **Backward compatible** — nullable FK means zero impact on existing teams/code
2. **Matches mental model** — coaches think "Riverside RC → V8+, JV8+" not a flat list
3. **Invite simplification** — one code per club, not one per boat
4. **Future-proofs** — cross-team analytics, org-level settings, staff management all become possible
5. **Squads stay lightweight** — within a team, `squad` remains a free-text tag for A/B boat splits

### Alternatives Considered
- **Per-squad weekly plans** — rejected; using teams-as-squads is simpler and already works
- **Squads table with IDs** — deferred; free-text squads are sufficient for now
- **No org layer** — would work today but breaks down at multi-club scale

### Consequences
- Migration applied: `organizations`, `organization_members` tables + `teams.org_id` column
- Types added: `Organization`, `OrgRole`, `OrganizationMember`
- No UI changes yet — team switcher grouping deferred until needed
- Future work: org-scoped invite flow, grouped team switcher, org settings page

---

## ADR-015: Reconciliation Source Priority ("Swiss Cheese" Strategy)

**Date**: February 6, 2026
**Status**: Accepted
**Author**: AI Assistant

### Context
We capture workout data from multiple sources:
1.  **Manual Entry**: Fast, available to everyone, but low trust (typos).
2.  **Concept2 Logbook Sync**: High trust, verified data, but delayed (nightly/manual sync).
3.  **ErgLink Stream**: Real-time, high trust, but requires hardware.

We need to merge these streams without creating duplicate workout entries (e.g. "5k" manual entry AND "5k" C2 sync).

### Decision
**Implement a strict Source Priority Hierarchy ("Gold/Silver/Bronze"):**

-   **Gold (3)**: Concept2 Logbook (Verified Hardware Data)
-   **Silver (2)**: ErgLink Stream (Live Hardware Data)
-   **Bronze (1)**: Manual/OCR Entry (User Reported)

**Rule**: A workout log can only be updated by a source of **higher or equal** priority.
-   Manual (Bronze) -> C2 (Gold): **UPGRADE** (Update existing record).
-   C2 (Gold) -> Manual (Bronze): **IGNORE** (Keep existing high-quality record).

### Rationale
1.  **Single Source of Truth**: The most verifiable data wins.
2.  **User Convenience**: Users can log manually for instant gratification, knowing it will be "upgraded" to verified data later.
3.  **Data Integrity**: Prevents lower-quality manual data from overwriting hardware-verified data.

---

## ADR-013: Global Workout Library with Personal Usage Tracking

**Date**: February 4, 2026  
**Status**: Accepted  
**Author**: AI Assistant (User Decision)

### Context
During template library implementation, we needed to decide:
1. Should templates be per-user (private) or global (shared)?
2. Should `usage_count` show personal stats or community stats?
3. How do we balance team/coaching needs with personal tracking?

### Decision
**Templates are global/shared, but usage tracking is personal:**
- Template library shows ALL templates across all users
- Template detail page shows global `usage_count` (community popularity)
- Template library stat shows personal "X workouts categorized" count
- Each user's workout-template links are private

### Rationale
1. **Team/Coaching Platform**: Coaches create templates for entire team to use
2. **Community Discovery**: See what templates are popular across all users
3. **Personal Progress**: Still track your own adoption/categorization
4. **Best of Both Worlds**: Global resources + personal metrics

### Implementation
```typescript
// Template fetch: No user filter (global)
const templates = await fetchTemplates({ workoutType: 'erg' });

// Personal stats: User-filtered count
const { count } = await supabase
    .from('workout_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .not('template_id', 'is', null);
```

### Consequences
**Positive**:
- Coaches can create templates once, shared with whole team
- Athletes can discover popular community templates
- Personal progress still tracked ("347 workouts categorized")
- Enables future features: template recommendations, team challenges

**Negative**:
- Users see templates they may never use
- Could get cluttered with low-quality templates (needs moderation later)
- No "my templates" vs "community templates" distinction in UI yet

### Alternatives Considered
1. **Fully Private**: Each user sees only their own templates
   - PRO: Clean, personal library
   - CON: Coaches can't share, team coordination harder
   
2. **Hybrid**: Separate "My Templates" and "Community Templates"
   - PRO: Best organization
   - CON: More complex UI, premature for current user base

---

## ADR-014: Template Sorting Strategy (Popularity vs Recency)

**Date**: February 4, 2026  
**Status**: Accepted  
**Author**: AI Assistant

### Context
Template library needed a sensible default sort order. Two competing needs:
1. **Discovery**: New users want to see most popular/proven templates
2. **Active Training**: Regular users want recently used templates at top

### Decision
**Dual sort modes with "Most Popular" as default:**
- Default: Sort by `usage_count DESC` (global popularity)
- Alternative: Sort by `last_used_at DESC` (personal recency)
- User can toggle via dropdown in template library

### Rationale
1. **New User Experience**: "Most Popular" shows proven templates first
2. **Power User Experience**: "Recently Used" surfaces active training templates
3. **Data-Driven**: Both metrics automatically maintained by database triggers
4. **Low Complexity**: Simple dropdown, no complex filtering

### Implementation
```typescript
// Database trigger maintains both fields
CREATE TRIGGER trigger_update_template_usage_count
AFTER INSERT OR UPDATE OF template_id OR DELETE ON workout_logs
FOR EACH ROW
EXECUTE FUNCTION update_template_usage_count();

// Trigger updates: usage_count++, last_used_at = MAX(workout.created_at)

// UI sort options
<select value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
    <option value="popular">Most Popular</option>
    <option value="recent">Recently Used</option>
</select>
```

### Consequences
**Positive**:
- Automatic maintenance (no manual sorting logic)
- Serves both new and experienced users
- Performance: Indexed columns for fast sorting

**Negative**:
- Requires database migration (manual SQL execution needed)
- "Recently Used" only meaningful if user has linked workouts
- No "sort by name" option (could add later)

### Migration Status
**Pending**: `migration_add_last_used_at.sql` created but not applied
- Requires manual execution in Supabase SQL Editor (MCP lacks DDL permissions)
- Until applied, "Recently Used" sort will show all templates as null (undefined order)

---

## ADR-012: Template Quality Signals & Execution Tracking Strategy

**Date**: February 3, 2026  
**Status**: Proposed (Needs Decision)  
**Author**: AI Assistant

### Context
The database has rich quality metrics for `workout_templates`:
- `average_rating`, `rating_count` (user feedback)
- `usage_count`, `completion_rate` (engagement metrics)
- `validated` (expert approval)

These are currently **not exposed in the UI**. The question is: **How do we connect templates to actual workout execution?**

**Current System**:
- LogbookCompanion syncs completed workouts from Concept2 API (post-facto)
- Templates exist as "blueprints" but no "assign → execute → track" flow
- No way to know if a user "selected" a template vs. did a similar workout organically

### The Fundamental Question
**How do users interact with templates?**

### Option A: Retrospective Matching (Passive)
**Model**: User rows freely, system matches completed workouts to templates after the fact

**How it works**:
1. User completes workout on PM5
2. Sync from Concept2 API
3. Parser generates canonical name (`4x500m/1:00r`)
4. Match against templates with same canonical name
5. Prompt: "Was this workout based on [Template X]?"

**Pros**:
- No workflow changes (users keep rowing how they want)
- Works with existing PM5 setup
- Leverages RWN canonical names (the "Trinity")

**Cons**:
- Fuzzy matching (was `4x500m/1:05r` the same as template `4x500m/1:00r`?)
- Can't distinguish "used template" vs "coincidentally similar workout"
- Completion rate = meaningless (can't know if they intended to finish)

---

### Option B: Explicit Template Selection (Active)
**Model**: User selects template BEFORE workout, system tracks execution

**How it works**:
1. User browses template library
2. Clicks "Do This Workout"
3. **Sub-options**:
   - **B1 (PM5 Programming)**: Bluetooth/USB to PM5, program workout directly
   - **B2 (Manual Reference)**: Display workout on screen, user manually programs PM5
   - **B3 (Planned Workout)**: Mark as "planned", match post-sync

**Pros**:
- Clear intent tracking
- Accurate completion rates
- Can prompt for post-workout rating
- Enables "planned vs actual" analysis

**Cons**:
- Requires workflow change (users must "select" templates)
- B1 requires Bluetooth implementation (erg-link complexity)
- B2 requires user to manually mirror data (error-prone)
- B3 still has fuzzy matching issue

---

### Option C: Hybrid Approach
**Model**: Both passive matching + explicit selection

**How it works**:
1. **If user explicitly selects**: Track as "planned workout", strong link
2. **If synced workout matches template**: Suggest "Was this based on [X]?"
3. **Analytics distinguish**: "explicit uses" vs "possible matches"

**Pros**:
- Flexible (supports both power users and casual rowers)
- Gradual adoption (can add explicit selection later)
- Better data quality over time

**Cons**:
- Two tracking systems to maintain
- Complexity in analytics (how to weight "confirmed" vs "suggested" usage)

---

### Option D: Templates as Documentation Only
**Model**: Templates are reference/inspiration, not execution tracking

**How it works**:
- Templates are "workout recipes" users can browse
- No execution tracking at all
- Quality metrics come from explicit reviews only (not usage-based)

**Pros**:
- Simple, no execution complexity
- Aligns with current "sync-only" model

**Cons**:
- Loses valuable engagement data
- Can't measure which workouts are actually effective
- No feedback loop for template quality

---

### Recommended Decision Path

**Phase 1 (Now)**: Expose existing quality signals **without** execution tracking
- Show `validated`, `average_rating`, `rating_count` as badges
- Add "Review This Template" button (ratings without execution)
- Filter templates by quality/validation

**Phase 2 (Later)**: Implement retrospective matching (Option A or C)
- Use RWN canonical names to suggest template matches post-sync
- Prompt: "This looks like [Template]. Was it?"
- Track "confirmed matches" separately from "possible matches"

**Phase 3 (Future)**: Add explicit template selection (Option B or C)
- "Plan Workout" feature
- PM5 programming via Bluetooth (erg-link integration)
- Full planned-vs-actual analytics

### Open Questions
1. **Primary Use Case**: Are templates for "planning" or "inspiration"?
2. **User Workflow**: Do we want to change how users interact with workouts?
3. **PM5 Integration**: Is programming the monitor directly a goal?
4. **Data Quality**: Is fuzzy matching good enough, or do we need explicit tracking?

### Next Steps
- **Decision needed**: Which option aligns with product vision?
- **User Research**: How do coaches/athletes currently use workout templates?
- **Technical Spike**: How hard is PM5 Bluetooth programming?

---

## ADR-001: Instruction-Driven Over Code Generator

**Date**: December 15, 2025  
**Status**: Accepted  
**Author**: Sam Gammon

### Context
Initially planned to build a CLI generator (`npx @sge/generator new-app`) that would scaffold new projects. However, this approach has significant drawbacks:
- Complex to maintain (template files + generation logic)
- Less flexible than direct Copilot integration
- "Black box" generation obscures what's happening
- Hard to customize for specific business needs

### Decision
Use structured instruction files (`.github/instructions/`) with GitHub Copilot to guide implementation instead of a code generator.

### Rationale
1. **Copilot-native**: Instructions are automatically picked up by GitHub Copilot
2. **Transparent**: User sees exactly what's being created and why
3. **Flexible**: Easy to adapt instructions for specific business types
4. **Maintainable**: Markdown files are simpler than generation code
5. **Composable**: Mix and match patterns for specific needs

### Consequences
**Positive**:
- Easier to maintain and update
- More flexible for edge cases
- Better developer experience (understand what's happening)
- Leverages existing Copilot infrastructure

**Negative**:
- Requires GitHub Copilot (not free)
- Slightly less "automated" than CLI
- User needs to understand instruction structure

### Alternatives Considered
1. **Full CLI Generator**: Too complex, decided against
2. **Yeoman Generator**: Outdated tooling, rejected
3. **Manual README**: Not structured enough, too error-prone
4. **Hybrid Approach**: Generator + instructions, unnecessary complexity

### Implementation Notes
- Keep `generator/` directory as reference but deprecate
- Create comprehensive `.github/instructions/` structure
- Use Working Memory pattern for persistent context

---

## ADR-002: Working Memory Pattern for Persistent Context

**Date**: December 15, 2025  
**Status**: Accepted  
**Author**: Sam Gammon

### Context
LLMs are stateless - they reset memory with every new session. For long-term projects, this "amnesia" is a critical bottleneck. Developers lose context when starting new chat sessions.

### Decision
Implement a "Working Memory" - file-system-based context management using structured markdown files iworking-memorymemory/` directory.

### Rationale
1. **Persistence**: Files maintain state across chat sessions
2. **Explicit**: Clear documentation of decisions and state
3. **Copilot-compatible**: Instructions in main prompt enforce reading/writing
4. **Proven**: Pattern used successfully by colleagues
5. **Human-readable**: Developers can read files directly

### Consequences
**Positive**:
- Consistent context across sessions
- Clear project state documentation
- Prevents repeated setup questions
- Forces explicit decision tracking

**Negative**:
- Requires discipline to update files
- Additional file maintenance overhead
- Can become stale if not updated

### Alternatives Considered
1. **Chat History Only**: Too unreliable, rejected
2. **Database State**: Over-engineered, rejected
3. **Git Commit Messages**: Not structured enough, insufficient
4. **External Wiki**: Adds complexity, want single repo

### Implementation Notes
Files created:
- `projectBrief.md`: Mission and non-negotiables
- `productContext.md`: User problems and business model
- `activeContext.md`: Current state (updated frequently)
- `systemPatterns.md`: Architectural patterns
- `techContext.md`: Stack and configuration
- `decisionLog.md`: This file - ADRs
- `implementationLog.md`: Feature implementation history

---

## ADR-003: Multi-Tenant SaaS Architecture

**Date**: Early development  
**Status**: Accepted  
**Author**: Sam Gammon

### Context
Template needs to support multiple independent businesses using the same codebase/infrastructure.

### Decision
Implement complete multi-tenant isolation with `business_id` foreign keys and Row Level Security (RLS).

### Rationale
1. **Cost Efficiency**: One database for all businesses
2. **Simplified Deployment**: Single codebase deployment
3. **Data Isolation**: RLS ensures complete separation
4. **Proven Pattern**: ScheduleBoard v2 validates this approach

### Consequences
**Positive**:
- Lower infrastructure costs
- Easier to maintain (one codebase)
- Proven to work in production

**Negative**:
- RLS policies must be correct (security critical)
- Slightly more complex queries
- Migration complexity across tenants

### Alternatives Considered
1. **Separate Database Per Business**: Too expensive, rejected
2. **Separate Deployments**: Maintenance nightmare, rejected
3. **Application-Level Isolation**: Less secure, rejected

---

## ADR-004: Capacitor Over React Native

**Date**: Early development  
**Status**: Accepted  
**Author**: Sam Gammon

### Context
Need mobile app compilation for iOS and Android.

### Decision
Use Capacitor to wrap web app as native mobile app instead of React Native.

### Rationale
1. **Code Reuse**: Same codebase for web and mobile
2. **Web Standards**: Use familiar React + web APIs
3. **Simpler**: Less platform-specific code than React Native
4. **Proven**: ScheduleBoard v2 uses Capacitor successfully

### Consequences
**Positive**:
- Single codebase for all platforms
- Faster development
- Web developer skills transfer directly

**Negative**:
- Slightly less "native" feel than React Native
- Some performance limitations vs pure native
- Requires understanding of mobile web quirks

### Alternatives Considered
1. **React Native**: Different codebase, more complexity, rejected
2. **Flutter**: Different language (Dart), rejected
3. **Native iOS + Android**: Too slow, rejected
4. **PWA Only**: App Store presence important, rejected

---

## ADR-005: Three-Repo Architecture with Shared Type Convention

**Date:** 2026-02-15  
**Status:** Accepted  
**Context:** The ecosystem has three distinct apps (LC, EL, Hub) with different runtimes and deployment targets but a shared Supabase backend. The old `train-better` repo contained mixed mobile app code and is being archived.

**Decision:**
- **3 separate repos**: `logbook-companion` (Next.js/Vercel), `erg-link` (React Native/Expo), `train-better-hub` (Next.js/Vercel)
- **Shared type convention**: All repos use `src/lib/types/` with `database.ts` (generated), `shared.ts` (manual, kept in sync), `supabase.ts` (client), `index.ts` (barrel)
- **Single Supabase project** serving all three apps (shared auth, shared schema, app-specific RLS)
- **No shared npm package** for now — duplicate `shared.ts` across repos (< 200 LOC); revisit if drift becomes a problem

**Consequences:**
- Each repo deploys independently with zero coordination
- Type drift is possible but manageable at current scale (solo developer, 3 repos)
- Old `train-better` repo archived as reference; OCR code documented in `working-memory/train-better-ocr-integration-brief.md`
- Hub gets full Next.js treatment (not static) to support feedback forms, roadmap, docs, auth landing

**Alternatives Rejected:**
- Monorepo (Turborepo/Nx): Next.js + Expo in same monorepo creates tooling friction without team-scale benefit
- Shared npm package: Overhead of publishing/versioning not justified for < 200 LOC of shared types

---

## Template for Future ADRs

```markdown
## ADR-XXX: [Title]

**Date**: [YYYY-MM-DD]  
**Status**: [Proposed | Accepted | Deprecated | Superseded]  
**Author**: [Name]

### Context
[What's the situation? What problem are we solving?]

### Decision
[What did we decide to do?]

### Rationale
[Why did we make this decision? List key reasons.]

### Consequences
**Positive**:
- [Good outcome 1]
- [Good outcome 2]

**Negative**:
- [Trade-off 1]
- [Trade-off 2]

### Alternatives Considered
1. **[Alternative 1]**: [Why rejected]
2. **[Alternative 2]**: [Why rejected]

### Implementation Notes
[Any specific details about how this was implemented]
```
