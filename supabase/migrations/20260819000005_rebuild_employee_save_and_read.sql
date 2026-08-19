-- Rebuild employee save/read flow.
-- The employee dashboard uses Employee ID, Card Number and Job Title.
-- National ID remains stored for compatibility but is optional.

create or replace function public.admin_save_employee(
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
set search_path = public
as $$
declare
  result public.employees;
  v_user_id uuid;
  v_status public.entity_status;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only admins can manage employees';
  end if;

  if nullif(trim(coalesce(p_employee_id, '')), '') is null then
    raise exception 'Employee ID is required';
  end if;

  if nullif(trim(coalesce(p_card_number, '')), '') is null then
    raise exception 'Card number is required';
  end if;

  if nullif(trim(coalesce(p_full_name, '')), '') is null then
    raise exception 'Full name is required';
  end if;

  v_status := coalesce(nullif(lower(trim(p_status)), ''), 'active')::public.entity_status;

  if nullif(trim(coalesce(p_email, '')), '') is not null then
    select u.id into v_user_id
    from auth.users u
    where lower(u.email) = lower(trim(p_email))
    order by u.created_at desc
    limit 1;
  end if;

  if p_id is null then
    insert into public.employees (
      employee_id, national_id, card_number, full_name, email, phone,
      job_title, branch, status, user_id, updated_at
    ) values (
      trim(p_employee_id),
      nullif(trim(coalesce(p_national_id, '')), ''),
      trim(p_card_number),
      trim(p_full_name),
      nullif(lower(trim(coalesce(p_email, ''))), ''),
      nullif(trim(coalesce(p_phone, '')), ''),
      nullif(trim(coalesce(p_job_title, '')), ''),
      nullif(trim(coalesce(p_branch, '')), ''),
      v_status,
      v_user_id,
      now()
    ) returning * into result;
  else
    update public.employees
    set employee_id = trim(p_employee_id),
        national_id = nullif(trim(coalesce(p_national_id, '')), ''),
        card_number = trim(p_card_number),
        full_name = trim(p_full_name),
        email = nullif(lower(trim(coalesce(p_email, ''))), ''),
        phone = nullif(trim(coalesce(p_phone, '')), ''),
        job_title = nullif(trim(coalesce(p_job_title, '')), ''),
        branch = nullif(trim(coalesce(p_branch, '')), ''),
        status = v_status,
        user_id = coalesce(v_user_id, user_id),
        updated_at = now()
    where id = p_id
    returning * into result;

    if not found then
      raise exception 'Employee not found';
    end if;
  end if;

  if result.user_id is not null then
    insert into public.user_roles(user_id, role)
    values(result.user_id, 'employee'::public.app_role)
    on conflict(user_id, role) do nothing;

    update public.profiles
    set full_name = result.full_name,
        email = result.email,
        phone = result.phone,
        role = 'employee',
        updated_at = now()
    where id = result.user_id;
  end if;

  return result;
end;
$$;

grant execute on function public.admin_save_employee(uuid,text,text,text,text,text,text,text,text,text) to authenticated;

-- The previous function had a different RETURNS TABLE signature, so it must be
-- dropped before recreating it with the same six fields used by the dashboard.
drop function if exists public.get_my_employee();

create function public.get_my_employee()
returns table (
  employee_id text,
  national_id text,
  card_number text,
  job_title text,
  branch text,
  full_name text
)
language sql
security definer
set search_path = public
as $$
  select
    e.employee_id::text,
    e.national_id::text,
    e.card_number::text,
    e.job_title::text,
    e.branch::text,
    e.full_name::text
  from public.employees e
  where e.user_id = auth.uid()
     or lower(coalesce(e.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by e.updated_at desc nulls last
  limit 1;
$$;

grant execute on function public.get_my_employee() to authenticated;
