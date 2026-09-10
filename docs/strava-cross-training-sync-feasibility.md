# Strava Cross-Training Sync Feasibility — superseded

**This document has been merged into [`strava-sync-feasibility.md`](./strava-sync-feasibility.md), the single canonical assessment.**

The consolidation resolved two conflicts that existed between the earlier drafts:

1. **Reconciliation.** This draft's "reject `Rowing`/`VirtualRow` by sport type" approach was **superseded** — Concept2 BikeErg/SkiErg sessions surface on Strava under non-rowing sport types, so sport-type filtering alone cannot dedupe them. The canonical doc uses provenance-first reconciliation instead.
2. **Policy blocker.** This draft omitted **API Policy §5.3 (no use of Strava Data in the operation of an AI application)**, which is the highest-priority blocker for this repo specifically. The canonical doc leads with it.

See the canonical doc for the full assessment, feasibility matrix, repository seams, non-Strava fallback, and conditional implementation plan.
