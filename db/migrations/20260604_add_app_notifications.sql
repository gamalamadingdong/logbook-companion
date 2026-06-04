-- Persistent in-app notifications for authenticated users.
CREATE TABLE IF NOT EXISTS public.app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (
    type IN (
      'assignment_created',
      'assignment_reminder',
      'pr_achieved',
      'athlete_joined',
      'score_entered',
      'system'
    )
  ),
  title text NOT NULL,
  body text NOT NULL,
  href text,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_created
  ON public.app_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_unread
  ON public.app_notifications (user_id, read, created_at DESC)
  WHERE read = false;

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.app_notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.app_notifications
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own notifications" ON public.app_notifications;
CREATE POLICY "Users can create their own notifications"
  ON public.app_notifications
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.app_notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.app_notifications
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.app_notifications;
CREATE POLICY "Users can delete their own notifications"
  ON public.app_notifications
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);
