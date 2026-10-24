-- Harden privileged RPC entry points without changing their signatures.
-- The client-provided p_admin_id is not an authorization credential; trust
-- only the authenticated session identity (auth.uid()).

create or replace function public.confirm_subscription_request(
  p_request_id uuid,
  p_admin_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r public.subscription_requests;
  pkg public.packages;
  new_subscription_id uuid;
  v_start_date date;
  v_end_date date;
  v_payment_id uuid;
  v_payment_status text;
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null
     or not public.has_role(v_actor_id, 'admin'::public.app_role) then
    raise exception 'Only authenticated admins can confirm subscription requests';
  end if;

  select * into r
  from public.subscription_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'Subscription request not found'; end if;
  if r.status <> 'pending' then raise exception 'Subscription request is not pending'; end if;
  if r.payment_status not in ('pending', 'paid') then
    raise exception 'Subscription request payment cannot be confirmed from its current state';
  end if;

  select p.id, p.status into v_payment_id, v_payment_status
  from public.payments p
  where p.reference = 'subscription_request:' || r.id::text
    and p.customer_id = r.customer_id
  order by p.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Payment transaction not found for this subscription request';
  end if;
  if coalesce(v_payment_status, '') not in ('pending', 'paid') then
    raise exception 'Payment transaction cannot be confirmed from its current state';
  end if;

  -- Confirmation and activation are atomic under the locked request/payment rows.
  update public.payments
  set status = 'paid',
      paid_at = coalesce(paid_at, now())
  where id = v_payment_id;

  select * into pkg
  from public.packages
  where id = r.package_id;

  if not found then raise exception 'Package not found'; end if;

  v_start_date := current_date;
  v_end_date := v_start_date + greatest(coalesce(pkg.duration_days, 30) - 1, 0);

  select s.id into new_subscription_id
  from public.subscriptions s
  where s.request_id = r.id
  limit 1
  for update;

  if new_subscription_id is null then
    insert into public.subscriptions (
      customer_id, car_id, package_id, total_washes, used_washes,
      start_date, end_date, status, request_id
    )
    values (
      r.customer_id, r.car_id, r.package_id, pkg.washes_count, 0,
      v_start_date, v_end_date, 'active', r.id
    )
    returning id into new_subscription_id;
  else
    update public.subscriptions
    set customer_id = r.customer_id,
        car_id = r.car_id,
        package_id = r.package_id,
        total_washes = pkg.washes_count,
        start_date = v_start_date,
        end_date = v_end_date,
        status = 'active',
        updated_at = now()
    where id = new_subscription_id;
  end if;

  update public.payments
  set subscription_id = new_subscription_id
  where id = v_payment_id;

  update public.subscription_requests
  set status = 'confirmed',
      payment_status = 'paid',
      confirmed_at = now(),
      confirmed_by = v_actor_id,
      updated_at = now()
  where id = r.id;

  insert into public.notifications (customer_id, title, message, is_read)
  values (
    r.customer_id,
    'تم تأكيد الاشتراك',
    'تم تأكيد الدفع وتفعيل اشتراكك. سيتم تحديد مواعيد الغسلات من الإدارة.',
    false
  );

  return new_subscription_id;
end;
$function$;

-- These RPCs are intended for signed-in staff/admin only. Their bodies also
-- enforce the admin role; removing PUBLIC/anon EXECUTE is defense in depth.
revoke execute on function public.confirm_subscription_request(uuid, uuid) from public, anon, service_role;
grant execute on function public.confirm_subscription_request(uuid, uuid) to authenticated;

revoke execute on function public.admin_delete_employee(uuid) from public, anon;
grant execute on function public.admin_delete_employee(uuid) to authenticated, service_role;

revoke execute on function public.admin_list_employees() from public, anon;
grant execute on function public.admin_list_employees() to authenticated, service_role;

revoke execute on function public.admin_save_employee(uuid, text, text, date, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_save_employee(uuid, text, text, date, text, text, text, text, text, text, text) to authenticated, service_role;

revoke execute on function public.admin_upsert_employee(uuid, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_upsert_employee(uuid, text, text, text, text, text, text, text, text, text) to authenticated, service_role;

revoke execute on function public.checkin_nfc_card(text, uuid) from public, anon, service_role;
grant execute on function public.checkin_nfc_card(text, uuid) to authenticated;

notify pgrst, 'reload schema';
