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
  start_date := (now() at time zone 'Africa/Cairo')::date;
  end_date := start_date + greatest(pkg.duration_days - 1, 0);
  insert into public.subscriptions(customer_id,car_id,package_id,total_washes,used_washes,start_date,end_date,status)
  values(r.customer_id,r.car_id,r.package_id,pkg.washes_count,0,start_date,end_date,'active') returning id into new_subscription_id;
  update public.subscription_requests set status='confirmed', confirmed_at=now(), confirmed_by=p_admin_id, updated_at=now() where id=r.id;
  insert into public.notifications(customer_id,title,message,is_read)
  values(r.customer_id,'تم تأكيد الاشتراك','تم تأكيد الدفع وتفعيل اشتراكك في باقة ' || coalesce(pkg.title_ar,pkg.title_en) || '. سيتم تحديد مواعيد الغسلات من الإدارة.',false);
  return new_subscription_id;
end; $$;

grant execute on function public.confirm_subscription_request(uuid,uuid) to authenticated;

create or replace function public.notify_subscription_order_reminders() returns void language plpgsql security definer set search_path = public as $$
begin
  if extract(hour from (now() at time zone 'Africa/Cairo')) <> 21 or extract(minute from (now() at time zone 'Africa/Cairo')) >= 5 then return; end if;
  insert into public.notifications(customer_id,title,message,is_read)
  select null,'تذكير بأوردرات اشتراكات الغد','غداً يوجد أوردر اشتراك مجدول.' || E'\n' || 'الأوردر: ' || coalesce(t.serial_number,t.id::text) || E'\n' || 'العميل: ' || coalesce(t.customer_name,'غير معروف') || E'\n' || 'الهاتف: ' || coalesce(t.customer_phone,'غير مسجل') || E'\n' || 'الباقة: ' || coalesce(t.package_name,'اشتراك') || E'\n' || 'الموعد: ' || to_char(t.scheduled_at at time zone 'Africa/Cairo','YYYY-MM-DD HH24:MI') || E'\n' || 'الموقع: ' || coalesce(t.location_text,t.location_url,'غير مسجل') || E'\n' || 'الملاحظات: ' || coalesce(t.notes,'لا توجد'),false
  from public.employee_tasks t
  where t.subscription_id is not null
    and t.scheduled_at is not null
    and t.status in ('pending','accepted','in_progress')
    and (t.scheduled_at at time zone 'Africa/Cairo')::date = ((now() at time zone 'Africa/Cairo')::date + 1)
    and not exists (
      select 1 from public.notifications n
      where n.customer_id is null
        and n.title='تذكير بأوردرات اشتراكات الغد'
        and (n.created_at at time zone 'Africa/Cairo')::date=(now() at time zone 'Africa/Cairo')::date
        and n.message like '%الأوردر: ' || coalesce(t.serial_number,t.id::text) || '%'
    );
end; $$;

grant execute on function public.notify_subscription_order_reminders() to authenticated;
