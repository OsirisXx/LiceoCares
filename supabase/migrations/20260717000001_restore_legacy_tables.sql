-- Reconciles the initial schema with the legacy database export.
-- Run after 20260717000000_initial_schema.sql and before importing CSV data.
-- Notification triggers are intentionally deferred until historical data has been imported.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id INTEGER PRIMARY KEY DEFAULT 1,
  daily_limit INTEGER NOT NULL DEFAULT 5,
  weekly_limit INTEGER NOT NULL DEFAULT 15,
  monthly_limit INTEGER NOT NULL DEFAULT 30,
  yearly_limit INTEGER NOT NULL DEFAULT 100,
  cooldown_minutes INTEGER NOT NULL DEFAULT 30,
  max_per_session INTEGER NOT NULL DEFAULT 3,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rate_limits_single_row CHECK (id = 1)
);

INSERT INTO public.rate_limits (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read rate limits" ON public.rate_limits;
CREATE POLICY "Anyone can read rate limits" ON public.rate_limits FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Authenticated users can manage rate limits" ON public.rate_limits;
CREATE POLICY "Authenticated users can manage rate limits" ON public.rate_limits
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE TABLE IF NOT EXISTS public.system_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  role_target VARCHAR(50),
  department_target VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_notifications_user ON public.system_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_system_notifications_role ON public.system_notifications(role_target);
CREATE INDEX IF NOT EXISTS idx_system_notifications_dept ON public.system_notifications(department_target);
CREATE INDEX IF NOT EXISTS idx_system_notifications_unread ON public.system_notifications(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_system_notifications_created ON public.system_notifications(created_at DESC);

CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_auth_user_department()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department::TEXT FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_notifications()
RETURNS SETOF public.system_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_role TEXT;
  current_department TEXT;
BEGIN
  SELECT role, department INTO current_role, current_department
  FROM public.users
  WHERE id = auth.uid();

  RETURN QUERY
  SELECT notification.*
  FROM public.system_notifications AS notification
  WHERE notification.is_read = FALSE
    AND (
      notification.user_id = auth.uid()
      OR (notification.role_target = current_role
          AND (notification.department_target IS NULL OR notification.department_target = current_department))
      OR (notification.role_target = 'admin' AND current_role = 'admin')
      OR (notification.role_target = 'super_admin' AND current_role = 'super_admin')
    )
  ORDER BY notification.created_at DESC
  LIMIT 20;
END;
$$;

ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.system_notifications;
CREATE POLICY "Users can view their own notifications" ON public.system_notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (role_target = public.get_auth_user_role()
        AND (department_target IS NULL OR department_target = public.get_auth_user_department()))
  );
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.system_notifications;
CREATE POLICY "Users can update their own notifications" ON public.system_notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (role_target = public.get_auth_user_role()
        AND (department_target IS NULL OR department_target = public.get_auth_user_department()))
  );
DROP POLICY IF EXISTS "System can insert notifications" ON public.system_notifications;
CREATE POLICY "System can insert notifications" ON public.system_notifications
  FOR INSERT WITH CHECK (TRUE);
