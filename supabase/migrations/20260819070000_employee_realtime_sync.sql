-- Employee dashboard realtime synchronization.
-- Manager edits the employees row; the employee dashboard receives the UPDATE
-- through Supabase Realtime and refetches the same source-of-truth row.

alter table public.employees replica identity full;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'employees'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
  END IF;
END
$$;

DROP POLICY IF EXISTS "employees self read" ON public.employees;
CREATE POLICY "employees self read"
ON public.employees
FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  OR lower(coalesce(email, '')) = lower(coalesce((select auth.jwt()->>'email'), ''))
  OR public.has_role((select auth.uid()), 'admin'::app_role)
);

-- Make sure existing employee rows are linked to the current Auth account
-- when the email matches. This is safe for already-linked rows.
UPDATE public.employees e
SET user_id = u.id,
    updated_at = now()
FROM auth.users u
WHERE lower(coalesce(e.email, '')) = lower(coalesce(u.email, ''))
  AND e.email IS NOT NULL
  AND e.user_id IS DISTINCT FROM u.id;
