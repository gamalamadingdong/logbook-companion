import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { MobileBottomNavigation, mobileNavigationTabForPath } from './MobileBottomNavigation';

describe('mobile bottom navigation', () => {
  it.each([
    ['/', 'home'],
    ['/pm5', 'train'],
    ['/library/template-1', 'train'],
    ['/training-block', 'train'],
    ['/workout/workout-1', 'more'],
    ['/completed-workout/new', 'more'],
    ['/history/8x500m', 'more'],
    ['/compare/a/b', 'more'],
    ['/analytics', 'more'],
    ['/preferences', 'more'],
    ['/team-management', 'more'],
  ] as const)('maps %s to %s', (pathname, expected) => {
    expect(mobileNavigationTabForPath(pathname)).toBe(expected);
  });

  it('renders Home, Train and More as touch-sized destinations', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/pm5']}>
        <MobileBottomNavigation menuOpen={false} onMore={vi.fn()} />
      </MemoryRouter>,
    );

    expect(html).toContain('aria-label="Primary mobile navigation"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/pm5"');
    expect(html).toContain('Train');
    expect(html).toContain('More');
    expect(html).toContain('aria-current="page"');
    expect((html.match(/min-h-11/g) ?? [])).toHaveLength(3);
  });

  it('no longer exposes PM5 or History as separate tabs', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/']}>
        <MobileBottomNavigation menuOpen={false} onMore={vi.fn()} />
      </MemoryRouter>,
    );

    expect(html).not.toContain('href="/analytics"');
    expect(html).not.toContain('href="/library"');
  });

  it('marks More active and announces a dialog when its menu is open', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/pm5']}>
        <MobileBottomNavigation menuOpen onMore={vi.fn()} />
      </MemoryRouter>,
    );
    expect(html).toContain('aria-label="Close navigation menu"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-haspopup="dialog"');
  });
});
