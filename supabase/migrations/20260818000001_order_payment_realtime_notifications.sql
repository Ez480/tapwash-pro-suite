-- Real-time notifications for payment and order lifecycle events.

create index if not exists notifications_customer_created_at_idx
  on public.notifications(customer_id, created_at desc);

create or replace function public.notify_admins_on_payment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.status in ('pending','awaiting','unpaid'))
     or (tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('pending','awaiting','unpaid')) then
    insert into public.notifications (customer_id, title, message, is_read)
    values (
      null,
      'دفعة معلقة',
      'يوجد دفع معلق جديد بقيمة ' || coalesce(new.amount::text, '0') || ' جنيه' ||
      case when new.reference is not null then ' — المرجع: ' || new.reference else '' end,
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
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (customer_id, title, message, is_read)
    values (
      null,
      'طلب جديد',
      'تم إنشاء طلب جديد من ' || coalesce(new.customer_name, 'عميل') ||
      case when new.amount is not null then ' بقيمة ' || new.amount::text || ' جنيه' else '' end,
      false
    );

    if new.customer_id is not null then
      insert into public.notifications (customer_id, title, message, is_read)
      values (new.customer_id, 'تم استلام طلبك', 'تم تسجيل طلبك بنجاح، وسيتم تحديث حالته أولاً بأول.', false);
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
      'تم تغيير حالة طلب ' || coalesce(new.customer_name, 'عميل') || ' إلى: ' || coalesce(new.status, 'غير محددة') || '.',
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
