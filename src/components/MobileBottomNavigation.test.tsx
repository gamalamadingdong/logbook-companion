import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { MobileBottomNavigation, mobileNavigationTabForPath } from './MobileBottomNavigation';

describe('mobile bottom navigation', () => {
  it.each([
    ['/', 'home'],
    ['/library/template-1', 'train'],
    ['/training-block', 'train'],
    ['/pm5', 'pm5'],
    ['/workout/workout-1', 'history'],
    ['/completed-workout/new', 'history'],
    ['/history/8x500m', 'history'],
    ['/compare/a/b', 'history'],
    ['/analytics', 'history'],
    ['/preferences', 'more'],
    ['/team-management', 'more'],
  ] as const)('maps %s to %s', (pathname, expected) => {
    expect(mobileNavigationTabForPath(pathname)).toBe(expected);
  });

  it('renders five touch-sized destinations and active state', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/pm5']}>
        <MobileBottomNavigation menuOpen={false} onMore={vi.fn()} />
      </MemoryRouter>,
    );

    expect(html).toContain('aria-label="Primary mobile navigation"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/library"');
    expect(html).toContain('href="/pm5"');
    expect(html).toContain('href="/analytics"');
    expect(html).toContain('PM5');
    expect(html).toContain('aria-current="page"');
    expect((html.match(/min-h-11/g) ?? [])).toHaveLength(5);
  });

  it('marks More active when its menu is open', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/pm5']}>
        <MobileBottomNavigation menuOpen onMore={vi.fn()} />
      </MemoryRouter>,
    );
    expect(html).toContain('aria-label="Close more navigation"');
    expect(html).toContain('aria-expanded="true"');
  });
});
