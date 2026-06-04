import { supabase } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import type { AppNotification, NotificationType } from '../types/notification.types';

export type NewAppNotification = Omit<AppNotification, 'created_at'> & {
  created_at?: string;
  metadata?: AppNotificationInsert['metadata'];
};

type AppNotificationRow = Database['public']['Tables']['app_notifications']['Row'];
type AppNotificationInsert = Database['public']['Tables']['app_notifications']['Insert'];
type AppNotificationUpdate = Database['public']['Tables']['app_notifications']['Update'];

const typedSupabase = supabase as SupabaseClient<Database>;

const appNotificationSelect = 'id, type, title, body, href, read, created_at, user_id, read_at, metadata';

function toNotification(row: AppNotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    href: row.href ?? undefined,
    read: row.read,
    created_at: row.created_at,
  };
}

export async function fetchNotifications(userId: string, limit = 50): Promise<AppNotification[]> {
  const { data, error } = await typedSupabase
    .from('app_notifications')
    .select(appNotificationSelect)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(toNotification);
}

export async function createNotification(
  userId: string,
  notification: NewAppNotification,
): Promise<AppNotification> {
  const insertNotification: AppNotificationInsert = {
    id: notification.id,
    user_id: userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    href: notification.href,
    read: notification.read,
    created_at: notification.created_at,
    metadata: notification.metadata ?? {},
  };

  const { data, error } = await typedSupabase
    .from('app_notifications')
    .insert(insertNotification)
    .select(appNotificationSelect)
    .single();

  if (error) throw error;
  return toNotification(data);
}

export async function markNotificationRead(id: string): Promise<void> {
  const updateNotification: AppNotificationUpdate = {
    read: true,
    read_at: new Date().toISOString(),
  };

  const { error } = await typedSupabase
    .from('app_notifications')
    .update(updateNotification)
    .eq('id', id);

  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const updateNotification: AppNotificationUpdate = {
    read: true,
    read_at: new Date().toISOString(),
  };

  const { error } = await typedSupabase
    .from('app_notifications')
    .update(updateNotification)
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
}

export async function clearNotifications(userId: string): Promise<void> {
  const { error } = await typedSupabase
    .from('app_notifications')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}

export async function notifyAssignmentCreated(
  groupAssignmentId: string,
  actorUserId: string,
): Promise<number> {
  const { data, error } = await typedSupabase.rpc('notify_assignment_created', {
    p_group_assignment_id: groupAssignmentId,
    p_actor_user_id: actorUserId,
  });

  if (error) throw error;
  return data ?? 0;
}

export async function notifyScoreEntered(
  scoreId: string,
  actorUserId: string,
): Promise<number> {
  const { data, error } = await typedSupabase.rpc('notify_score_entered', {
    p_score_id: scoreId,
    p_actor_user_id: actorUserId,
  });

  if (error) throw error;
  return data ?? 0;
}

