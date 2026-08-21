-- Keep subscription requests live between customer and management and notify both sides.
alter publication supabase_realtime add table public.subscription_requests;

create or replace function public.notify_admins_on_subscription_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_name text;
  customer_phone text;
  package_name text;
  payment_label text;
begin
  select p.full_name, p.phone
    into customer_name, customer_phone
    from public.profiles p
   where p.id = new.customer_id;

  select coalesce(pkg.title_ar, pkg.title_en)
    into package_name
    from public.packages pkg
   where pkg.id = new.package_id;

  payment_label := case new.payment_method
    when 'cash' then 'كاش'
    when 'smart_wallet' then 'محفظة'
    when 'instapay' then 'InstaPay'
    when 'bank_transfer' then 'تحويل بنكي'
    else coalesce(new.payment_method, 'غير محددة')
  end;

  insert into public.notifications(customer_id, title, message, is_read)
  values(
    null,
    'طلب اشتراك جديد',
    'عميل طلب اشتراك في باقة.' || E'\n'
    || 'العميل: ' || coalesce(customer_name,'غير معروف') || E'\n'
    || 'الهاتف: ' || coalesce(customer_phone,'غير مسجل') || E'\n'
    || 'الباقة: ' || coalesce(package_name,'غير محددة') || E'\n'
    || 'المبلغ: ' || coalesce(new.amount::text,'0') || ' جنيه' || E'\n'
    || 'طريقة الدفع: ' || payment_label,
    false
  );

  if new.customer_id is not null then
    insert into public.notifications(customer_id, title, message, is_read)
    values(
      new.customer_id,
      'تم استلام طلب الاشتراك',
      'تم استلام طلب اشتراكك في باقة ' || coalesce(package_name,'غير محددة') || '. طريقة الدفع: ' || payment_label || '. سيتم تأكيد الدفع من الإدارة قبل التفعيل.',
      false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_admins_subscription_request on public.subscription_requests;
create trigger notify_admins_subscription_request
after insert on public.subscription_requests
for each row execute function public.notify_admins_on_subscription_request();

notify pgrst,'reload schema';
