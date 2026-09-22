import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
it('keeps remaining athlete routes mobile-contained', () => {
  expect(read('./Analytics.tsx')).toContain('overflow-x-auto border-b');
  expect(read('./Sync.tsx')).toContain('grid-cols-[1fr,auto,1fr]');
  expect(read('./DevelopmentConcept2.tsx')).toContain('space-y-4 p-4');
  expect(read('./Preferences.tsx')).toContain('overflow-x-auto rounded-lg');
  expect(read('./WorkoutComparison.tsx')).toContain('min-h-11 min-w-11');
  expect(read('./WorkoutComparison.tsx')).toContain('overflow-x-auto');
});
