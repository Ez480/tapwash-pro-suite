-- Real-time notifications for payment and order lifecycle events.
-- Admin notifications use customer_id = null; customer notifications use customer_id = the customer's auth id.

create index if not exists notifications_customer_created_at_idx
  on public.notifications(customer_id, created_at desc);

create or replace function public.notify_admins_on_payment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_name text;
  customer_phone text;
begin
  if (tg_op = 'INSERT' and new.status in ('pending','awaiting','unpaid'))
     or (tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('pending','awaiting','unpaid')) then

    select p.full_name, p.phone
      into customer_name, customer_phone
      from public.profiles p
     where p.id = new.customer_id;

    insert into public.notifications (customer_id, title, message, is_read)
    values (
      null,
      'دفعة جديدة معلقة',
      'يوجد دفع جديد يحتاج مراجعة.' || E'\n'
      || 'العميل: ' || coalesce(customer_name, 'غير معروف') || E'\n'
      || 'الهاتف: ' || coalesce(customer_phone, 'غير مسجل') || E'\n'
      || 'المبلغ: ' || coalesce(new.amount::text, '0') || ' جنيه' || E'\n'
      || 'طريقة الدفع: ' || coalesce(new.method, 'غير محددة') ||
      case when new.reference is not null then E'\nالمرجع: ' || new.reference else '' end,
      false
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_admins_payment on public.payments;
create trigger notify_admins_payment
after insert or update of status on public.payments
for each row execute function public.notify_admins_on_payment_change();

create or replace function public.notify_order_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_message text;
  admin_message text;
begin
  if tg_op = 'INSERT' then
    admin_message :=
      'تم إنشاء طلب حجز جديد.' || E'\n'
      || 'العميل: ' || coalesce(new.customer_name, 'غير معروف') || E'\n'
      || 'الهاتف: ' || coalesce(new.customer_phone, 'غير مسجل') || E'\n'
      || 'البريد: ' || coalesce(new.customer_email, 'غير مسجل') || E'\n'
      || 'نوع الخدمة: ' || coalesce(new.wash_type, 'غير محدد') || E'\n'
      || 'العربية: ' || concat_ws(' · ', new.car_type, new.car_brand, new.car_model, new.car_color, new.plate_number) || E'\n'
      || 'الموعد: ' || coalesce(to_char(new.scheduled_at, 'YYYY-MM-DD HH24:MI'), 'غير محدد') || E'\n'
      || 'العنوان: ' || coalesce(new.address, 'غير مسجل') || E'\n'
      || 'المبلغ: ' || coalesce(new.amount::text, '0') || ' جنيه' || E'\n'
      || 'طريقة الدفع: ' || coalesce(new.payment_method, 'غير محددة') || E'\n'
      || 'حالة الدفع: ' || coalesce(new.payment_status, 'غير محددة') ||
      case when new.notes is not null and trim(new.notes) <> '' then E'\nملاحظات: ' || new.notes else '' end;

    insert into public.notifications (customer_id, title, message, is_read)
    values (null, 'طلب جديد', admin_message, false);

    if new.customer_id is not null then
      insert into public.notifications (customer_id, title, message, is_read)
      values (
        new.customer_id,
        'تم استلام طلبك',
        'تم تسجيل طلبك بنجاح، وسيتم تحديث حالته أولاً بأول.',
        false
      );
    end if;

  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    customer_message := 'تم تحديث حالة طلبك إلى: ' || coalesce(new.status, 'غير محددة') || '.';

    if new.customer_id is not null then
      insert into public.notifications (customer_id, title, message, is_read)
      values (new.customer_id, 'تحديث حالة الطلب', customer_message, false);
    end if;

    insert into public.notifications (customer_id, title, message, is_read)
    values (
      null,
      'تحديث طلب',
      'تم تغيير حالة طلب ' || coalesce(new.customer_name, 'عميل') ||
      ' إلى: ' || coalesce(new.status, 'غير محددة') || E'\n'
      || 'الهاتف: ' || coalesce(new.customer_phone, 'غير مسجل') || E'\n'
      || 'الموعد: ' || coalesce(to_char(new.scheduled_at, 'YYYY-MM-DD HH24:MI'), 'غير محدد'),
      false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_order_lifecycle on public.booking_requests;
create trigger notify_order_lifecycle
after insert or update of status on public.booking_requests
for each row execute function public.notify_order_lifecycle();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'booking_requests') then
    alter publication supabase_realtime add table public.booking_requests;
  end if;
end $$;

notify pgrst, 'reload schema';
