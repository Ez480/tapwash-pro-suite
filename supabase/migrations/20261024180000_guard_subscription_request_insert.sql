-- Customer subscription requests are permitted, but pricing and lifecycle fields
-- must be derived/controlled by the database rather than trusted from the browser.
create or replace function public.guard_subscription_request_insert()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_package public.packages%rowtype;
begin
  if public.has_role(v_user, 'admin'::public.app_role)
     or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if v_user is null then
    raise exception 'Sign in before requesting a subscription';
  end if;

  if new.customer_id is distinct from v_user then
    raise exception 'Customers may only request subscriptions for their own account';
  end if;

  select p.* into v_package
  from public.packages p
  where p.id = new.package_id
    and p.status::text = 'active'
  for share;

  if not found then
    raise exception 'This package is not available';
  end if;

  if new.car_id is not null and not exists (
    select 1 from public.cars c
    where c.id = new.car_id and c.customer_id = v_user
  ) then
    raise exception 'The selected vehicle does not belong to this customer';
  end if;

  if lower(coalesce(new.payment_method, 'cash')) not in ('cash', 'smart_wallet', 'instapay', 'bank_transfer') then
    raise exception 'Invalid payment method';
  end if;

  if jsonb_typeof(coalesce(new.requested_washes, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(new.requested_washes, '[]'::jsonb)) > greatest(coalesce(v_package.washes_count, 0), 0) then
    raise exception 'Invalid requested wash schedule';
  end if;

  -- Do not trust client-supplied price, status, payment state, or audit fields.
  new.amount := v_package.price;
  new.payment_method := lower(coalesce(new.payment_method, 'cash'));
  new.payment_status := 'pending';
  new.status := 'pending';
  new.confirmed_at := null;
  new.confirmed_by := null;
  new.requested_at := now();
  new.created_at := now();
  new.updated_at := now();

  return new;
end;
$function$;

drop trigger if exists trg_guard_subscription_request_insert on public.subscription_requests;
create trigger trg_guard_subscription_request_insert
before insert on public.subscription_requests
for each row execute function public.guard_subscription_request_insert();

revoke execute on function public.guard_subscription_request_insert() from public, anon, authenticated;

notify pgrst, 'reload schema';
