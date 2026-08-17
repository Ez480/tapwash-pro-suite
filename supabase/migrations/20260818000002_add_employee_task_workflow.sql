create table if not exists public.employee_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  wash_type text not null default 'car_wash',
  employee_id uuid not null references public.profiles(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  offer_id uuid references public.offers(id) on delete set null,
  customer_name text not null default '',
  customer_phone text,
  customer_email text,
  package_name text,
  offer_name text,
  total_washes integer,
  used_washes integer,
  remaining_washes integer,
  location_text text not null default '',
  latitude numeric,
  longitude numeric,
  notes text,
  scheduled_at timestamptz,
  status text not null default 'pending' check (status in ('pending','accepted','in_progress','completed','cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists employee_tasks_employee_status_idx on public.employee_tasks(employee_id,status);
create index if not exists employee_tasks_scheduled_idx on public.employee_tasks(scheduled_at);
create index if not exists employee_tasks_customer_idx on public.employee_tasks(customer_id);

alter table public.employee_tasks enable row level security;

drop policy if exists employee_tasks_admin_all on public.employee_tasks;
drop policy if exists employee_tasks_employee_select on public.employee_tasks;
drop policy if exists employee_tasks_employee_update on public.employee_tasks;

create policy employee_tasks_admin_all on public.employee_tasks
for all using (has_role(auth.uid(),'admin'::app_role))
with check (has_role(auth.uid(),'admin'::app_role));

create policy employee_tasks_employee_select on public.employee_tasks
for select using (employee_id = auth.uid() and has_role(auth.uid(),'employee'::app_role));

create policy employee_tasks_employee_update on public.employee_tasks
for update using (employee_id = auth.uid() and has_role(auth.uid(),'employee'::app_role))
with check (employee_id = auth.uid() and has_role(auth.uid(),'employee'::app_role));

create or replace function public.touch_employee_task_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists employee_tasks_updated_at on public.employee_tasks;
create trigger employee_tasks_updated_at before update on public.employee_tasks for each row execute function public.touch_employee_task_updated_at();
