-- LiceoCares canonical clean-database schema
-- Run once in the target project's Supabase SQL Editor, or apply with `supabase db push` after linking.
-- This defines application structure only. It does not migrate existing table rows, Auth users, or Storage objects.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  full_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  head_name VARCHAR(255),
  head_email VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  student_id TEXT,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  attachment_url TEXT,
  resolution_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'rejected', 'in_progress', 'resolved', 'closed', 'disputed')),
  assigned_department TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_remarks TEXT,
  department_remarks TEXT,
  resolution_details TEXT,
  verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  started_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  disputed_at TIMESTAMPTZ,
  dispute_reason TEXT,
  user_verified BOOLEAN NOT NULL DEFAULT FALSE,
  additional_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_trail (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.complaint_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL CHECK (user_role IN ('student', 'admin', 'department')),
  comment_text TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  author_type VARCHAR(50) NOT NULL CHECK (author_type IN ('complainant', 'admin', 'department')),
  author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  avatar_url TEXT,
  student_id VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.login_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_type VARCHAR(50),
  browser VARCHAR(100),
  os VARCHAR(100),
  location_country VARCHAR(100),
  location_city VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logged_out_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.complaint_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  device_type VARCHAR(50),
  browser VARCHAR(100),
  os VARCHAR(100),
  fingerprint VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rate_limit_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value INTEGER NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.blocked_ips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address VARCHAR(45) NOT NULL UNIQUE,
  reason TEXT,
  blocked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_permanent BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.system_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action VARCHAR(255) NOT NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_email VARCHAR(255),
  target_type VARCHAR(100),
  target_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  audit_logging BOOLEAN NOT NULL DEFAULT TRUE,
  two_factor_auth BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  public_registration BOOLEAN NOT NULL DEFAULT TRUE,
  auto_backup BOOLEAN NOT NULL DEFAULT TRUE,
  allow_guest_login BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.departments (name, code, description, is_active) VALUES
  ('Academic Affairs', 'academic', 'Handles academic-related concerns and inquiries', TRUE),
  ('Facilities Management', 'facilities', 'Manages campus facilities and maintenance', TRUE),
  ('Finance Office', 'finance', 'Handles financial matters and billing concerns', TRUE),
  ('Staff Relations', 'staff', 'Staff behavior and conduct issues', TRUE),
  ('Human Resources', 'hr', 'Manages employee and staff-related concerns', TRUE),
  ('Security Office', 'security', 'Handles security and safety concerns', TRUE),
  ('Registrar', 'registrar', 'Manages student records and registration', TRUE),
  ('Student Affairs', 'student_affairs', 'Handles student welfare and activities', TRUE),
  ('Other', 'other', 'General concerns not covered by other categories', TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.rate_limit_settings (setting_key, setting_value, description, is_enabled) VALUES
  ('tickets_per_ip_hourly', 5, 'Maximum tickets allowed per IP address per hour', TRUE),
  ('tickets_per_ip_daily', 10, 'Maximum tickets allowed per IP address per day', TRUE),
  ('tickets_per_ip_weekly', 30, 'Maximum tickets allowed per IP address per week', TRUE),
  ('tickets_per_ip_monthly', 50, 'Maximum tickets allowed per IP address per month', TRUE),
  ('tickets_per_ip_yearly', 200, 'Maximum tickets allowed per IP address per year', TRUE),
  ('global_rate_limiting', 1, 'Enable or disable global rate limiting', TRUE),
  ('cooldown_minutes', 30, 'Cooldown after reaching a rate limit', TRUE)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.system_settings (id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_complaints_reference ON public.complaints(reference_number);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_department ON public.complaints(assigned_department);
CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON public.complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_created ON public.complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_complaint ON public.audit_trail(complaint_id);
CREATE INDEX IF NOT EXISTS idx_comments_complaint ON public.complaint_comments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_complaint ON public.ticket_comments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created ON public.ticket_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_internal ON public.ticket_comments(is_internal);
CREATE INDEX IF NOT EXISTS idx_students_email ON public.students(email);
CREATE INDEX IF NOT EXISTS idx_departments_code ON public.departments(code);
CREATE INDEX IF NOT EXISTS idx_departments_active ON public.departments(is_active);
CREATE INDEX IF NOT EXISTS idx_login_sessions_user ON public.login_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_ip ON public.login_sessions(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_sessions_logged_in ON public.login_sessions(logged_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaint_submissions_ip_date ON public.complaint_submissions(ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_complaint_submissions_complaint ON public.complaint_submissions(complaint_id);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON public.blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires ON public.blocked_ips(expires_at);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_actor ON public.system_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_created ON public.system_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_action ON public.system_audit_log(action);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_ip_rate_limit(check_ip VARCHAR(45), period VARCHAR(20))
RETURNS TABLE(is_limited BOOLEAN, current_count INTEGER, limit_value INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  period_start TIMESTAMPTZ;
  configured_limit INTEGER;
  submission_count INTEGER;
BEGIN
  CASE period
    WHEN 'hourly' THEN period_start := NOW() - INTERVAL '1 hour';
    WHEN 'daily' THEN period_start := NOW() - INTERVAL '1 day';
    WHEN 'weekly' THEN period_start := NOW() - INTERVAL '1 week';
    WHEN 'monthly' THEN period_start := NOW() - INTERVAL '1 month';
    WHEN 'yearly' THEN period_start := NOW() - INTERVAL '1 year';
    ELSE period_start := NOW() - INTERVAL '1 day';
  END CASE;
  SELECT setting_value INTO configured_limit FROM public.rate_limit_settings
    WHERE setting_key = 'tickets_per_ip_' || period AND is_enabled = TRUE;
  configured_limit := COALESCE(configured_limit, 999999);
  SELECT COUNT(*)::INTEGER INTO submission_count FROM public.complaint_submissions
    WHERE ip_address = check_ip AND created_at >= period_start;
  RETURN QUERY SELECT submission_count >= configured_limit, submission_count, configured_limit;
END;
$$;

DROP TRIGGER IF EXISTS update_departments_updated_at ON public.departments;
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_students_updated_at ON public.students;
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_ticket_comments_updated_at ON public.ticket_comments;
CREATE TRIGGER update_ticket_comments_updated_at BEFORE UPDATE ON public.ticket_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_rate_limit_settings_updated_at ON public.rate_limit_settings;
CREATE TRIGGER update_rate_limit_settings_updated_at BEFORE UPDATE ON public.rate_limit_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can read own profile" ON public.students;
CREATE POLICY "Students can read own profile" ON public.students FOR SELECT USING (auth.email() = email);
DROP POLICY IF EXISTS "Students can update own profile" ON public.students;
CREATE POLICY "Students can update own profile" ON public.students FOR UPDATE USING (auth.email() = email);
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.students;
CREATE POLICY "Allow insert for authenticated users" ON public.students FOR INSERT WITH CHECK (auth.email() = email);

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read non-internal comments" ON public.ticket_comments;
CREATE POLICY "Public can read non-internal comments" ON public.ticket_comments FOR SELECT USING (is_internal = FALSE);
DROP POLICY IF EXISTS "Authenticated users can read all comments" ON public.ticket_comments;
CREATE POLICY "Authenticated users can read all comments" ON public.ticket_comments FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Anyone can insert comments" ON public.ticket_comments;
CREATE POLICY "Anyone can insert comments" ON public.ticket_comments FOR INSERT WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Users can update own comments" ON public.ticket_comments;
CREATE POLICY "Users can update own comments" ON public.ticket_comments FOR UPDATE TO authenticated USING (author_id = auth.uid());

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read active departments" ON public.departments;
CREATE POLICY "Public can read active departments" ON public.departments FOR SELECT USING (is_active = TRUE);
DROP POLICY IF EXISTS "Authenticated users can manage departments" ON public.departments;
CREATE POLICY "Authenticated users can manage departments" ON public.departments FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

ALTER TABLE public.login_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage login sessions" ON public.login_sessions;
CREATE POLICY "Authenticated users can manage login sessions" ON public.login_sessions FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Public can insert complaint submissions" ON public.complaint_submissions;
CREATE POLICY "Public can insert complaint submissions" ON public.complaint_submissions FOR INSERT WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Authenticated users can manage complaint submissions" ON public.complaint_submissions;
CREATE POLICY "Authenticated users can manage complaint submissions" ON public.complaint_submissions FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Authenticated users can manage rate limits" ON public.rate_limit_settings;
CREATE POLICY "Authenticated users can manage rate limits" ON public.rate_limit_settings FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Authenticated users can manage blocked IPs" ON public.blocked_ips;
CREATE POLICY "Authenticated users can manage blocked IPs" ON public.blocked_ips FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Authenticated users can manage audit logs" ON public.system_audit_log;
CREATE POLICY "Authenticated users can manage audit logs" ON public.system_audit_log FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Enable read access for all users" ON public.system_settings;
CREATE POLICY "Enable read access for all users" ON public.system_settings FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Enable update for super_admins" ON public.system_settings;
CREATE POLICY "Enable update for super_admins" ON public.system_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'super_admin')
);
