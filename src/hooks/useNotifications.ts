import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import {
  clearNotifications,
  createNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationService';
import type { AppNotification } from '../types/notification.types';

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (n: AppNotification) => void;
  clearAll: () => void;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotificationState(): NotificationContextValue {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setNotifications([]);
      return () => {
        cancelled = true;
      };
    }

    fetchNotifications(user.id)
      .then((persistedNotifications) => {
        if (!cancelled) setNotifications(persistedNotifications);
      })
      .catch((error) => {
        console.error('Failed to load notifications:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );

    if (user) {
      markNotificationRead(id).catch((error) => {
        console.error('Failed to mark notification read:', error);
      });
    }
  }, [user]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    if (user) {
      markAllNotificationsRead(user.id).catch((error) => {
        console.error('Failed to mark all notifications read:', error);
      });
    }
  }, [user]);

  const addNotification = useCallback((n: AppNotification) => {
    setNotifications((prev) => [n, ...prev.filter((existing) => existing.id !== n.id)]);

    if (user) {
      createNotification(user.id, n)
        .then((persisted) => {
          setNotifications((prev) => [
            persisted,
            ...prev.filter((existing) => existing.id !== persisted.id),
          ]);
        })
        .catch((error) => {
          console.error('Failed to persist notification:', error);
        });
    }
  }, [user]);

  const clearAll = useCallback(() => {
    setNotifications([]);

    if (user) {
      clearNotifications(user.id).catch((error) => {
        console.error('Failed to clear notifications:', error);
      });
    }
  }, [user]);

  return useMemo(
    () => ({ notifications, unreadCount, markAsRead, markAllRead, addNotification, clearAll }),
    [notifications, unreadCount, markAsRead, markAllRead, addNotification, clearAll],
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}
