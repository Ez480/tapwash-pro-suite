-- Close a pending subscription request, its pending payment transaction, any
-- provisional subscription, and the customer notification in one transaction.
create or replace function public.close_subscription_request(
  p_request_id uuid,
  p_outcome text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r public.subscription_requests%rowtype;
  v_payment_id uuid;
  v_payment_status text;
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null
     or not public.has_role(v_actor_id, 'admin'::public.app_role) then
    raise exception 'Only authenticated admins can close subscription requests';
  end if;

  if p_outcome is null or p_outcome not in ('rejected', 'cancelled') then
    raise exception 'Invalid subscription request outcome';
  end if;

  select * into r
  from public.subscription_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'Subscription request not found'; end if;
  if r.status <> 'pending' then raise exception 'Subscription request is not pending'; end if;

  select p.id, p.status into v_payment_id, v_payment_status
  from public.payments p
  where p.reference = 'subscription_request:' || r.id::text
    and p.customer_id = r.customer_id
  order by p.created_at desc
  limit 1
  for update;

  if found and coalesce(v_payment_status, '') = 'paid' then
    raise exception 'This payment is already confirmed; handle any refund separately';
  end if;

  if v_payment_id is not null and v_payment_status = 'pending' then
    update public.payments
    set status = 'rejected', paid_at = null
    where id = v_payment_id;
  end if;

  update public.subscriptions
  set status = 'cancelled', updated_at = now()
  where request_id = r.id
    and status in ('pending', 'active');

  update public.subscription_requests
  set status = p_outcome,
      payment_status = 'rejected',
      confirmed_at = null,
      confirmed_by = null,
      updated_at = now()
  where id = r.id;

  insert into public.notifications(customer_id, title, message, is_read)
  values (
    r.customer_id,
    case when p_outcome = 'cancelled' then 'تم إلغاء طلب الاشتراك' else 'تم رفض طلب الاشتراك' end,
    case when p_outcome = 'cancelled'
      then 'تم إلغاء طلب الاشتراك من الإدارة. لو عندك استفسار تواصل مع خدمة العملاء.'
      else 'لم يتم قبول طلب الاشتراك من الإدارة. لو عندك استفسار تواصل مع خدمة العملاء.'
    end,
    false
  );
end;
$function$;

revoke execute on function public.close_subscription_request(uuid, text) from public, anon, service_role;
grant execute on function public.close_subscription_request(uuid, text) to authenticated;

notify pgrst, 'reload schema';
