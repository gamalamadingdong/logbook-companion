import { supabase } from './supabase';
import type { AppNotification } from '../types/notification.types';

export type NewAppNotification = Omit<AppNotification, 'created_at'> & {
  created_at?: string;
  metadata?: Record<string, unknown>;
};

type AppNotificationRow = AppNotification & {
  user_id: string;
  read_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

function toNotification(row: AppNotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href ?? undefined,
    read: row.read,
    created_at: row.created_at,
  };
}

export async function fetchNotifications(userId: string, limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('app_notifications')
    .select('id, type, title, body, href, read, created_at, user_id, read_at, metadata')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) => toNotification(row as AppNotificationRow));
}

export async function createNotification(
  userId: string,
  notification: NewAppNotification,
): Promise<AppNotification> {
  const { data, error } = await supabase
    .from('app_notifications')
    .insert({
      id: notification.id,
      user_id: userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      href: notification.href,
      read: notification.read,
      created_at: notification.created_at,
      metadata: notification.metadata ?? {},
    })
    .select('id, type, title, body, href, read, created_at, user_id, read_at, metadata')
    .single();

  if (error) throw error;
  return toNotification(data as AppNotificationRow);
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('app_notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('app_notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
}

export async function clearNotifications(userId: string): Promise<void> {
  const { error } = await supabase
    .from('app_notifications')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}
