-- Enable only after all historical CSV data has been imported.
-- Running this before import would create duplicate notifications for legacy rows.

CREATE OR REPLACE FUNCTION public.notify_new_complaint()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.system_notifications (role_target, title, message, type, reference_id)
  VALUES (
    'admin',
    'New Ticket Submitted',
    'Ticket ' || NEW.reference_number || ' has been submitted in ' || NEW.category || '.',
    'new_ticket',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_complaint_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status <> 'submitted' THEN
    INSERT INTO public.system_notifications (user_id, title, message, type, reference_id)
    VALUES (
      NEW.user_id,
      'Ticket ' || REPLACE(UPPER(SUBSTRING(NEW.status FROM 1 FOR 1)) || SUBSTRING(NEW.status FROM 2), '_', ' '),
      'Your ticket ' || NEW.reference_number || ' is now ' || REPLACE(NEW.status, '_', ' ') || '.',
      'ticket_update',
      NEW.id
    );
  END IF;

  IF OLD.assigned_department IS DISTINCT FROM NEW.assigned_department AND NEW.assigned_department IS NOT NULL THEN
    INSERT INTO public.system_notifications (role_target, department_target, title, message, type, reference_id)
    VALUES (
      'department',
      NEW.assigned_department,
      'New Ticket Assigned',
      'Ticket ' || NEW.reference_number || ' has been assigned to your department.',
      'new_ticket',
      NEW.id
    );
  END IF;

  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.system_notifications (user_id, title, message, type, reference_id)
    VALUES (
      NEW.assigned_to,
      'Ticket Assigned to You',
      'Ticket ' || NEW.reference_number || ' has been assigned directly to you.',
      'new_ticket',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  complaint_record public.complaints%ROWTYPE;
BEGIN
  SELECT * INTO complaint_record FROM public.complaints WHERE id = NEW.complaint_id;

  IF NEW.is_internal THEN
    INSERT INTO public.system_notifications (role_target, title, message, type, reference_id)
    VALUES ('admin', 'New Internal Note', 'New internal note on ticket ' || complaint_record.reference_number, 'new_comment', NEW.complaint_id);

    IF complaint_record.assigned_department IS NOT NULL THEN
      INSERT INTO public.system_notifications (role_target, department_target, title, message, type, reference_id)
      VALUES ('department', complaint_record.assigned_department, 'New Internal Note', 'New internal note on ticket ' || complaint_record.reference_number, 'new_comment', NEW.complaint_id);
    END IF;
  ELSIF auth.uid() = complaint_record.user_id THEN
    INSERT INTO public.system_notifications (role_target, title, message, type, reference_id)
    VALUES ('admin', 'New Reply on Ticket', 'Student replied to ticket ' || complaint_record.reference_number, 'new_comment', NEW.complaint_id);

    IF complaint_record.assigned_department IS NOT NULL THEN
      INSERT INTO public.system_notifications (role_target, department_target, title, message, type, reference_id)
      VALUES ('department', complaint_record.assigned_department, 'New Reply on Ticket', 'Student replied to ticket ' || complaint_record.reference_number, 'new_comment', NEW.complaint_id);
    END IF;
  ELSE
    INSERT INTO public.system_notifications (user_id, title, message, type, reference_id)
    VALUES (complaint_record.user_id, 'New Reply on Ticket', 'Staff replied to your ticket ' || complaint_record.reference_number, 'new_comment', NEW.complaint_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_complaint ON public.complaints;
CREATE TRIGGER on_new_complaint
AFTER INSERT ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.notify_new_complaint();

DROP TRIGGER IF EXISTS on_complaint_update ON public.complaints;
CREATE TRIGGER on_complaint_update
AFTER UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.notify_complaint_update();

DROP TRIGGER IF EXISTS on_new_comment ON public.ticket_comments;
CREATE TRIGGER on_new_comment
AFTER INSERT ON public.ticket_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_new_comment();
