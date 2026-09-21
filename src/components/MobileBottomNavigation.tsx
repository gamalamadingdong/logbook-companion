import { Bluetooth, ChartNoAxesColumn, Ellipsis, Home, Library } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui';

export type MobileNavigationTab = 'home' | 'train' | 'pm5' | 'history' | 'more';

export function mobileNavigationTabForPath(pathname: string): MobileNavigationTab {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/pm5')) return 'pm5';
  if (pathname.startsWith('/library') || pathname.startsWith('/training-block')) return 'train';
  if (
    pathname.startsWith('/workout/')
    || pathname.startsWith('/completed-workout/')
    || pathname.startsWith('/history/')
    || pathname.startsWith('/compare/')
    || pathname.startsWith('/analytics')
  ) return 'history';
  return 'more';
}

const navigationItems = [
  { id: 'home' as const, label: 'Home', path: '/', icon: Home },
  { id: 'train' as const, label: 'Train', path: '/library', icon: Library },
  { id: 'pm5' as const, label: 'PM5', path: '/pm5', icon: Bluetooth },
  { id: 'history' as const, label: 'History', path: '/analytics', icon: ChartNoAxesColumn },
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
          aria-label={menuOpen ? 'Close more navigation' : 'Open more navigation'}
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
