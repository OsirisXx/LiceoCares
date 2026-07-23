-- Allow faculty and employee accounts to use department-scoped ticket workflows.
-- Access remains limited to tickets assigned to the account or its department.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_department_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_auth_user_role() IN ('department', 'faculty', 'employee');
$$;

REVOKE ALL ON FUNCTION public.is_department_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_department_staff() TO authenticated;

DROP POLICY IF EXISTS "Users read authorized profiles" ON public.users;
CREATE POLICY "Users read authorized profiles" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.get_auth_user_role() IN ('admin', 'super_admin')
    OR (public.is_department_staff()
        AND department = public.get_auth_user_department())
  );

DROP POLICY IF EXISTS "Users read authorized complaints" ON public.complaints;
CREATE POLICY "Users read authorized complaints" ON public.complaints
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.get_auth_user_role() IN ('admin', 'super_admin')
    OR (public.is_department_staff()
        AND (assigned_to = auth.uid()
             OR assigned_department = public.get_auth_user_department()))
  );

DROP POLICY IF EXISTS "Departments update assigned complaints" ON public.complaints;
CREATE POLICY "Departments update assigned complaints" ON public.complaints
  FOR UPDATE TO authenticated
  USING (
    public.is_department_staff()
    AND (assigned_to = auth.uid()
         OR assigned_department = public.get_auth_user_department())
  )
  WITH CHECK (
    public.is_department_staff()
    AND (assigned_to = auth.uid()
         OR assigned_department = public.get_auth_user_department())
  );

CREATE OR REPLACE FUNCTION public.enforce_complaint_update_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE actor_role TEXT := public.get_auth_user_role();
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF actor_role IN ('admin', 'super_admin') THEN
    RETURN NEW;
  END IF;

  IF public.is_department_staff() THEN
    IF NOT (OLD.assigned_to = auth.uid()
            OR OLD.assigned_department = public.get_auth_user_department()) THEN
      RAISE EXCEPTION 'Ticket is not assigned to this department account';
    END IF;
    IF (to_jsonb(NEW) - ARRAY[
          'status', 'department_remarks', 'resolution_details', 'resolution_image_url',
          'started_by', 'started_at', 'resolved_by', 'resolved_at', 'updated_at'
        ]) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY[
          'status', 'department_remarks', 'resolution_details', 'resolution_image_url',
          'started_by', 'started_at', 'resolved_by', 'resolved_at', 'updated_at'
        ]) THEN
      RAISE EXCEPTION 'Department update contains unauthorized fields';
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND OLD.user_id = auth.uid() THEN
    IF OLD.status <> 'resolved' OR NEW.status NOT IN ('closed', 'disputed') THEN
      RAISE EXCEPTION 'Only resolved tickets can be confirmed or disputed';
    END IF;
    IF (to_jsonb(NEW) - ARRAY[
          'status', 'closed_at', 'user_verified', 'disputed_at', 'dispute_reason', 'updated_at'
        ]) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY[
          'status', 'closed_at', 'user_verified', 'disputed_at', 'dispute_reason', 'updated_at'
        ]) THEN
      RAISE EXCEPTION 'Student update contains unauthorized fields';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Complaint update is not authorized';
END;
$$;

DROP POLICY IF EXISTS "Users append authorized audit trail" ON public.audit_trail;
CREATE POLICY "Users append authorized audit trail" ON public.audit_trail
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.get_auth_user_role() IN ('admin', 'super_admin') OR public.is_department_staff())
    AND performed_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id)
  );

DROP POLICY IF EXISTS "Users read authorized ticket comments" ON public.ticket_comments;
CREATE POLICY "Users read authorized ticket comments" ON public.ticket_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id)
    AND (is_internal = FALSE
         OR public.get_auth_user_role() IN ('admin', 'super_admin')
         OR public.is_department_staff())
  );

DROP POLICY IF EXISTS "Users append authorized ticket comments" ON public.ticket_comments;
CREATE POLICY "Users append authorized ticket comments" ON public.ticket_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id)
    AND (
      public.get_auth_user_role() IN ('admin', 'super_admin')
      OR public.is_department_staff()
      OR (author_type = 'complainant' AND is_internal = FALSE
          AND (author_id IS NULL OR author_id = auth.uid()))
    )
  );

CREATE OR REPLACE FUNCTION public.get_my_notifications()
RETURNS SETOF public.system_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role TEXT;
  v_user_dept TEXT;
BEGIN
  SELECT role::TEXT, department::TEXT
  INTO v_user_role, v_user_dept
  FROM public.users
  WHERE id = auth.uid();

  RETURN QUERY
  SELECT * FROM public.system_notifications
  WHERE is_read = FALSE
    AND (
      user_id = auth.uid()
      OR (role_target = 'admin' AND v_user_role = 'admin')
      OR (role_target = 'super_admin' AND v_user_role = 'super_admin')
      OR (role_target = 'department'
          AND v_user_role IN ('department', 'faculty', 'employee')
          AND (department_target IS NULL OR department_target = v_user_dept))
    )
  ORDER BY created_at DESC
  LIMIT 20;
END;
$$;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.system_notifications;
CREATE POLICY "Users can view their own notifications" ON public.system_notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (role_target = 'admin' AND public.get_auth_user_role() = 'admin')
    OR (role_target = 'super_admin' AND public.get_auth_user_role() = 'super_admin')
    OR (role_target = 'department'
        AND public.is_department_staff()
        AND (department_target IS NULL OR department_target = public.get_auth_user_department()))
  );

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.system_notifications;
CREATE POLICY "Users can update their own notifications" ON public.system_notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (role_target = 'admin' AND public.get_auth_user_role() = 'admin')
    OR (role_target = 'super_admin' AND public.get_auth_user_role() = 'super_admin')
    OR (role_target = 'department'
        AND public.is_department_staff()
        AND (department_target IS NULL OR department_target = public.get_auth_user_department()))
  );

COMMIT;
