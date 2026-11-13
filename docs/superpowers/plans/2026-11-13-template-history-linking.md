# Manual template linking across matching history

Approved behavior: after choosing a template, offer linking this workout alone or all matching unlinked workouts in the athlete's own history. Show the exact preview count before any write.

Implementation:
- `workoutIdentity.ts` compares full ordered work/rest sequences, modality and explicit RWN guidance. Manual RWN takes precedence. Continuous Concept2 distance/time modes ignore recording splits; measured intensity does not become a prescription. Unknown modes, JustRow without a manual prescription, incomplete rests and unsupported orchestration/subsegments do not bulk-match. No RWN package or grammar change.
- `templateLinkingService.ts` scans owner-filtered, unlinked history with UUID cursor pagination and a narrow JSON projection excluding stroke streams. It records timestamps and prior links. Saves use owner, timestamp and previous-link guards, five requests at a time after saving the current workout first. History links are not replaced. Failures retain retry scope; skips are reported accurately.
- `TemplateLinkConfirmation.tsx` uses the shared Modal/Button components, cancellation, duplicate-submit protection, single/all choices, scan retry, partial-save feedback and failed-row retry. Successful saves close with a Sonner message. WorkoutDetail uses the flow from suggestions, template selection and new-template creation. Unlinking and the separate warmup-structure correction action keep their existing behavior.

Live read-only verification: existing SELECT/UPDATE workout-log policies restrict rows to `auth.uid() = user_id`. The `workout_logs_updated_at` BEFORE UPDATE trigger calls `update_updated_at()` and sets `NEW.updated_at = NOW()`. No schema migration or live linking write was needed.

Validation: focused identity/service/dialog/detail tests; full 502-test application suite; production build; lint with 0 errors and 115 existing warnings. Browser interaction was not verified in this session; dialog behavior is covered through jsdom. Changes remain local on `fix/concept2-continuous-names`.
