-- Employees may read their own profile, but only admins can change it.
-- Non-employee users retain self-service profile updates.
-- This replaces legacy permissive UPDATE policies so they cannot OR-bypass the rule.

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin_or_non_employee_own" ON public.profiles;

CREATE POLICY "profiles_update_admin_or_non_employee_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.has_role((select auth.uid()), 'admin'::app_role)
  OR (
    (select auth.uid()) = id
    AND NOT public.has_role((select auth.uid()), 'employee'::app_role)
  )
)
WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role)
  OR (
    (select auth.uid()) = id
    AND NOT public.has_role((select auth.uid()), 'employee'::app_role)
  )
);
