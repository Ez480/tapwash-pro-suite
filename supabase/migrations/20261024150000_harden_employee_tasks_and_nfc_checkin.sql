-- Additional audit hardening for TapWash. Additive only: no business rows are deleted.
-- Employees may progress assigned tasks, but cannot rewrite customer/order/payment/location data.
create or replace function public.guard_employee_task_update()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  -- Admins retain the existing task-management workflow.
  if public.has_role(v_user, 'admin'::public.app_role) then
    return new;
  end if;

  if v_user is null
     or not public.has_role(v_user, 'employee'::public.app_role)
     or old.employee_id <> v_user then
    raise exception 'Only the assigned employee or an admin can update this task';
  end if;

  -- Status and completion timestamp are the only employee-editable fields.
  if (to_jsonb(new) - array['status', 'completed_at', 'updated_at'])
       is distinct from
     (to_jsonb(old) - array['status', 'completed_at', 'updated_at']) then
    raise exception 'Employees cannot edit task/customer/order details';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status = 'accepted')
      or (old.status = 'accepted' and new.status = 'in_progress')
      or (old.status = 'in_progress' and new.status = 'completed')
    ) then
      raise exception 'Invalid employee task status transition';
    end if;

    if new.status = 'completed' then
      if new.completed_at is null then
        new.completed_at := now();
      end if;
    elsif new.completed_at is distinct from old.completed_at then
      raise exception 'Completion timestamp is only allowed when completing a task';
    end if;
  elsif new.completed_at is distinct from old.completed_at then
    raise exception 'Completion timestamp cannot be changed independently';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_employee_task_update on public.employee_tasks;
create trigger trg_guard_employee_task_update
before update on public.employee_tasks
for each row execute function public.guard_employee_task_update();

-- NFC lookup is a bearer-link endpoint. Use an empty search_path in this
-- SECURITY DEFINER function; all application relations are schema-qualified.
create or replace function public.public_nfc_lookup(p_uid text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_card public.nfc_cards%rowtype;
  v_customer_id uuid;
  v_customer jsonb;
  v_car jsonb;
  v_sub jsonb;
begin
  select c.* into v_card
  from public.nfc_cards c
  where upper(replace(coalesce(c.uid, ''), ':', '')) = upper(replace(trim(coalesce(p_uid, '')), ':', ''))
     or upper(replace(coalesce(c.serial_number, ''), ':', '')) = upper(replace(trim(coalesce(p_uid, '')), ':', ''))
  limit 1;

  if not found then
    return null;
  end if;

  v_customer_id := v_card.customer_id;
  if v_customer_id is null then
    return jsonb_build_object(
      'card', jsonb_build_object(
        'uid', v_card.uid,
        'serial_number', v_card.serial_number,
        'status', v_card.status,
        'activation_date', v_card.activation_date
      ),
      'customer', null, 'car', null, 'subscription', null
    );
  end if;

  select jsonb_build_object('full_name', coalesce(p.full_name, ''))
    into v_customer
  from public.profiles p
  where p.id = v_customer_id;

  select jsonb_build_object(
    'brand', c.brand,
    'model', c.model,
    'color', c.color,
    'plate_number', c.plate_number
  )
    into v_car
  from public.cars c
  where c.customer_id = v_customer_id
    and (v_card.car_id is null or c.id = v_card.car_id)
  order by c.created_at desc
  limit 1;

  select jsonb_build_object(
    'status', s.status,
    'remaining_washes', greatest(s.total_washes - s.used_washes, 0),
    'package', jsonb_build_object(
      'title_ar', pk.title_ar,
      'title_en', pk.title_en
    )
  )
    into v_sub
  from public.subscriptions s
  left join public.packages pk on pk.id = s.package_id
  where s.customer_id = v_customer_id
    and (v_card.car_id is null or s.car_id = v_card.car_id)
  order by s.created_at desc
  limit 1;

  return jsonb_build_object(
    'card', jsonb_build_object(
      'uid', v_card.uid,
      'serial_number', v_card.serial_number,
      'status', v_card.status,
      'activation_date', v_card.activation_date
    ),
    'customer', coalesce(v_customer, 'null'::jsonb),
    'car', coalesce(v_car, 'null'::jsonb),
    'subscription', coalesce(v_sub, 'null'::jsonb)
  );
end;
$function$;

revoke execute on function public.public_nfc_lookup(text) from public, anon;
grant execute on function public.public_nfc_lookup(text) to anon, authenticated, service_role;

-- A scan only looks up a card. This RPC is called after a staff member explicitly
-- confirms a wash. If a booking exists, lock and mark it; direct staff check-in
-- is also allowed when no booking exists, while still requiring an active subscription.
create or replace function public.checkin_nfc_card(
  p_card_value text,
  p_booking_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_card public.nfc_cards%rowtype;
  v_booking public.booking_requests%rowtype;
  v_has_booking boolean := false;
  v_sub public.subscriptions%rowtype;
  v_wash_id uuid;
  v_role text;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select ur.role::text into v_role
  from public.user_roles ur
  where ur.user_id = v_user
    and ur.role::text in ('admin', 'employee')
  order by case when ur.role::text = 'admin' then 0 else 1 end
  limit 1;

  if v_role is null then
    raise exception 'Only admin or employee can check in a card';
  end if;

  select c.* into v_card
  from public.nfc_cards c
  where upper(replace(coalesce(c.uid, ''), ':', '')) = upper(replace(trim(coalesce(p_card_value, '')), ':', ''))
     or upper(replace(coalesce(c.serial_number, ''), ':', '')) = upper(replace(trim(coalesce(p_card_value, '')), ':', ''))
  limit 1
  for update;

  if not found then raise exception 'NFC card not found'; end if;
  if v_card.customer_id is null then raise exception 'NFC card is not assigned to a customer'; end if;
  if v_card.status::text = 'blocked' then raise exception 'NFC card is blocked'; end if;

  if p_booking_id is not null then
    select br.* into v_booking
    from public.booking_requests br
    where br.id = p_booking_id
      and br.customer_id = v_card.customer_id
    for update;

    if not found then raise exception 'Booking not found for this customer'; end if;
    if v_booking.status::text not in ('pending', 'confirmed', 'accepted') then
      raise exception 'Booking is not eligible for check-in';
    end if;
    if coalesce(v_booking.wash_deducted, false) then
      raise exception 'Wash already deducted for this order';
    end if;
    v_has_booking := true;
  else
    select br.* into v_booking
    from public.booking_requests br
    where br.customer_id = v_card.customer_id
      and br.status::text in ('pending', 'confirmed', 'accepted')
      and coalesce(br.wash_deducted, false) = false
      and (v_card.car_id is null or br.car_id is null or br.car_id = v_card.car_id)
    order by br.scheduled_at nulls last, br.created_at desc
    limit 1
    for update;

    v_has_booking := found;
  end if;

  select s.* into v_sub
  from public.subscriptions s
  where s.customer_id = v_card.customer_id
    and s.status::text = 'active'
    and s.used_washes < s.total_washes
    and (s.end_date is null or s.end_date >= current_date)
    and (
      coalesce(v_booking.car_id, v_card.car_id) is null
      or s.car_id is null
      or s.car_id = coalesce(v_booking.car_id, v_card.car_id)
    )
  order by
    case when coalesce(v_booking.car_id, v_card.car_id) is not null and s.car_id = coalesce(v_booking.car_id, v_card.car_id) then 0 else 1 end,
    s.end_date nulls last,
    s.created_at desc
  limit 1
  for update;

  if not found then raise exception 'No active subscription with remaining washes'; end if;

  update public.subscriptions s
  set used_washes = s.used_washes + 1,
      updated_at = now()
  where s.id = v_sub.id;

  insert into public.washes(customer_id, subscription_id, car_id, washed_at, note)
  values (
    v_card.customer_id,
    v_sub.id,
    coalesce(v_booking.car_id, v_card.car_id, v_sub.car_id),
    now(),
    'NFC check-in by ' || v_role
  )
  returning id into v_wash_id;

  if v_has_booking then
    update public.booking_requests br
    set checked_in_at = now(),
        checked_in_by = v_user,
        wash_deducted = true,
        scan_method = 'nfc',
        card_id = v_card.id,
        status = case when br.status::text = 'pending' then 'accepted' else br.status end,
        updated_at = now()
    where br.id = v_booking.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'booking_id', case when v_has_booking then v_booking.id else null end,
    'customer_id', v_card.customer_id,
    'card_id', v_card.id,
    'subscription_id', v_sub.id,
    'wash_id', v_wash_id,
    'used_washes', v_sub.used_washes + 1,
    'remaining_washes', greatest(v_sub.total_washes - (v_sub.used_washes + 1), 0),
    'actor_role', v_role
  );
end;
$function$;

revoke execute on function public.checkin_nfc_card(text, uuid) from public, anon;
grant execute on function public.checkin_nfc_card(text, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
