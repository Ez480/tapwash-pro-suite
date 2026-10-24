-- Reduce private data returned by public NFC endpoints.
-- The physical card link is a bearer link; never return contact details,
-- addresses, location URLs, notes, booking records, or internal row IDs.

create or replace function public.public_nfc_booking_defaults(p_uid text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_card record;
  v_last record;
begin
  select c.id, c.customer_id, c.car_id
    into v_card
  from public.nfc_cards c
  where lower(trim(coalesce(c.uid, ''))) = lower(trim(coalesce(p_uid, '')))
     or lower(trim(coalesce(c.serial_number, ''))) = lower(trim(coalesce(p_uid, '')))
  limit 1;

  if not found or v_card.customer_id is null then
    return null;
  end if;

  select br.wash_type, br.amount, br.payment_method
    into v_last
  from public.booking_requests br
  where br.customer_id = v_card.customer_id
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
    'customer', null,
    'car', null,
    'last_order',
      case when found then jsonb_build_object(
        'wash_type', v_last.wash_type,
        'amount', v_last.amount,
        'payment_method', v_last.payment_method
      ) else null end
  );
end;
$function$;

create or replace function public.public_nfc_lookup(p_uid text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_card public.nfc_cards%rowtype;
  v_customer_id uuid;
  v_customer jsonb;
  v_car jsonb;
  v_sub jsonb;
  v_can_view_identity boolean := false;
begin
  select * into v_card
  from public.nfc_cards c
  where upper(replace(coalesce(c.uid, ''), ':', '')) = upper(replace(trim(p_uid), ':', ''))
     or upper(replace(coalesce(c.serial_number, ''), ':', '')) = upper(replace(trim(p_uid), ':', ''))
  limit 1;

  if not found then
    return null;
  end if;

  v_customer_id := v_card.customer_id;
  v_can_view_identity := v_customer_id = auth.uid()
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'employee'::public.app_role);
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

  if v_can_view_identity then
    select jsonb_build_object('full_name', coalesce(p.full_name, ''))
      into v_customer
  from public.profiles p
    where p.id = v_customer_id;
  else
    v_customer := jsonb_build_object('full_name', null);
  end if;

  select jsonb_build_object(
    'brand', c.brand,
    'model', c.model,
    'color', c.color,
    'plate_number', case when v_can_view_identity then c.plate_number else null end
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
    and (v_card.car_id is null or s.car_id is null or s.car_id = v_card.car_id)
  order by
    case when v_card.car_id is not null and s.car_id = v_card.car_id then 0 else 1 end,
    case when s.status::text = 'active' and s.used_washes < s.total_washes and (s.end_date is null or s.end_date >= current_date) then 0 else 1 end,
    s.created_at desc
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

revoke execute on function public.public_nfc_booking_defaults(text) from public, anon;
grant execute on function public.public_nfc_booking_defaults(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
