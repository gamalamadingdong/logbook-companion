import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
it('keeps secondary coach and team routes mobile-safe', () => {
  expect(read('./coaching/CoachingAssignments.tsx')).toContain('aria-label="Assignment matrix; scroll horizontally');
  expect(read('./coaching/AssignmentResults.tsx')).toContain('aria-label="Assignment results; scroll horizontally');
  expect(read('./coaching/CoachingBoatings.tsx')).toContain('aria-label="Boat seats; scroll horizontally');
  expect(read('./coaching/TeamAnalytics.tsx')).toContain('aria-label="Team leaderboard; scroll horizontally');
  expect(read('./coaching/CoachingSettings.tsx')).toContain('grid grid-cols-1 gap-3');
  expect(read('./coaching/TeamSetup.tsx')).toContain('p-4 sm:p-6');
  expect(read('./coaching/RequestCoachingAccess.tsx')).toContain('p-4 sm:p-8');
  expect(read('./team/MyTeamDashboard.tsx')).toContain('flex flex-col gap-4 sm:flex-row');
  expect(read('./team/MyTeamNotes.tsx')).toContain('px-4 py-4 pb-24');
  expect(read('./team/MyTeamSettings.tsx')).toContain('px-4 py-4 pb-24');
});
