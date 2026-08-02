GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
DROP POLICY "packages public read" ON public.packages;
CREATE POLICY "packages public read" ON public.packages FOR SELECT USING (status = 'active');
DROP POLICY "offers public read" ON public.offers;
CREATE POLICY "offers public read" ON public.offers FOR SELECT USING (status = 'active');
CREATE POLICY "packages admin read" ON public.packages FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "offers admin read" ON public.offers FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));