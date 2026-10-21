-- Repair legacy permissive RLS policies that were not removed by the
-- earlier reconciliation migration. This migration is additive and does not
-- modify or delete business data.

-- Notifications: customer_id IS NULL represents admin-only notifications.
-- The legacy "notifications own read" policy exposed these rows to every
-- authenticated user. Remove all legacy/renamed policies before recreating
-- the intended audience rules.
drop policy if exists "notifications own read" on public.notifications;
drop policy if exists "notifications own update" on public.notifications;
drop policy if exists "notifications admin write" on public.notifications;
drop policy if exists "notifications_select_own_or_admin" on public.notifications;
drop policy if exists "notifications_update_own_or_admin" on public.notifications;

create policy "notifications_select_own_or_admin"
  on public.notifications
  for select
  to authenticated
  using (
    customer_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );

create policy "notifications_update_own_or_admin"
  on public.notifications
  for update
  to authenticated
  using (
    customer_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  )
  with check (
    customer_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );

create policy "notifications_admin_write"
  on public.notifications
  for all
  to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

-- Public catalog: only active packages/offers should be visible publicly.
-- Legacy permissive policies are dropped because PostgreSQL combines
-- permissive policies with OR; adding a stricter policy alone is insufficient.
drop policy if exists "packages public read" on public.packages;
drop policy if exists "packages admin write" on public.packages;
drop policy if exists "packages admin read" on public.packages;
drop policy if exists "packages_public_read" on public.packages;
drop policy if exists "packages_admin_write" on public.packages;

create policy "packages_public_read"
  on public.packages
  for select
  to anon, authenticated
  using (status = 'active');

create policy "packages_admin_read"
  on public.packages
  for select
  to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy "packages_admin_write"
  on public.packages
  for all
  to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy if exists "offers public read" on public.offers;
drop policy if exists "offers admin write" on public.offers;
drop policy if exists "offers admin read" on public.offers;
drop policy if exists "offers_public_read" on public.offers;
drop policy if exists "offers_admin_write" on public.offers;

create policy "offers_public_read"
  on public.offers
  for select
  to anon, authenticated
  using (status = 'active');

create policy "offers_admin_read"
  on public.offers
  for select
  to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy "offers_admin_write"
  on public.offers
  for all
  to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

-- Public pages: draft/inactive content is admin-only.
drop policy if exists "pages public read" on public.site_pages;
drop policy if exists "pages admin write" on public.site_pages;
drop policy if exists "site_pages_public_read" on public.site_pages;
drop policy if exists "site_pages_admin_write" on public.site_pages;

create policy "site_pages_public_read"
  on public.site_pages
  for select
  to anon, authenticated
  using (status = 'active');

create policy "site_pages_admin_write"
  on public.site_pages
  for all
  to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

notify pgrst, 'reload schema';
