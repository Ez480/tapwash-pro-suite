-- Employee ID is the human-facing identifier. The database UUID remains employees.id.
-- Generate the next Employee ID as soon as an admin selects an email.

create or replace function public.admin_next_employee_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only admins can generate employee IDs';
  end if;
  select coalesce(max(nullif(regexp_replace(employee_id, '[^0-9]', '', 'g'), '')::integer), 0) + 1
    into n
  from public.employees
  where employee_id ~ '^EMP[0-9]+$';
  return 'EMP' || lpad(n::text, 4, '0');
end;
$$;

grant execute on function public.admin_next_employee_id() to authenticated;

-- Keep the employee dashboard sourced from the employees table.
drop function if exists public.get_my_employee();
create function public.get_my_employee()
returns table (
  database_id uuid,
  employee_id text,
  birth_date date,
  qualification text,
  national_id text,
  job_title text,
  branch text,
  full_name text
)
language sql
security definer
set search_path = public
as $$
  select e.id, e.employee_id, e.birth_date, e.qualification, e.national_id,
         e.job_title, e.branch, e.full_name
  from public.employees e
  where e.user_id = auth.uid()
     or lower(coalesce(e.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by e.updated_at desc nulls last
  limit 1;
$$;

grant execute on function public.get_my_employee() to authenticated;
