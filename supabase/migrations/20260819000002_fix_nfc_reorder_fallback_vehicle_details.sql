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

  if v_car is null and v_last.car_id is not null then
    select * into v_car from public.cars where id = v_last.car_id;
  end if;

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
