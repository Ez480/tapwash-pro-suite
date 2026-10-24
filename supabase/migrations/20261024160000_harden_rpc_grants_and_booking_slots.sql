-- Least-privilege RPC grants for trigger-only SECURITY DEFINER functions.
-- Triggers continue to run; clients do not need direct EXECUTE on trigger functions.
revoke execute on function public.capture_first_customer_location() from public, anon, authenticated;
revoke execute on function public.capture_first_subscription_customer_location() from public, anon, authenticated;
revoke execute on function public.copy_subscription_service_location() from public, anon, authenticated;
revoke execute on function public.create_payment_for_subscription_request() from public, anon, authenticated;
revoke execute on function public.create_pending_subscription_for_request() from public, anon, authenticated;
revoke execute on function public.create_subscription_payment_request() from public, anon, authenticated;
revoke execute on function public.notify_admins_on_booking_request() from public, anon, authenticated;
revoke execute on function public.notify_admins_on_payment_change() from public, anon, authenticated;
revoke execute on function public.notify_admins_on_payment_request() from public, anon, authenticated;
revoke execute on function public.notify_admins_on_payment_status_change() from public, anon, authenticated;
revoke execute on function public.notify_admins_on_subscription_request() from public, anon, authenticated;
revoke execute on function public.notify_booking_payment_status() from public, anon, authenticated;
revoke execute on function public.notify_booking_rejection() from public, anon, authenticated;
revoke execute on function public.notify_manual_booking_payment() from public, anon, authenticated;
revoke execute on function public.notify_order_lifecycle() from public, anon, authenticated;
revoke execute on function public.populate_subscription_service_location() from public, anon, authenticated;
revoke execute on function public.remove_employee_identity() from public, anon, authenticated;
revoke execute on function public.resolve_employee_task_customer_id() from public, anon, authenticated;
revoke execute on function public.sync_booking_status_from_employee_task() from public, anon, authenticated;
revoke execute on function public.sync_employee_identity() from public, anon, authenticated;
revoke execute on function public.sync_employee_to_profile() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.touch_employee_location_updated_at() from public, anon, authenticated;
revoke execute on function public.touch_employee_task_updated_at() from public, anon, authenticated;
revoke execute on function public.touch_subscription_request_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.link_employee_user() from public, anon, authenticated;

-- A second layer of protection for this admin-only RPC; its body independently
-- checks auth.uid() and the admin role.
alter function public.admin_confirm_payment(uuid) set search_path to '';
revoke execute on function public.admin_confirm_payment(uuid) from public, anon;
grant execute on function public.admin_confirm_payment(uuid) to authenticated, service_role;

-- This RPC is intentionally callable without a session because public booking
-- pages use it to show busy times only. Harden its SECURITY DEFINER search path.
create or replace function public.get_booked_booking_slots(
  p_start timestamp with time zone,
  p_end timestamp with time zone
)
returns table(scheduled_at timestamp with time zone)
language sql
security definer
set search_path to ''
as $function$
  select br.scheduled_at
  from public.booking_requests br
  where br.scheduled_at >= p_start
    and br.scheduled_at <= p_end
    and br.status::text not in ('cancelled', 'rejected', 'completed', 'closed')
  order by br.scheduled_at;
$function$;

revoke execute on function public.get_booked_booking_slots(timestamp with time zone, timestamp with time zone) from public;
grant execute on function public.get_booked_booking_slots(timestamp with time zone, timestamp with time zone) to anon, authenticated, service_role;

-- Serialize competing booking attempts for the same exact appointment instant.
-- This closes the check-then-insert race even for client-side direct inserts.
create or replace function public.prevent_duplicate_booking_slot()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.scheduled_at is null
     or new.status::text in ('cancelled', 'rejected', 'completed', 'closed') then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(extract(epoch from new.scheduled_at)::text, 574731)
  );

  if exists (
    select 1
    from public.booking_requests br
    where br.scheduled_at = new.scheduled_at
      and br.status::text not in ('cancelled', 'rejected', 'completed', 'closed')
      and (tg_op = 'INSERT' or br.id <> new.id)
  ) then
    raise exception 'This appointment time is already booked.'
      using errcode = '23505';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_prevent_duplicate_booking_slot on public.booking_requests;
create trigger trg_prevent_duplicate_booking_slot
before insert or update of scheduled_at, status
on public.booking_requests
for each row execute function public.prevent_duplicate_booking_slot();

revoke execute on function public.prevent_duplicate_booking_slot() from public, anon, authenticated;

notify pgrst, 'reload schema';
