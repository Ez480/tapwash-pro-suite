create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  package_id uuid not null references public.packages(id) on delete restrict,
  car_id uuid references public.cars(id) on delete set null,
  amount numeric not null default 0,
  payment_method text not null default 'cash',
  payment_status text not null default 'pending',
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_requests_status_check check (status in ('pending','confirmed','rejected','cancelled')),
  constraint subscription_requests_payment_status_check check (payment_status in ('pending','paid','rejected')),
  constraint subscription_requests_payment_method_check check (payment_method in ('cash','smart_wallet','instapay','bank_transfer'))
);
create index if not exists subscription_requests_status_idx on public.subscription_requests(status, requested_at desc);
create index if not exists subscription_requests_customer_idx on public.subscription_requests(customer_id, requested_at desc);
alter table public.subscription_requests enable row level security;
drop policy if exists subscription_requests_customer_select on public.subscription_requests;
create policy subscription_requests_customer_select on public.subscription_requests for select to authenticated using (customer_id = (select auth.uid()));
drop policy if exists subscription_requests_customer_insert on public.subscription_requests;
create policy subscription_requests_customer_insert on public.subscription_requests for insert to authenticated with check (customer_id = (select auth.uid()));
drop policy if exists subscription_requests_admin_all on public.subscription_requests;
create policy subscription_requests_admin_all on public.subscription_requests for all to authenticated using (public.has_role((select auth.uid()), 'admin'::app_role)) with check (public.has_role((select auth.uid()), 'admin'::app_role));
create or replace function public.touch_subscription_request_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists subscription_requests_updated_at on public.subscription_requests;
create trigger subscription_requests_updated_at before update on public.subscription_requests for each row execute function public.touch_subscription_request_updated_at();
create or replace function public.notify_admins_on_subscription_request() returns trigger language plpgsql security definer set search_path = public as $$
declare customer_name text; package_name text;
begin
  select p.full_name into customer_name from public.profiles p where p.id = new.customer_id;
  select coalesce(pkg.title_ar, pkg.title_en) into package_name from public.packages pkg where pkg.id = new.package_id;
  insert into public.notifications(customer_id,title,message,is_read)
  values(null,'طلب اشتراك جديد','عميل طلب اشتراك في باقة.' || E'\n' || 'العميل: ' || coalesce(customer_name,'غير معروف') || E'\n' || 'الباقة: ' || coalesce(package_name,'غير محددة') || E'\n' || 'المبلغ: ' || coalesce(new.amount::text,'0') || ' جنيه' || E'\n' || 'طريقة الدفع: ' || case new.payment_method when 'cash' then 'كاش' when 'smart_wallet' then 'محفظة' when 'instapay' then 'InstaPay' when 'bank_transfer' then 'تحويل بنكي' else new.payment_method end,false);
  return new;
end; $$;
drop trigger if exists notify_admins_subscription_request on public.subscription_requests;
create trigger notify_admins_subscription_request after insert on public.subscription_requests for each row execute function public.notify_admins_on_subscription_request();
create or replace function public.confirm_subscription_request(p_request_id uuid, p_admin_id uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare r public.subscription_requests; pkg public.packages; new_subscription_id uuid; start_date date; end_date date;
begin
  if not public.has_role(p_admin_id, 'admin'::app_role) then raise exception 'Only admins can confirm subscription requests'; end if;
  select * into r from public.subscription_requests where id = p_request_id for update;
  if not found then raise exception 'Subscription request not found'; end if;
  if r.status <> 'pending' then raise exception 'Subscription request is not pending'; end if;
  if r.payment_status <> 'paid' then raise exception 'Payment must be confirmed first'; end if;
  select * into pkg from public.packages where id = r.package_id;
  if not found then raise exception 'Package not found'; end if;
  start_date := current_date; end_date := start_date + greatest(pkg.duration_days - 1, 0);
  insert into public.subscriptions(customer_id,car_id,package_id,total_washes,used_washes,start_date,end_date,status) values(r.customer_id,r.car_id,r.package_id,pkg.washes_count,0,start_date,end_date,'active') returning id into new_subscription_id;
  update public.subscription_requests set status='confirmed', confirmed_at=now(), confirmed_by=p_admin_id, updated_at=now() where id=r.id;
  insert into public.notifications(customer_id,title,message,is_read) values(r.customer_id,'تم تأكيد الاشتراك','تم تأكيد الدفع وتفعيل اشتراكك في باقة ' || coalesce(pkg.title_ar,pkg.title_en) || '. سيتم تحديد مواعيد الغسلات من الإدارة.',false);
  return new_subscription_id;
end; $$;
grant execute on function public.confirm_subscription_request(uuid,uuid) to authenticated;
create or replace function public.notify_subscription_order_reminders() returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(customer_id,title,message,is_read)
  select null,'تذكير بأوردرات اشتراكات الغد','غداً يوجد أوردر اشتراك مجدول.' || E'\n' || 'الأوردر: ' || coalesce(t.serial_number,t.id::text) || E'\n' || 'العميل: ' || coalesce(t.customer_name,'غير معروف') || E'\n' || 'الهاتف: ' || coalesce(t.customer_phone,'غير مسجل') || E'\n' || 'الباقة: ' || coalesce(t.package_name,'اشتراك') || E'\n' || 'الموعد: ' || to_char(t.scheduled_at at time zone 'Africa/Cairo','YYYY-MM-DD HH24:MI') || E'\n' || 'الموقع: ' || coalesce(t.location_text,t.location_url,'غير مسجل') || E'\n' || 'الملاحظات: ' || coalesce(t.notes,'لا توجد'),false
  from public.employee_tasks t
  where t.scheduled_at is not null and t.status in ('pending','accepted','in_progress') and (t.scheduled_at at time zone 'Africa/Cairo')::date = ((now() at time zone 'Africa/Cairo')::date + 1)
    and not exists (select 1 from public.notifications n where n.customer_id is null and n.title='تذكير بأوردرات اشتراكات الغد' and n.created_at::date=(now() at time zone 'Africa/Cairo')::date and n.message like '%الأوردر: ' || coalesce(t.serial_number,t.id::text) || '%');
end; $$;
do $$ begin perform cron.unschedule(jobid) from cron.job where jobname='tapwash-subscription-order-reminders-9pm'; exception when others then null; end $$;
select cron.schedule('tapwash-subscription-order-reminders-9pm','0 18 * * *','select public.notify_subscription_order_reminders();');
notify pgrst, 'reload schema';
