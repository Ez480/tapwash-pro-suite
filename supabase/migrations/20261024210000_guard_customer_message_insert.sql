-- Keep public contact submissions anonymous unless a verified session owns them,
-- and bound field sizes to reduce spoofing and storage abuse.
create or replace function public.guard_customer_message_insert()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    new.customer_id := null;
  elsif new.customer_id is distinct from v_user then
    raise exception 'A signed-in user may only submit a message for their own account';
  end if;

  if nullif(trim(coalesce(new.customer_name, '')), '') is null then
    raise exception 'Name is required';
  end if;
  if nullif(trim(coalesce(new.message, '')), '') is null then
    raise exception 'Message is required';
  end if;
  if char_length(new.customer_name) > 200
     or char_length(coalesce(new.customer_email, '')) > 254
     or char_length(coalesce(new.customer_phone, '')) > 50
     or char_length(new.message) > 5000 then
    raise exception 'Contact message exceeds the allowed length';
  end if;

  new.customer_name := trim(new.customer_name);
  new.customer_email := nullif(trim(coalesce(new.customer_email, '')), '');
  new.customer_phone := nullif(trim(coalesce(new.customer_phone, '')), '');
  new.message := trim(new.message);
  new.is_read := false;
  new.created_at := now();

  return new;
end;
$function$;

drop trigger if exists trg_guard_customer_message_insert on public.customer_messages;
create trigger trg_guard_customer_message_insert
before insert on public.customer_messages
for each row execute function public.guard_customer_message_insert();

revoke execute on function public.guard_customer_message_insert() from public, anon, authenticated;

notify pgrst, 'reload schema';
