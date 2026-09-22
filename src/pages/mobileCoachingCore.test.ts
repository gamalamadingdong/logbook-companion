import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
it('keeps primary coaching routes mobile-safe', () => {
  expect(read('./coaching/CoachDashboard.tsx')).toContain('divide-y divide-neutral-800 md:hidden');
  const schedule = read('./coaching/CoachingSchedule.tsx');
  expect(schedule).toContain("matchMedia('(max-width: 767px)')");
  expect(schedule).toContain('grid w-full grid-cols-3');
  expect(read('./coaching/CoachingRoster.tsx')).toContain('md:hidden space-y-3');
  const athlete = read('./coaching/CoachingAthleteDetail.tsx');
  expect(athlete).toContain('flex flex-col gap-4 sm:flex-row');
  expect(athlete).toContain('swipe horizontally for all columns');
  expect(athlete).toContain('min-w-[52rem]');
});
