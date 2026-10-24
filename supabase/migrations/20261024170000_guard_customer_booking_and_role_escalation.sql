-- Prevent clients from self-approving bookings or altering staff location ownership.
-- Admin/service-role operations retain their existing workflows.

create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  if new.role is distinct from old.role
     and not public.has_role(auth.uid(), 'admin'::public.app_role)
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only an admin can change a profile role';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_profile_role_change on public.profiles;
create trigger trg_guard_profile_role_change
before update of role on public.profiles
for each row execute function public.guard_profile_role_change();

revoke execute on function public.guard_profile_role_change() from public, anon, authenticated;

create or replace function public.guard_employee_location_update()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_package_price numeric;
  v_offer_price numeric;
begin
  if public.has_role(v_user, 'admin'::public.app_role)
     or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if v_user is null
     or not public.has_role(v_user, 'employee'::public.app_role)
     or old.employee_id <> v_user then
    raise exception 'Only the assigned employee or an admin can update this location';
  end if;

  if new.employee_id is distinct from old.employee_id
     or new.task_id is distinct from old.task_id then
    raise exception 'Employees cannot reassign a location to another employee or task';
  end if;

  if not exists (
    select 1
    from public.employee_tasks t
    where t.id = new.task_id
      and t.employee_id = v_user
  ) then
    raise exception 'Location updates must belong to the employee assigned to the task';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_employee_location_update on public.employee_locations;
create trigger trg_guard_employee_location_update
before update on public.employee_locations
for each row execute function public.guard_employee_location_update();

revoke execute on function public.guard_employee_location_update() from public, anon, authenticated;

-- Customers can submit booking requests, but cannot mark them paid, accepted,
-- checked in, or already deducted by crafting a direct PostgREST insert.
create or replace function public.guard_customer_booking_insert()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if public.has_role(v_user, 'admin'::public.app_role)
     or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if v_user is not null and new.customer_id is distinct from v_user then
    raise exception 'Customers may only create bookings for their own account';
  end if;

  if v_user is not null then
    if new.package_id is not null and new.offer_id is not null then
      raise exception 'A booking must reference either a package or an offer, not both';
    elsif new.package_id is not null then
      select p.price into v_package_price
      from public.packages p
      where p.id = new.package_id
        and p.status::text = 'active'
      for share;
      if not found then raise exception 'This package is not available'; end if;
      new.amount := v_package_price;
    elsif new.offer_id is not null then
      select coalesce(o.new_price, o.old_price, 0) into v_offer_price
      from public.offers o
      where o.id = new.offer_id
        and o.status::text = 'active'
        and o.start_date <= now()
        and (o.end_date is null or o.end_date >= now())
      for share;
      if not found then raise exception 'This offer is not available'; end if;
      new.amount := v_offer_price;
    else
      raise exception 'Select an active package or offer';
    end if;

    if new.car_id is not null and not exists (
      select 1 from public.cars c
      where c.id = new.car_id and c.customer_id = v_user
    ) then
      raise exception 'The selected vehicle does not belong to this customer';
    end if;
  end if;

  if new.scheduled_at is null or new.scheduled_at <= now() then
    raise exception 'Please choose a future appointment';
  end if;

  if lower(coalesce(new.payment_method, 'cash')) not in ('cash', 'smart_wallet', 'instapay', 'bank_transfer') then
    raise exception 'Invalid payment method';
  end if;

  new.status := 'pending';
  new.payment_status := case
    when lower(coalesce(new.payment_method, 'cash')) = 'cash' then 'unpaid'
    else 'awaiting_proof'
  end;
  new.wash_deducted := false;
  new.checked_in_at := null;
  new.checked_in_by := null;

  if v_user is null then
    new.scan_method := 'customer_nfc_link';
  else
    new.scan_method := null;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_customer_booking_insert on public.booking_requests;
create trigger trg_guard_customer_booking_insert
before insert on public.booking_requests
for each row execute function public.guard_customer_booking_insert();

revoke execute on function public.guard_customer_booking_insert() from public, anon, authenticated;

notify pgrst, 'reload schema';
