ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employees self read" ON public.employees;
CREATE POLICY "employees self read" ON public.employees
  FOR SELECT TO authenticated
  USING (lower(coalesce(email, '')) = lower(coalesce((select auth.jwt()->>'email'), '')) OR public.has_role((select auth.uid()), 'admin'::app_role));
