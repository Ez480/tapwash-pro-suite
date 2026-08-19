CREATE OR REPLACE FUNCTION public.customer_nfc_reorder_lookup(p_uid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_card record;
  v_last record;
  v_car record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_card
  from public.nfc_cards
  where lower(trim(uid)) = lower(trim(p_uid))
  limit 1;

  if not found then
    return null;
  end if;

  if v_card.customer_id <> auth.uid() then
    return jsonb_build_object('owned', false, 'card_id', v_card.id, 'uid', v_card.uid);
  end if;

  select * into v_car from public.cars where id = v_card.car_id;

  -- Customer-linked cards can exist before they are linked to a car, and
  -- historical orders may have card_id = NULL. Fall back to the customer's
  -- latest usable order, preferring completed orders.
  select br.* into v_last
  from public.booking_requests br
  where br.customer_id = auth.uid()
    and br.status not in ('rejected', 'cancelled')
    and (
      br.card_id = v_card.id
      or (v_card.car_id is not null and br.car_id = v_card.car_id)
      or v_card.car_id is null
    )
  order by
    case when br.card_id = v_card.id then 0 else 1 end,
    case when br.status in ('completed', 'closed') then 0 else 1 end,
    br.created_at desc
  limit 1;

  return jsonb_build_object(
    'owned', true,
    'card_id', v_card.id,
    'uid', v_card.uid,
    'customer_id', v_card.customer_id,
    'car_id', coalesce(v_card.car_id, v_last.car_id),
    'car', to_jsonb(v_car),
    'last_order', to_jsonb(v_last)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_customer_nfc_reorder(p_card_id uuid, p_scheduled_at timestamp with time zone, p_payment_method text)
 RETURNS public.booking_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_card record;
  v_last record;
  v_new public.booking_requests;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_card
  from public.nfc_cards
  where id = p_card_id
  for update;

  if not found or v_card.customer_id <> auth.uid() then
    raise exception 'This NFC card is not linked to your account';
  end if;

  if exists (
    select 1
    from public.booking_requests
    where scheduled_at between p_scheduled_at - interval '1 minute' and p_scheduled_at + interval '1 minute'
      and status not in ('completed', 'closed', 'rejected', 'cancelled')
  ) then
    raise exception 'This time is already booked';
  end if;

  -- Use the same matching rules as the lookup function so a customer-linked
  -- card can reorder from historical orders whose card_id was NULL.
  select br.* into v_last
  from public.booking_requests br
  where br.customer_id = auth.uid()
    and br.status not in ('rejected', 'cancelled')
    and (
      br.card_id = v_card.id
      or (v_card.car_id is not null and br.car_id = v_card.car_id)
      or v_card.car_id is null
    )
  order by
    case when br.card_id = v_card.id then 0 else 1 end,
    case when br.status in ('completed', 'closed') then 0 else 1 end,
    br.created_at desc
  limit 1;

  if not found then
    raise exception 'No previous order found for this card';
  end if;

  insert into public.booking_requests(
    customer_id, package_id, offer_id, car_id, wash_type, scheduled_at,
    customer_name, customer_phone, customer_email, car_type, car_brand,
    car_model, car_color, plate_number, address, location_url, latitude,
    longitude, notes, amount, payment_method, payment_status, status,
    scan_method, card_id
  )
  values(
    auth.uid(), v_last.package_id, v_last.offer_id,
    coalesce(v_card.car_id, v_last.car_id),
    v_last.wash_type, p_scheduled_at, v_last.customer_name,
    v_last.customer_phone, v_last.customer_email, v_last.car_type,
    v_last.car_brand, v_last.car_model, v_last.car_color, v_last.plate_number,
    v_last.address, v_last.location_url, v_last.latitude, v_last.longitude,
    v_last.notes, v_last.amount, p_payment_method,
    case when p_payment_method = 'cash' then 'unpaid' else 'awaiting_proof' end,
    'pending', 'customer_nfc_reorder', v_card.id
  )
  returning * into v_new;

  return v_new;
end;
$function$;
