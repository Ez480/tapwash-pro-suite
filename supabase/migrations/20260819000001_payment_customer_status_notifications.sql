-- Send payment-status notifications to the correct audience.
-- Admin notifications use customer_id = null; customer notifications use the payment's customer_id.

create or replace function public.notify_payment_status_audiences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_name text;
  customer_phone text;
  status_label text;
  customer_title text;
  customer_message text;
begin
  select p.full_name, p.phone
    into customer_name, customer_phone
    from public.profiles p
   where p.id = new.customer_id;

  if tg_op = 'INSERT' then
    status_label := coalesce(new.status, 'pending');

    if status_label in ('pending', 'awaiting', 'unpaid') then
      insert into public.notifications (customer_id, title, message, is_read)
      values (
        null,
        'دفعة جديدة معلقة',
        'يوجد دفع جديد يحتاج مراجعة.' || E'\n'
        || 'العميل: ' || coalesce(customer_name, 'غير معروف') || E'\n'
        || 'الهاتف: ' || coalesce(customer_phone, 'غير مسجل') || E'\n'
        || 'المبلغ: ' || coalesce(new.amount::text, '0') || ' جنيه' || E'\n'
        || 'طريقة الدفع: ' || coalesce(new.method, 'غير محددة')
        || case when new.reference is not null then E'\nالمرجع: ' || new.reference else '' end,
        false
      );
    end if;

    if new.customer_id is not null then
      customer_title := case status_label
        when 'paid' then 'تم تأكيد الدفع'
        when 'cancelled' then 'لم يتم تأكيد الدفع'
        when 'pending' then 'تم استلام طلب الدفع'
        when 'awaiting' then 'الدفع قيد المراجعة'
        when 'unpaid' then 'الدفع غير مكتمل'
        else 'تحديث حالة الدفع'
      end;

      customer_message := case status_label
        when 'paid' then 'تم تأكيد دفعتك بنجاح، وتم اعتماد الاشتراك المرتبط بها. [payment:' || new.id::text || ']'
        when 'cancelled' then 'لم يتم تأكيد دفعتك. يمكنك التواصل مع الإدارة أو إعادة المحاولة. [payment:' || new.id::text || ']'
        when 'pending' then 'تم استلام بيانات الدفع الخاصة بك، وسيتم مراجعتها من الإدارة. [payment:' || new.id::text || ']'
        when 'awaiting' then 'تم استلام بيانات الدفع الخاصة بك والدفع الآن قيد المراجعة. [payment:' || new.id::text || ']'
        when 'unpaid' then 'الدفع لم يتم تأكيده بعد. [payment:' || new.id::text || ']'
        else 'تم تحديث حالة دفعتك إلى: ' || status_label || '. [payment:' || new.id::text || ']'
      end;

      insert into public.notifications (customer_id, title, message, is_read)
      values (new.customer_id, customer_title, customer_message, false);
    end if;

    return new;
  end if;

  if new.status is distinct from old.status then
    status_label := coalesce(new.status, 'unknown');

    if new.customer_id is not null then
      customer_title := case status_label
        when 'paid' then 'تم تأكيد الدفع'
        when 'cancelled' then 'لم يتم تأكيد الدفع'
        when 'pending' then 'تم تعليق الدفع'
        when 'awaiting' then 'الدفع قيد المراجعة'
        when 'unpaid' then 'الدفع غير مكتمل'
        else 'تحديث حالة الدفع'
      end;

      customer_message := case status_label
        when 'paid' then 'تم تأكيد دفعتك بنجاح، وتم اعتماد الاشتراك المرتبط بها. [payment:' || new.id::text || ']'
        when 'cancelled' then 'لم يتم تأكيد دفعتك. يمكنك التواصل مع الإدارة أو إعادة المحاولة. [payment:' || new.id::text || ']'
        when 'pending' then 'تم وضع دفعتك في حالة انتظار المراجعة. [payment:' || new.id::text || ']'
        when 'awaiting' then 'تم استلام بيانات الدفع والدفع الآن قيد المراجعة. [payment:' || new.id::text || ']'
        when 'unpaid' then 'الدفع لم يتم تأكيده بعد. [payment:' || new.id::text || ']'
        else 'تم تحديث حالة دفعتك إلى: ' || status_label || '. [payment:' || new.id::text || ']'
      end;

      insert into public.notifications (customer_id, title, message, is_read)
      values (new.customer_id, customer_title, customer_message, false);
    end if;

    if status_label in ('pending', 'awaiting', 'unpaid') then
      insert into public.notifications (customer_id, title, message, is_read)
      values (
        null,
        'تحديث دفعة معلقة',
        'تم تغيير حالة دفعة العميل ' || coalesce(customer_name, 'غير معروف') ||
        ' إلى: ' || status_label || E'\n'
        || 'المبلغ: ' || coalesce(new.amount::text, '0') || ' جنيه' || E'\n'
        || 'طريقة الدفع: ' || coalesce(new.method, 'غير محددة')
        || case when new.reference is not null then E'\nالمرجع: ' || new.reference else '' end,
        false
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists notify_admins_payment on public.payments;
drop trigger if exists notify_admins_payment_status on public.payments;
create trigger notify_payment_status_audiences
after insert or update of status on public.payments
for each row execute function public.notify_payment_status_audiences();

revoke execute on function public.notify_payment_status_audiences() from public, anon, authenticated;

notify pgrst, 'reload schema';
