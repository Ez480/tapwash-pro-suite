alter table public.payments alter column paid_at drop not null;

create or replace function public.create_subscription_payment_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.payments(customer_id, subscription_id, amount, method, reference, status, paid_at)
  values (new.customer_id, null, new.amount, new.payment_method, 'subscription_request:' || new.id::text, 'pending', null);
  return new;
end;
$$;

drop trigger if exists create_subscription_payment_request on public.subscription_requests;
create trigger create_subscription_payment_request
after insert on public.subscription_requests
for each row execute function public.create_subscription_payment_request();

create or replace function public.confirm_subscription_request(p_request_id uuid, p_admin_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.subscription_requests;
  pkg public.packages;
  new_subscription_id uuid;
  v_start_date date;
  v_end_date date;
  v_payment_status text;
begin
  if not public.has_role(p_admin_id,'admin'::app_role) then raise exception 'Only admins can confirm subscription requests'; end if;
  select * into r from public.subscription_requests where id=p_request_id for update;
  if not found then raise exception 'Subscription request not found'; end if;
  if r.status <> 'pending' then raise exception 'Subscription request is not pending'; end if;
  if r.payment_status <> 'paid' then raise exception 'Payment must be confirmed first'; end if;
  select p.status into v_payment_status from public.payments p where p.reference='subscription_request:' || r.id::text order by p.created_at desc limit 1;
  if coalesce(v_payment_status,'') <> 'paid' then raise exception 'Payment transaction must be manually confirmed first'; end if;
  select * into pkg from public.packages where id=r.package_id;
  if not found then raise exception 'Package not found'; end if;
  v_start_date := current_date;
  v_end_date := v_start_date + greatest(coalesce(pkg.duration_days,30)-1,0);
  select id into new_subscription_id from public.subscriptions where request_id=r.id limit 1 for update;
  if new_subscription_id is null then
    insert into public.subscriptions(customer_id, car_id, package_id, total_washes, used_washes, start_date, end_date, status, request_id)
    values(r.customer_id,r.car_id,r.package_id,pkg.washes_count,0,v_start_date,v_end_date,'active',r.id) returning id into new_subscription_id;
  else
    update public.subscriptions set customer_id=r.customer_id,car_id=r.car_id,package_id=r.package_id,total_washes=pkg.washes_count,start_date=v_start_date,end_date=v_end_date,status='active',updated_at=now() where id=new_subscription_id;
  end if;
  update public.subscription_requests set status='confirmed',confirmed_at=now(),confirmed_by=p_admin_id,updated_at=now() where id=r.id;
  insert into public.notifications(customer_id,title,message,is_read) values(r.customer_id,'تم تأكيد الاشتراك','تم تأكيد الدفع وتفعيل اشتراكك. سيتم تحديد مواعيد الغسلات من الإدارة.',false);
  return new_subscription_id;
end;
$$;
