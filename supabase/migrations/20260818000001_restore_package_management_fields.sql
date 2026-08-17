-- Restore the package-management columns expected by the admin CRUD and public package views.
-- The production database was missing these columns even though the application schema/types use them.
alter table public.packages add column if not exists features_en text[] not null default '{}';
alter table public.packages add column if not exists features_ar text[] not null default '{}';
alter table public.packages add column if not exists price numeric(10,2) not null default 0;
alter table public.packages add column if not exists duration_days integer not null default 30;
alter table public.packages add column if not exists washes_count integer not null default 4;
alter table public.packages add column if not exists sort_order integer not null default 0;
alter table public.packages add column if not exists status public.entity_status not null default 'active';

drop trigger if exists set_packages_updated_at on public.packages;
create trigger set_packages_updated_at
before update on public.packages
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
