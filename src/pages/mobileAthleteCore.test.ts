import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

describe('athlete-critical mobile layout contracts', () => {
  it('uses compact dashboard padding and two-column summary widgets at 320px', () => {
    const dashboard = source('./Dashboard.tsx');
    expect(dashboard).toContain('min-h-screen bg-neutral-900 p-4 text-white sm:p-8');
    expect(dashboard).toContain('grid grid-cols-2 gap-3 sm:gap-6');
    expect(dashboard).toContain('w-full items-center justify-center');
  });

  it('keeps completed-workout save controls above the mobile bottom navigation', () => {
    const entry = source('./CompletedWorkoutEntry.tsx');
    expect(entry).toContain('bottom-[calc(4rem+env(safe-area-inset-bottom))]');
    expect(entry).toContain('md:bottom-0');
  });

  it('uses stacked detail actions and a non-scrolling mobile segment grid', () => {
    const detail = source('./CompletedWorkoutEntryDetail.tsx');
    const segments = source('../components/completed-workout/SegmentGrid.tsx');
    expect(detail).toContain('grid grid-cols-1 gap-3 sm:flex');
    expect(detail).toContain('grid grid-cols-2 gap-3 sm:flex');
    expect(segments).not.toContain('overflow-x-auto');
    expect(segments).toContain('lg:grid-cols-');
  });
});
