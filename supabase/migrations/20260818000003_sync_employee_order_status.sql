alter table public.employee_tasks
  add column if not exists booking_request_id uuid references public.booking_requests(id) on delete set null;

create index if not exists employee_tasks_booking_request_idx
  on public.employee_tasks(booking_request_id);

create or replace function public.sync_booking_request_from_employee_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_status text;
begin
  target_status := case NEW.status
    when 'accepted' then 'picked_up'
    when 'in_progress' then 'in_progress'
    when 'completed' then 'completed'
    when 'cancelled' then 'cancelled'
    else null
  end;
  if target_status is null then return NEW; end if;

  if NEW.booking_request_id is not null then
    update public.booking_requests
       set status = target_status, updated_at = now()
     where id = NEW.booking_request_id;
  else
    update public.booking_requests
       set status = target_status, updated_at = now()
     where customer_email is not null
       and lower(customer_email) = lower(NEW.customer_email)
       and scheduled_at is not distinct from NEW.scheduled_at
       and status <> target_status;
  end if;
  return NEW;
end;
$$;

drop trigger if exists employee_tasks_sync_booking_request on public.employee_tasks;
create trigger employee_tasks_sync_booking_request
after update of status on public.employee_tasks
for each row
when (old.status is distinct from new.status)
execute function public.sync_booking_request_from_employee_task();

update public.employee_tasks et
set booking_request_id = br.id
from public.booking_requests br
where et.booking_request_id is null
  and et.customer_email is not null
  and lower(et.customer_email) = lower(br.customer_email)
  and et.scheduled_at is not distinct from br.scheduled_at;

update public.booking_requests br
set status = case et.status
  when 'accepted' then 'picked_up'
  when 'in_progress' then 'in_progress'
  when 'completed' then 'completed'
  when 'cancelled' then 'cancelled'
  else br.status
end,
updated_at = now()
from public.employee_tasks et
where et.booking_request_id = br.id
  and et.status in ('accepted','in_progress','completed','cancelled');
