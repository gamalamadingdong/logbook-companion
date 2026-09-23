import { describe, expect, it } from 'vitest';
import { buildDrawerGroups } from './MobileNavigationDrawer';

const pathsOf = (isCoach: boolean, isAdmin: boolean) =>
  buildDrawerGroups(isCoach, isAdmin).flatMap(group => group.items.map(item => item.path));

describe('mobile navigation drawer groups', () => {
  it('always offers the training and review destinations', () => {
    const paths = pathsOf(false, false);
    expect(paths).toContain('/library');
    expect(paths).toContain('/training-block');
    expect(paths).toContain('/completed-workout/new');
    expect(paths).toContain('/analytics');
    expect(paths).toContain('/sync');
  });

  it('hides the team group from athletes', () => {
    const titles = buildDrawerGroups(false, false).map(group => group.title);
    expect(titles).not.toContain('Team');
    expect(pathsOf(false, false).some(path => path.startsWith('/team-management'))).toBe(false);
  });

  it('shows the team group to coaches', () => {
    const titles = buildDrawerGroups(true, false).map(group => group.title);
    expect(titles).toContain('Team');
    expect(pathsOf(true, false)).toContain('/team-management/roster');
  });

  it('restricts feedback to admins', () => {
    expect(pathsOf(false, false)).not.toContain('/feedback');
    expect(pathsOf(false, true)).toContain('/feedback');
  });

  it('keeps settings out of the drawer so it is not duplicated in the account sheet', () => {
    // Settings is reached only from the header avatar. Listing it in both menus
    // would reintroduce the duplicate-affordance problem the drawer replaced.
    expect(pathsOf(true, true)).not.toContain('/preferences');
  });

  it('never lists the same destination twice', () => {
    const paths = pathsOf(true, true);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
