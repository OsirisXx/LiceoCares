-- Harden ticket and identity data exposed through the Supabase Data API.
-- Public submission remains available, while tracking is limited to one exact reference via RPC.

BEGIN;

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

REVOKE ALL ON FUNCTION public.get_auth_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_auth_user_department() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_department() TO authenticated;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'complaints', 'audit_trail', 'ticket_comments')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
      policy_record.policyname, policy_record.tablename);
  END LOOP;
END;
$$;

CREATE POLICY "Users read authorized profiles" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.get_auth_user_role() IN ('admin', 'super_admin')
    OR (public.get_auth_user_role() = 'department'
        AND department = public.get_auth_user_department())
  );

CREATE POLICY "Super admins insert profiles" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (public.get_auth_user_role() = 'super_admin');
CREATE POLICY "Super admins update profiles" ON public.users
  FOR UPDATE TO authenticated
  USING (public.get_auth_user_role() = 'super_admin')
  WITH CHECK (public.get_auth_user_role() = 'super_admin');
CREATE POLICY "Super admins delete profiles" ON public.users
  FOR DELETE TO authenticated
  USING (public.get_auth_user_role() = 'super_admin');

CREATE POLICY "Submit new complaints" ON public.complaints
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    reference_number ~ '^LDCU-[A-Z0-9]+-[A-Z0-9]+$'
    AND length(name) BETWEEN 1 AND 200
    AND length(category) BETWEEN 1 AND 100
    AND length(description) BETWEEN 1 AND 10000
    AND (email IS NULL OR length(email) <= 254)
    AND (student_id IS NULL OR length(student_id) <= 100)
    AND (attachment_url IS NULL
         OR (length(attachment_url) <= 5000 AND attachment_url ~ '^https://'))
    AND status = 'submitted'
    AND verified_by IS NULL AND verified_at IS NULL
    AND started_by IS NULL AND started_at IS NULL
    AND resolved_by IS NULL AND resolved_at IS NULL
    AND closed_at IS NULL AND disputed_at IS NULL
    AND dispute_reason IS NULL AND user_verified = FALSE
    AND admin_remarks IS NULL AND department_remarks IS NULL
    AND resolution_details IS NULL AND resolution_image_url IS NULL
    AND additional_email IS NULL
    AND assigned_to IS NULL AND assigned_department IS NULL
    AND created_at BETWEEN NOW() - INTERVAL '1 minute' AND NOW() + INTERVAL '1 minute'
    AND (auth.uid() IS NULL AND user_id IS NULL
         OR auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
  );

CREATE POLICY "Users read authorized complaints" ON public.complaints
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.get_auth_user_role() IN ('admin', 'super_admin')
    OR (public.get_auth_user_role() = 'department'
        AND (assigned_to = auth.uid()
             OR assigned_department = public.get_auth_user_department()))
  );

CREATE POLICY "Administrators update complaints" ON public.complaints
  FOR UPDATE TO authenticated
  USING (public.get_auth_user_role() IN ('admin', 'super_admin'))
  WITH CHECK (public.get_auth_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Departments update assigned complaints" ON public.complaints
  FOR UPDATE TO authenticated
  USING (
    public.get_auth_user_role() = 'department'
    AND (assigned_to = auth.uid()
         OR assigned_department = public.get_auth_user_department())
  )
  WITH CHECK (
    public.get_auth_user_role() = 'department'
    AND (assigned_to = auth.uid()
         OR assigned_department = public.get_auth_user_department())
  );

CREATE POLICY "Students respond to own complaints" ON public.complaints
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

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

  IF actor_role = 'department' THEN
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

DROP TRIGGER IF EXISTS enforce_complaint_update_scope ON public.complaints;
CREATE TRIGGER enforce_complaint_update_scope
BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.enforce_complaint_update_scope();

CREATE POLICY "Users read authorized audit trail" ON public.audit_trail
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.complaints c WHERE c.id = complaint_id
  ));

CREATE POLICY "Staff append authorized audit trail" ON public.audit_trail
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_auth_user_role() IN ('admin', 'super_admin', 'department')
    AND performed_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id)
  );

CREATE POLICY "Students append resolution responses" ON public.audit_trail
  FOR INSERT TO authenticated
  WITH CHECK (
    performed_by IS NULL
    AND action IN ('Resolution Confirmed by User', 'Resolution Disputed by User')
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users read authorized ticket comments" ON public.ticket_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id)
    AND (is_internal = FALSE
         OR public.get_auth_user_role() IN ('admin', 'super_admin', 'department'))
  );

CREATE POLICY "Users append authorized ticket comments" ON public.ticket_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id)
    AND (
      public.get_auth_user_role() IN ('admin', 'super_admin', 'department')
      OR (author_type = 'complainant' AND is_internal = FALSE
          AND (author_id IS NULL OR author_id = auth.uid()))
    )
  );

CREATE OR REPLACE FUNCTION public.record_initial_complaint_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_trail (complaint_id, action, details)
  VALUES (NEW.id, 'Feedback Submitted', 'New feedback submitted');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_initial_complaint_audit ON public.complaints;
CREATE TRIGGER record_initial_complaint_audit
AFTER INSERT ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.record_initial_complaint_audit();

CREATE OR REPLACE FUNCTION public.get_public_ticket(tracking_reference TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  IF tracking_reference IS NULL
     OR tracking_reference !~ '^LDCU-[A-Z0-9]+-[A-Z0-9]+$' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'complaint', jsonb_build_object(
      'id', c.id,
      'reference_number', c.reference_number,
      'name', CASE WHEN c.is_anonymous THEN 'Anonymous' ELSE c.name END,
      'category', c.category,
      'description', c.description,
      'status', c.status,
      'assigned_department', c.assigned_department,
      'attachment_url', c.attachment_url,
      'resolution_details', c.resolution_details,
      'department_remarks', c.department_remarks,
      'admin_remarks', c.admin_remarks,
      'resolved_at', c.resolved_at,
      'dispute_reason', c.dispute_reason,
      'created_at', c.created_at,
      'can_manage', auth.uid() IS NOT NULL AND c.user_id = auth.uid()
    ),
    'auditTrail', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'action', a.action, 'details', a.details,
        'created_at', a.created_at
      ) ORDER BY a.created_at)
      FROM public.audit_trail a WHERE a.complaint_id = c.id
    ), '[]'::JSONB),
    'comments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', tc.id, 'content', tc.content, 'author_name', tc.author_name,
        'author_type', tc.author_type, 'created_at', tc.created_at
      ) ORDER BY tc.created_at)
      FROM public.ticket_comments tc
      WHERE tc.complaint_id = c.id AND tc.is_internal = FALSE
    ), '[]'::JSONB)
  ) INTO result
  FROM public.complaints c
  WHERE c.reference_number = tracking_reference;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_public_ticket_comment(
  tracking_reference TEXT,
  comment_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ticket public.complaints%ROWTYPE;
DECLARE comment_id UUID;
BEGIN
  IF tracking_reference IS NULL
     OR tracking_reference !~ '^LDCU-[A-Z0-9]+-[A-Z0-9]+$'
     OR length(trim(COALESCE(comment_content, ''))) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Invalid comment request';
  END IF;

  SELECT * INTO ticket FROM public.complaints
  WHERE reference_number = tracking_reference;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  INSERT INTO public.ticket_comments (
    complaint_id, content, author_name, author_type, author_id, is_internal
  ) VALUES (
    ticket.id,
    trim(comment_content),
    CASE WHEN ticket.is_anonymous THEN 'Anonymous' ELSE ticket.name END,
    'complainant',
    NULL,
    FALSE
  ) RETURNING id INTO comment_id;

  RETURN comment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_public_ticket_contact(
  tracking_reference TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_student_id TEXT,
  submit_anonymously BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ticket public.complaints%ROWTYPE;
BEGIN
  IF tracking_reference IS NULL
     OR tracking_reference !~ '^LDCU-[A-Z0-9]+-[A-Z0-9]+$'
     OR length(COALESCE(contact_name, '')) > 200
     OR length(COALESCE(contact_email, '')) > 254
     OR length(COALESCE(contact_student_id, '')) > 100 THEN
    RAISE EXCEPTION 'Invalid contact update';
  END IF;

  SELECT * INTO ticket FROM public.complaints
  WHERE reference_number = tracking_reference
    AND status = 'submitted'
    AND created_at >= NOW() - INTERVAL '15 minutes';
  IF NOT FOUND OR (ticket.user_id IS NOT NULL AND ticket.user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'Ticket contact details cannot be updated';
  END IF;

  UPDATE public.complaints SET
    name = CASE WHEN submit_anonymously THEN 'Anonymous'
                ELSE COALESCE(NULLIF(trim(contact_name), ''), 'Anonymous') END,
    email = NULLIF(trim(contact_email), ''),
    student_id = NULLIF(trim(contact_student_id), ''),
    is_anonymous = submit_anonymously OR NULLIF(trim(contact_name), '') IS NULL
  WHERE id = ticket.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_ticket(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_public_ticket_comment(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_public_ticket_contact(TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_ticket(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_public_ticket_comment(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_public_ticket_contact(TEXT, TEXT, TEXT, TEXT, BOOLEAN)
  TO anon, authenticated;

COMMIT;
