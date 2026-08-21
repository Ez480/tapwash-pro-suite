alter table public.profiles add column if not exists address_text text;
alter table public.profiles add column if not exists location_url text;
alter table public.profiles add column if not exists latitude numeric;
alter table public.profiles add column if not exists longitude numeric;

alter table public.employee_tasks add column if not exists package_id uuid references public.packages(id) on delete set null;
create index if not exists employee_tasks_package_idx on public.employee_tasks(package_id);

create or replace function public.expire_due_subscriptions()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  changed_count integer;
begin
  update public.subscriptions
     set status = 'expired', updated_at = now()
   where status = 'active'
     and end_date < current_date;
  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

grant execute on function public.expire_due_subscriptions() to authenticated;
