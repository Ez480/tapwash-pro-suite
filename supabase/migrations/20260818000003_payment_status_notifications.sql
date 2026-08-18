-- Notify the admin notification stream whenever a payment changes state.
create or replace function public.notify_admins_on_payment_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status_label text;
begin
  if tg_op = 'INSERT' then
    status_label := coalesce(new.status, 'pending');
  elsif new.status is distinct from old.status then
    status_label := coalesce(new.status, 'unknown');
  else
    return new;
  end if;

  insert into public.notifications (customer_id, title, message, is_read)
  values (
    null,
    case status_label
      when 'paid' then 'تم تأكيد دفعة'
      when 'cancelled' then 'تم إلغاء دفعة'
      when 'pending' then 'دفعة معلقة'
      when 'awaiting' then 'دفعة في انتظار المراجعة'
      when 'unpaid' then 'دفعة غير مدفوعة'
      else 'تحديث حالة الدفع'
    end,
    'الدفعة ' || coalesce(new.id::text, '') || ' — الحالة: ' || status_label ||
      ' — المبلغ: ' || coalesce(new.amount::text, '0') || ' جنيه' ||
      case when new.reference is not null then ' — المرجع: ' || new.reference else '' end,
    false
  );

  return new;
end;
$$;

drop trigger if exists notify_admins_payment_status on public.payments;
create trigger notify_admins_payment_status
after insert or update of status on public.payments
for each row execute function public.notify_admins_on_payment_status_change();

notify pgrst, 'reload schema';
