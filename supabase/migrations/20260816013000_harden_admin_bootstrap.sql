-- Prevent the first-admin bootstrap from becoming a race condition.
-- Only one row with role='admin' may exist at a time.
create unique index if not exists user_roles_single_admin_idx
  on public.user_roles (role)
  where role = 'admin';
