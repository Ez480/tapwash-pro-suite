-- Manual payment proof notifications for booking requests.
-- Covers wallet, InstaPay, and bank transfer payment submissions/status changes.

create or replace function public.notify_booking_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_name text;
  method_label text;
  status_label text;
begin
  status_label := coalesce(new.payment_status, 'unpaid');
  method_label := case lower(coalesce(new.payment_method,''))
    when 'smart_wallet' then 'محفظة إلكترونية'
    when 'instapay' then 'InstaPay'
    when 'bank_transfer' then 'تحويل بنكي'
    when 'cash' then 'دفع نقدي'
    else coalesce(new.payment_method, 'غير محددة')
  end;
  customer_name := coalesce(new.customer_name, 'عميل');

  if tg_op = 'INSERT' and status_label in ('awaiting_proof','pending','awaiting','unpaid') then
    insert into public.notifications(customer_id,title,message,is_read)
    values(null,'دفعة جديدة تحتاج مراجعة','العميل: '||customer_name||E'\nالمبلغ: '||coalesce(new.amount::text,'0')||' جنيه'||E'\nطريقة الدفع: '||method_label||E'\nحالة الدفع: '||status_label,false);
    if new.customer_id is not null then
      insert into public.notifications(customer_id,title,message,is_read)
      values(new.customer_id,'تم استلام إثبات الدفع','تم استلام طلب الدفع عبر '||method_label||' وسيتم مراجعته من الإدارة.',false);
    end if;
  elsif tg_op = 'UPDATE' and new.payment_status is distinct from old.payment_status then
    if new.customer_id is not null then
      insert into public.notifications(customer_id,title,message,is_read)
      values(new.customer_id,
        case status_label when 'paid' then 'تم تأكيد الدفع' when 'cancelled' then 'لم يتم تأكيد الدفع' when 'rejected' then 'تم رفض الدفع' else 'تحديث حالة الدفع' end,
        case status_label when 'paid' then 'تم تأكيد دفعتك بنجاح.' when 'cancelled' then 'لم يتم تأكيد دفعتك.' when 'rejected' then 'تم رفض إثبات الدفع. يمكنك التواصل مع الإدارة.' else 'حالة الدفع الحالية: '||status_label end,
        false);
    end if;
    if status_label in ('awaiting_proof','pending','awaiting','unpaid') then
      insert into public.notifications(customer_id,title,message,is_read)
      values(null,'تحديث دفعة معلقة','العميل: '||customer_name||E'\nالمبلغ: '||coalesce(new.amount::text,'0')||' جنيه'||E'\nطريقة الدفع: '||method_label||E'\nحالة الدفع: '||status_label,false);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_booking_payment_status on public.booking_requests;
create trigger notify_booking_payment_status
after insert or update of payment_status on public.booking_requests
for each row execute function public.notify_booking_payment_status();

revoke execute on function public.notify_booking_payment_status() from public, anon, authenticated;

alter publication supabase_realtime add table public.payments;
notify pgrst, 'reload schema';
