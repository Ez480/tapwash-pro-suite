-- Prevent bypassing the manager payment gate through direct inserts into employee_tasks.
-- Cash orders do not require an online payment approval; manual online methods do.
create or replace function public.prevent_unapproved_employee_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_payment_method text;
  booking_payment_status text;
begin
  if new.booking_request_id is null then
    return new;
  end if;

  select payment_method, payment_status
    into booking_payment_method, booking_payment_status
  from public.booking_requests
  where id = new.booking_request_id;

  if booking_payment_method in ('smart_wallet', 'instapay', 'bank_transfer')
     and coalesce(booking_payment_status, '') <> 'paid' then
    raise exception 'EMPLOYEE_ASSIGNMENT_BLOCKED_PAYMENT_NOT_APPROVED';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_block_unapproved_employee_assignment on public.employee_tasks;

create trigger trg_block_unapproved_employee_assignment
before insert on public.employee_tasks
for each row
execute function public.prevent_unapproved_employee_assignment();
