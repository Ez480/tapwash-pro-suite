-- New table only. No change to existing tables.
create table if not exists public.employee_shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  started_by uuid references public.profiles(id) on delete set null,
  ended_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists employee_shifts_employee_started_idx
  on public.employee_shifts(employee_id, started_at desc);
create unique index if not exists employee_shifts_one_open_per_employee
  on public.employee_shifts(employee_id) where ended_at is null;

alter table public.employee_shifts enable row level security;
grant select, insert, update on public.employee_shifts to authenticated;

drop policy if exists employee_shifts_admin_all on public.employee_shifts;
create policy employee_shifts_admin_all on public.employee_shifts
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'::app_role))
  with check (public.has_role((select auth.uid()), 'admin'::app_role));

drop policy if exists employee_shifts_employee_select on public.employee_shifts;
create policy employee_shifts_employee_select on public.employee_shifts
  for select to authenticated
  using (employee_id = (select auth.uid()) and public.has_role((select auth.uid()), 'employee'::app_role));

drop policy if exists employee_shifts_employee_insert on public.employee_shifts;
create policy employee_shifts_employee_insert on public.employee_shifts
  for insert to authenticated
  with check (
    employee_id = (select auth.uid())
    and started_by = (select auth.uid())
    and ended_at is null
    and public.has_role((select auth.uid()), 'employee'::app_role)
  );

drop policy if exists employee_shifts_employee_end on public.employee_shifts;
create policy employee_shifts_employee_end on public.employee_shifts
  for update to authenticated
  using (employee_id = (select auth.uid()) and ended_at is null and public.has_role((select auth.uid()), 'employee'::app_role))
  with check (employee_id = (select auth.uid()) and public.has_role((select auth.uid()), 'employee'::app_role));

do $$ begin
  alter publication supabase_realtime add table public.employee_shifts;
exception when duplicate_object then null; when undefined_object then null; end $$;
