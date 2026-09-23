import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

describe('athlete detail mobile layouts', () => {
  it('keeps workout charts compact and split tables contained at phone widths', () => {
    const workout = source('./WorkoutDetail.tsx');
    expect(workout).toContain('p-4 font-sans sm:p-6');
    expect(workout).toContain('h-64 w-full sm:h-[400px]');
    expect(workout).toContain('overflow-x-auto');
    expect(workout).toContain('min-w-[42rem]');
  });

  it('presents one selected training week with a compact seven-day phone selector', () => {
    const trainingBlock = source('./TrainingBlock.tsx');
    expect(trainingBlock).toContain('max-w-full gap-1.5 overflow-x-auto');
    expect(trainingBlock).toContain('grid grid-cols-7 gap-1');
    expect(trainingBlock).toContain('min-h-14 min-w-0');
    expect(trainingBlock).toContain("['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa']");
    expect(trainingBlock).toContain('min-h-11 min-w-12 shrink-0');
    expect(trainingBlock).toContain('Matching details');
  });

  it('uses mobile library cards and preserves the desktop table', () => {
    const library = source('./TemplateLibrary.tsx');
    expect(library).toContain('divide-y divide-neutral-800 md:hidden');
    expect(library).toContain('hidden w-full md:table');
    expect(library).toContain('min-h-11 w-full');
  });

  it('stacks library detail headers and keeps phone stats compact', () => {
    const detail = source('./TemplateDetail.tsx');
    expect(detail).toContain('flex flex-col gap-4 sm:flex-row');
    expect(detail).toContain('grid grid-cols-2 gap-3');
    expect(detail).toContain('p-4 sm:p-6');
  });
});
