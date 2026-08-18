create extension if not exists pg_cron;

alter table public.employee_tasks
  add column if not exists reminder_sent_at timestamptz;

create index if not exists employee_tasks_reminder_due_idx
  on public.employee_tasks (scheduled_at, reminder_sent_at)
  where scheduled_at is not null and reminder_sent_at is null;

create table if not exists public.employee_locations (
  task_id uuid primary key references public.employee_tasks(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  heading double precision,
  speed double precision,
  updated_at timestamptz not null default now()
);

create index if not exists employee_locations_employee_updated_idx
  on public.employee_locations(employee_id, updated_at desc);

alter table public.employee_locations enable row level security;

drop policy if exists employee_locations_admin_select on public.employee_locations;
drop policy if exists employee_locations_employee_select on public.employee_locations;
drop policy if exists employee_locations_employee_insert on public.employee_locations;
drop policy if exists employee_locations_employee_update on public.employee_locations;

create policy employee_locations_admin_select on public.employee_locations
  for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'::app_role));

create policy employee_locations_employee_select on public.employee_locations
  for select to authenticated
  using (employee_id = (select auth.uid()) and public.has_role((select auth.uid()), 'employee'::app_role));

create policy employee_locations_employee_insert on public.employee_locations
  for insert to authenticated
  with check (
    employee_id = (select auth.uid())
    and public.has_role((select auth.uid()), 'employee'::app_role)
    and exists (
      select 1 from public.employee_tasks t
      where t.id = employee_locations.task_id and t.employee_id = (select auth.uid())
    )
  );

create policy employee_locations_employee_update on public.employee_locations
  for update to authenticated
  using (employee_id = (select auth.uid()) and public.has_role((select auth.uid()), 'employee'::app_role))
  with check (employee_id = (select auth.uid()) and public.has_role((select auth.uid()), 'employee'::app_role));

create or replace function public.touch_employee_location_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employee_locations_updated_at on public.employee_locations;
create trigger employee_locations_updated_at
before update on public.employee_locations
for each row execute function public.touch_employee_location_updated_at();

create or replace function public.notify_due_order_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with due as (
    select id, title, serial_number, customer_name, customer_phone, scheduled_at
    from public.employee_tasks
    where scheduled_at is not null
      and reminder_sent_at is null
      and status in ('pending','accepted','in_progress')
      and scheduled_at between now() + interval '29 minutes' and now() + interval '31 minutes'
    for update skip locked
  ), marked as (
    update public.employee_tasks t
    set reminder_sent_at = now()
    from due
    where t.id = due.id
    returning due.*
  )
  insert into public.notifications (customer_id, title, message, is_read)
  select
    null,
    'تذكير بموعد أوردر',
    'الأوردر ' || coalesce(serial_number, id::text) || ' موعده بعد نصف ساعة.' || E'\n'
      || 'العميل: ' || coalesce(customer_name, 'غير معروف') || E'\n'
      || 'الهاتف: ' || coalesce(customer_phone, 'غير مسجل') || E'\n'
      || 'الموعد: ' || to_char(scheduled_at, 'YYYY-MM-DD HH24:MI'),
    false
  from marked;
end;
$$;

revoke all on function public.notify_due_order_reminders() from public;
revoke all on function public.notify_due_order_reminders() from anon;
revoke all on function public.notify_due_order_reminders() from authenticated;
grant execute on function public.notify_due_order_reminders() to postgres;

select cron.unschedule(jobid)
from cron.job
where jobname = 'tapwash-order-reminders-every-minute';

select cron.schedule(
  'tapwash-order-reminders-every-minute',
  '* * * * *',
  $$select public.notify_due_order_reminders();$$
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'employee_locations'
  ) then
    alter publication supabase_realtime add table public.employee_locations;
  end if;
end $$;

notify pgrst, 'reload schema';
