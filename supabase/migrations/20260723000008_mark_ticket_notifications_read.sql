-- Mark notifications for an opened ticket as read within the caller's authorized scope.
-- This avoids treating an RLS-filtered zero-row update as a successful read.

BEGIN;

CREATE OR REPLACE FUNCTION public.mark_my_ticket_notifications_read(ticket_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role TEXT := public.get_auth_user_role();
  actor_department TEXT := public.get_auth_user_department();
  changed_count INTEGER;
BEGIN
  UPDATE public.system_notifications
  SET is_read = TRUE
  WHERE reference_id = ticket_id
    AND is_read = FALSE
    AND (
      user_id = auth.uid()
      OR actor_role IN ('admin', 'super_admin')
      OR (
        role_target = 'department'
        AND actor_role IN ('department', 'faculty', 'employee')
        AND (department_target IS NULL OR department_target = actor_department)
      )
    );

  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RETURN changed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_my_ticket_notifications_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_my_ticket_notifications_read(UUID) TO authenticated;

COMMIT;
