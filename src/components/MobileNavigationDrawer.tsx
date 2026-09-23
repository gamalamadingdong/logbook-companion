import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  Blocks,
  BookOpen,
  ChartNoAxesColumn,
  ClipboardList,
  Database,
  Library,
  MessageSquare,
  Plus,
  Settings,
  Users,
} from 'lucide-react';
import { Sheet } from './ui';

interface DrawerItem {
  path: string;
  label: string;
  icon: ComponentType<{ size?: number | string; className?: string }>;
}

interface DrawerGroup {
  title: string;
  items: DrawerItem[];
}

interface MobileNavigationDrawerProps {
  open: boolean;
  onClose: () => void;
  isCoach: boolean;
  isAdmin: boolean;
}

export function buildDrawerGroups(isCoach: boolean, isAdmin: boolean): DrawerGroup[] {
  const groups: DrawerGroup[] = [
    {
      title: 'Train',
      items: [
        { path: '/library', label: 'Library', icon: Library },
        { path: '/training-block', label: 'Training block', icon: Blocks },
        { path: '/completed-workout/new', label: 'Log a workout', icon: Plus },
      ],
    },
    {
      title: 'Review',
      items: [
        { path: '/analytics', label: 'Analytics', icon: ChartNoAxesColumn },
        { path: '/sync', label: 'Concept2 sync', icon: Database },
      ],
    },
  ];

  if (isCoach) {
    groups.push({
      title: 'Team',
      items: [
        { path: '/team-management', label: 'Team', icon: Users },
        { path: '/team-management/roster', label: 'Roster', icon: Users },
        { path: '/team-management/schedule', label: 'Schedule', icon: ClipboardList },
        { path: '/team-management/assignments', label: 'Assignments', icon: ClipboardList },
      ],
    });
  }

  const support: DrawerItem[] = [
    { path: '/docs', label: 'Documentation', icon: BookOpen },
  ];
  if (isAdmin) {
    support.push({ path: '/feedback', label: 'Feedback', icon: MessageSquare });
  }
  groups.push({ title: 'Support', items: support });

  return groups;
}

/**
 * Navigation drawer opened from the bottom-bar overflow control.
 *
 * Owns navigation only. Identity and preferences belong to the account sheet,
 * so no destination appears in both menus.
 */
export function MobileNavigationDrawer({
  open,
  onClose,
  isCoach,
  isAdmin,
}: MobileNavigationDrawerProps) {
  const groups = buildDrawerGroups(isCoach, isAdmin);

  return (
    <Sheet open={open} onClose={onClose} title="Menu" description="Everything outside the workout loop">
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-content-muted">
              {group.title}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className="flex min-h-11 items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-content-muted">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-content-primary">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

interface AccountSheetProps {
  open: boolean;
  onClose: () => void;
  displayName: string;
  email?: string;
  onSignOut: () => void;
}

const accountItems: DrawerItem[] = [
  { path: '/preferences', label: 'Settings', icon: Settings },
];

/**
 * Account sheet opened from the header avatar. Identity and preferences only.
 */
export function AccountSheet({
  open,
  onClose,
  displayName,
  email,
  onSignOut,
}: AccountSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={displayName} description={email}>
      <div className="space-y-2">
        {accountItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <Icon size={18} className="text-content-muted" />
              <span className="text-sm font-medium text-content-primary">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => {
            onClose();
            onSignOut();
          }}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left text-accent-danger-text transition-colors hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <span className="text-sm font-medium">Sign out</span>
        </button>
      </div>
    </Sheet>
  );
}
