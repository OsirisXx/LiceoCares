-- Grants the existing LDCU EdTech Google account administrator access.
-- This must run only in the intended target Supabase project.
-- It never creates an Auth account or changes a password, identity, or token.

BEGIN;

DO $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT id
  INTO target_user_id
  FROM auth.users
  WHERE lower(email) = 'ldcu_edtech@liceo.edu.ph';

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Cannot grant administrator access: no Auth user exists for ldcu_edtech@liceo.edu.ph.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.users AS profile
    WHERE lower(profile.email) = 'ldcu_edtech@liceo.edu.ph'
      AND profile.id <> target_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot grant administrator access: email is mapped to a different public.users ID.';
  END IF;

  INSERT INTO public.users (id, email, full_name, role, is_active)
  SELECT
    auth_user.id,
    lower(auth_user.email),
    COALESCE(
      auth_user.raw_user_meta_data ->> 'full_name',
      auth_user.raw_user_meta_data ->> 'name',
      'LDCU Educational Technology Center'
    ),
    'admin',
    TRUE
  FROM auth.users AS auth_user
  WHERE auth_user.id = target_user_id
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.users.full_name, EXCLUDED.full_name),
    role = 'admin',
    is_active = TRUE,
    updated_at = NOW();
END;
$$;

COMMIT;
