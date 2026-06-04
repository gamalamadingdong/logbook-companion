import type { AppNotification, NotificationType } from '../types/notification.types';

interface NotificationFactoryInput {
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
}

function createNotificationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `notification-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function makeNotification(input: NotificationFactoryInput): AppNotification {
  return {
    id: createNotificationId(),
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href,
    read: false,
    created_at: new Date().toISOString(),
  };
}
