import { Ellipsis, Home, Waves } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui';

export type MobileNavigationTab = 'home' | 'train' | 'more';

/**
 * Map a route to its bottom-navigation tab.
 *
 * Train owns the workout loop. Library and training-block select what to row,
 * so they belong to Train rather than to a separate destination. Everything
 * else is reached through the More drawer.
 */
export function mobileNavigationTabForPath(pathname: string): MobileNavigationTab {
  if (pathname === '/') return 'home';
  if (
    pathname.startsWith('/pm5')
    || pathname.startsWith('/library')
    || pathname.startsWith('/training-block')
  ) return 'train';
  return 'more';
}

const navigationItems = [
  { id: 'home' as const, label: 'Home', path: '/', icon: Home },
  { id: 'train' as const, label: 'Train', path: '/pm5', icon: Waves },
];

interface MobileBottomNavigationProps {
  menuOpen: boolean;
  onMore: () => void;
}

export function MobileBottomNavigation({ menuOpen, onMore }: MobileBottomNavigationProps) {
  const location = useLocation();
  const activeTab = menuOpen ? 'more' : mobileNavigationTabForPath(location.pathname);
  const baseClasses = 'min-h-11 flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 text-[11px] font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-focus';

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface-card/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch gap-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <Link
              key={item.id}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={twMerge(clsx(
                baseClasses,
                active
                  ? 'bg-accent-primary-surface text-accent-primary-text'
                  : 'text-content-muted hover:bg-surface-secondary hover:text-content-primary',
              ))}
            >
              <Icon aria-hidden="true" size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-current={activeTab === 'more' ? 'page' : undefined}
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={onMore}
          className={twMerge(clsx(
            baseClasses,
            activeTab === 'more'
              ? 'bg-accent-primary-surface text-accent-primary-text'
              : 'text-content-muted',
          ))}
        >
          <Ellipsis aria-hidden="true" size={20} />
          <span>More</span>
        </Button>
      </div>
    </nav>
  );
}
