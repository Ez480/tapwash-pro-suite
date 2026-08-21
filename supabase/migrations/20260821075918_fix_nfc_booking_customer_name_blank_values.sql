-- Fix NFC booking customer-name resolution when profile/customer names are empty strings.
-- Empty strings must not block fallback to the other customer sources.

create or replace function public.public_nfc_booking_defaults(p_uid text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_card record;
  v_customer record;
  v_profile record;
  v_car record;
  v_last record;
  v_customer_id uuid;
  v_name text;
  v_phone text;
  v_email text;
begin
  select * into v_card
  from public.nfc_cards
  where lower(trim(uid)) = lower(trim(p_uid))
     or lower(trim(serial_number)) = lower(trim(p_uid))
  limit 1;
  if not found or v_card.customer_id is null then return null; end if;

  select br.* into v_last
  from public.booking_requests br
  where br.customer_id = v_card.customer_id
    and br.status not in ('rejected','cancelled')
    and (br.card_id = v_card.id or (v_card.car_id is not null and br.car_id = v_card.car_id) or v_card.car_id is null)
  order by case when br.card_id = v_card.id then 0 else 1 end,
           case when br.status in ('completed','closed') then 0 else 1 end,
           br.created_at desc
  limit 1;

  select id, full_name, phone, email into v_customer
  from public.customers
  where id = v_card.customer_id
  limit 1;

  select id, full_name, phone, email into v_profile
  from public.profiles
  where id = v_card.customer_id
  limit 1;

  v_customer_id := v_card.customer_id;
  v_name := coalesce(
    nullif(trim(v_customer.full_name), ''),
    nullif(trim(v_profile.full_name), ''),
    nullif(trim(v_last.customer_name), '')
  );
  v_phone := coalesce(
    nullif(trim(v_customer.phone), ''),
    nullif(trim(v_profile.phone), ''),
    nullif(trim(v_last.customer_phone), '')
  );
  v_email := coalesce(
    nullif(trim(v_customer.email), ''),
    nullif(trim(v_profile.email), ''),
    nullif(trim(v_last.customer_email), '')
  );

  select * into v_car
  from public.cars
  where id = coalesce(v_card.car_id, v_last.car_id)
  limit 1;

  return jsonb_build_object(
    'card_id', v_card.id,
    'uid', v_card.uid,
    'customer_id', v_customer_id,
    'customer', jsonb_build_object('id',v_customer_id,'full_name',v_name,'phone',v_phone,'email',v_email),
    'car', to_jsonb(v_car),
    'last_order', to_jsonb(v_last)
  );
end;
$$;

create or replace function public.public_nfc_create_booking(p_uid text, p_scheduled_at timestamp with time zone, p_phone text default null, p_address text default '', p_location_url text default null, p_notes text default null, p_payment_method text default 'cash', p_wash_type text default 'car_wash')
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_card record;
  v_customer record;
  v_profile record;
  v_car record;
  v_last record;
  v_booking_id uuid;
  v_name text;
  v_phone text;
  v_email text;
  v_payment text;
begin
  if p_scheduled_at is null or p_scheduled_at <= now() then raise exception 'Please choose a future appointment.'; end if;
  if coalesce(trim(p_address),'') = '' then raise exception 'Address is required.'; end if;
  v_payment := lower(coalesce(nullif(trim(p_payment_method),''),'cash'));
  if v_payment not in ('cash','smart_wallet','instapay','bank_transfer') then raise exception 'Invalid payment method.'; end if;

  select * into v_card
  from public.nfc_cards
  where lower(trim(uid)) = lower(trim(p_uid))
     or lower(trim(serial_number)) = lower(trim(p_uid))
  limit 1;
  if not found or v_card.customer_id is null then raise exception 'NFC card is not linked to a customer.'; end if;

  select br.* into v_last
  from public.booking_requests br
  where br.customer_id = v_card.customer_id
    and br.status not in ('rejected','cancelled')
    and (br.card_id = v_card.id or (v_card.car_id is not null and br.car_id = v_card.car_id) or v_card.car_id is null)
  order by case when br.card_id = v_card.id then 0 else 1 end,
           case when br.status in ('completed','closed') then 0 else 1 end,
           br.created_at desc
  limit 1;

  select id, full_name, phone, email into v_customer
  from public.customers
  where id = v_card.customer_id
  limit 1;

  select id, full_name, phone, email into v_profile
  from public.profiles
  where id = v_card.customer_id
  limit 1;

  v_phone := coalesce(
    nullif(trim(p_phone),''),
    nullif(trim(v_customer.phone),''),
    nullif(trim(v_profile.phone),''),
    nullif(trim(v_last.customer_phone),'')
  );
  v_email := coalesce(
    nullif(trim(v_customer.email),''),
    nullif(trim(v_profile.email),''),
    nullif(trim(v_last.customer_email),'')
  );
  v_name := coalesce(
    nullif(trim(v_customer.full_name),''),
    nullif(trim(v_profile.full_name),''),
    nullif(trim(v_last.customer_name),''),
    nullif(trim(v_phone),'')
  );
  if coalesce(trim(v_name),'') = '' then raise exception 'Customer information is incomplete for this card.'; end if;

  select * into v_car
  from public.cars
  where id = coalesce(v_card.car_id, v_last.car_id)
  limit 1;

  if exists (select 1 from public.booking_requests br where br.scheduled_at = p_scheduled_at and br.status <> 'cancelled') then
    raise exception 'This appointment time is already booked.';
  end if;

  insert into public.booking_requests (
    customer_id, package_id, offer_id, car_id, wash_type, scheduled_at,
    customer_name, customer_phone, customer_email, car_type, car_brand, car_model, car_color, plate_number,
    address, location_url, notes, amount, payment_method, payment_status, status, wash_deducted, scan_method, card_id
  ) values (
    v_card.customer_id, v_last.package_id, v_last.offer_id, coalesce(v_card.car_id, v_last.car_id),
    coalesce(nullif(trim(p_wash_type),''), coalesce(v_last.wash_type,'car_wash')), p_scheduled_at,
    v_name, v_phone, v_email, coalesce(v_last.car_type, case when v_car.id is not null then 'car' else null end),
    coalesce(v_car.brand, v_last.car_brand), coalesce(v_car.model, v_last.car_model), coalesce(v_car.color, v_last.car_color),
    coalesce(v_car.plate_number, v_last.plate_number), trim(p_address), nullif(trim(p_location_url),''), nullif(trim(p_notes),''),
    coalesce(v_last.amount,0), v_payment, case when v_payment = 'cash' then 'unpaid' else 'awaiting_proof' end,
    'pending', false, 'customer_nfc_link', v_card.id
  ) returning id into v_booking_id;

  return v_booking_id;
exception when unique_violation then raise exception 'This appointment time is already booked.';
end;
$$;
