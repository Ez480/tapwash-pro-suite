-- Pin privileged SECURITY DEFINER routines to an empty search_path. The
-- function bodies below use schema-qualified references throughout.
alter function public.admin_confirm_payment(uuid) set search_path to '';
alter function public.admin_delete_employee(uuid) set search_path to '';
alter function public.admin_list_employees() set search_path to '';
alter function public.admin_save_employee(uuid, text, text, date, text, text, text, text, text, text, text) set search_path to '';
alter function public.get_my_employee() set search_path to '';

create or replace function public.admin_upsert_employee(
  p_id uuid default null,
  p_employee_id text default null,
  p_national_id text default null,
  p_card_number text default null,
  p_full_name text default null,
  p_email text default null,
  p_phone text default null,
  p_job_title text default null,
  p_branch text default null,
  p_status text default 'active'
)
returns public.employees
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_employee public.employees;
  v_user_id uuid;
  v_status public.entity_status := coalesce(nullif(lower(trim(p_status)), ''), 'active')::public.entity_status;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Not authorized';
  end if;

  if nullif(trim(coalesce(p_email, '')), '') is not null then
    select u.id into v_user_id
    from auth.users u
    where lower(u.email) = lower(trim(p_email))
    order by u.created_at desc
    limit 1;
  end if;

  if p_id is null then
    insert into public.employees(
      employee_id, national_id, card_number, full_name, email, phone,
      job_title, branch, status, user_id
    )
    values (
      p_employee_id, p_national_id, p_card_number, p_full_name,
      p_email, p_phone, p_job_title, p_branch, v_status, v_user_id
    )
    returning * into v_employee;
  else
    update public.employees
    set employee_id = p_employee_id,
        national_id = p_national_id,
        card_number = p_card_number,
        full_name = p_full_name,
        email = p_email,
        phone = p_phone,
        job_title = p_job_title,
        branch = p_branch,
        status = v_status,
        user_id = coalesce(v_user_id, user_id)
    where id = p_id
    returning * into v_employee;

    if not found then raise exception 'Employee not found'; end if;
  end if;

  return v_employee;
end;
$function$;

create or replace function public.reassign_nfc_card(
  p_card_id uuid,
  p_new_customer_id uuid,
  p_new_car_id uuid default null
)
returns public.nfc_cards
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_card public.nfc_cards;
  v_existing uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.has_role(v_actor, 'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_new_customer_id and p.role = 'customer'
  ) then
    raise exception 'Invalid customer';
  end if;

  if p_new_car_id is not null and not exists (
    select 1 from public.cars c
    where c.id = p_new_car_id and c.customer_id = p_new_customer_id
  ) then
    raise exception 'Selected car does not belong to the new customer';
  end if;

  select c.* into v_card
  from public.nfc_cards c
  where c.id = p_card_id
  for update;

  if not found then raise exception 'NFC card not found'; end if;

  select c.id into v_existing
  from public.nfc_cards c
  where c.uid = v_card.uid and c.id <> v_card.id;

  if v_existing is not null then raise exception 'Duplicate NFC UID detected'; end if;

  insert into public.nfc_card_assignment_history(
    card_id, uid, previous_customer_id, new_customer_id,
    previous_car_id, new_car_id, changed_by
  )
  values (
    v_card.id, v_card.uid, v_card.customer_id, p_new_customer_id,
    v_card.car_id, p_new_car_id, v_actor
  );

  update public.nfc_cards
  set customer_id = p_new_customer_id,
      car_id = p_new_car_id,
      status = 'assigned',
      activation_date = coalesce(activation_date, now()),
      updated_at = now()
  where id = p_card_id
  returning * into v_card;

  return v_card;
end;
$function$;

notify pgrst, 'reload schema';
