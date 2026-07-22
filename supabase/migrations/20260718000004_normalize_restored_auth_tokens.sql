-- Repairs legacy Auth rows restored before GoTrue token fields were normalized.
-- GoTrue scans these token fields as strings; NULL values make OAuth sign-in fail.
-- This is idempotent: only NULL values are changed, and no active token is overwritten.

UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change IS NULL;

-- Verification: this must return zero rows after the update.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE confirmation_token IS NULL
       OR recovery_token IS NULL
       OR email_change_token_new IS NULL
       OR email_change IS NULL
  ) THEN
    RAISE EXCEPTION 'Auth token normalization did not complete.';
  END IF;
END;
$$;
