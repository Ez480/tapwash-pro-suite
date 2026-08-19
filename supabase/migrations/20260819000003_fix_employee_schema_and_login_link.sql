-- Keep the employee table aligned with the admin/employee dashboards.
-- Earlier migrations introduced employee_code/card_number, while the UI uses
-- employee_id/national_id/user_id. Add the missing fields without breaking data.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employee_id TEXT,
  ADD COLUMN IF NOT EXISTS national_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Preserve existing employee codes when present.
UPDATE public.employees
SET employee_id = employee_code
WHERE (employee_id IS NULL OR employee_id = '')
  AND employee_code IS NOT NULL
  AND employee_code <> '';

-- Backfill login linkage for existing employees whose email matches an auth user.
UPDATE public.employees e
SET user_id = u.id
FROM auth.users u
WHERE e.user_id IS NULL
  AND e.email IS NOT NULL
  AND lower(e.email) = lower(u.email);

CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_id_unique
  ON public.employees (employee_id)
  WHERE employee_id IS NOT NULL AND employee_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS employees_national_id_unique
  ON public.employees (national_id)
  WHERE national_id IS NOT NULL AND national_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS employees_user_id_unique
  ON public.employees (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees self read" ON public.employees;
CREATE POLICY "employees self read" ON public.employees
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR lower(coalesce(email, '')) = lower(coalesce((select auth.jwt()->>'email'), ''))
    OR public.has_role((select auth.uid()), 'admin'::app_role)
  );
