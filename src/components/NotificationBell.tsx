import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ClipboardList,
  Trophy,
  UserPlus,
  BarChart3,
  Info,
  CheckCheck,
  Trash2,
} from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import type { NotificationType } from '../types/notification.types';

const typeIcon: Record<NotificationType, React.FC<{ size?: number; className?: string }>> = {
  assignment_created: ClipboardList,
  assignment_reminder: ClipboardList,
  pr_achieved: Trophy,
  athlete_joined: UserPlus,
  score_entered: BarChart3,
  system: Info,
};

interface NotificationBellProps {
  variant?: 'sidebar' | 'icon';
  align?: 'left' | 'right';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  variant = 'sidebar',
  align = 'left',
}) => {
  const { notifications, unreadCount, markAsRead, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const buttonClass = variant === 'icon'
    ? 'relative flex h-10 w-10 items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800/70 rounded-lg transition-colors'
    : 'relative flex items-center gap-3 px-4 py-3 w-full text-left text-neutral-400 hover:text-white hover:bg-neutral-800/50 rounded-lg transition-all';

  const panelClass = variant === 'icon'
    ? `absolute top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'} w-[min(22rem,calc(100vw-2rem))] max-h-[28rem] overflow-y-auto bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl z-[70]`
    : 'absolute left-full ml-2 bottom-0 w-80 max-h-96 overflow-y-auto bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl z-[60]';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={buttonClass}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={variant === 'icon' ? 19 : 20} />
        {variant === 'sidebar' && <span className="hidden md:inline">Notifications</span>}
        {unreadCount > 0 && (
          <span className={variant === 'icon'
            ? 'absolute -right-1 -top-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white'
            : 'absolute top-2 left-8 md:static md:ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold text-white bg-red-500 rounded-full'}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={panelClass} role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-700/50">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <CheckCheck size={14} />
                  Read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="flex items-center gap-1 text-xs text-neutral-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 size={14} />
                  Clear
                </button>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-neutral-500">
              <Bell size={32} className="mb-3 opacity-40" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-800">
              {notifications.map((n) => {
                const Icon = typeIcon[n.type] ?? Info;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.read) markAsRead(n.id);
                        if (n.href) {
                          setOpen(false);
                          navigate(n.href);
                        }
                      }}
                      className={`flex items-start gap-3 w-full text-left px-4 py-3 hover:bg-neutral-800/60 transition-colors ${
                        !n.read ? 'bg-neutral-800/30' : ''
                      }`}
                    >
                      <div className={`mt-0.5 shrink-0 ${!n.read ? 'text-emerald-400' : 'text-neutral-500'}`}>
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm truncate ${!n.read ? 'font-semibold text-white' : 'text-neutral-300'}`}>
                            {n.title}
                          </span>
                          {!n.read && <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-400" />}
                        </div>
                        <p className="text-xs text-neutral-400 line-clamp-2 mt-0.5">{n.body}</p>
                        <span className="text-[11px] text-neutral-500 mt-1 block">{timeAgo(n.created_at)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
