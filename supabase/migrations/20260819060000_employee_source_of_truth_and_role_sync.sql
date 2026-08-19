-- Employee management hardening.
-- The public.employees row is the manager's source of truth. Auth/profile/role
-- records are synchronized automatically so employee creation and edits cannot
-- leave the employee dashboard disconnected.

create unique index if not exists user_roles_user_role_unique
  on public.user_roles (user_id, role);

create unique index if not exists employees_employee_id_unique
  on public.employees (employee_id)
  where employee_id is not null and btrim(employee_id) <> '';

create unique index if not exists employees_email_unique
  on public.employees (lower(email))
  where email is not null and btrim(email) <> '';

create unique index if not exists employees_user_id_unique
  on public.employees (user_id)
  where user_id is not null;

create or replace function public.sync_employee_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_user_id uuid;
begin
  resolved_user_id := new.user_id;

  if tg_op = 'UPDATE' and new.email is distinct from old.email then
    resolved_user_id := null;
    if new.email is not null then
      select u.id into resolved_user_id
      from auth.users u
      where lower(u.email) = lower(new.email)
      limit 1;
    end if;
  end if;

  if resolved_user_id is null and new.email is not null then
    select u.id into resolved_user_id
    from auth.users u
    where lower(u.email) = lower(new.email)
    limit 1;
  end if;

  new.user_id := resolved_user_id;

  if new.user_id is not null then
    insert into public.profiles (id, full_name, email, phone, role, status, updated_at)
    values (
      new.user_id,
      coalesce(new.full_name, ''),
      new.email,
      new.phone,
      'employee',
      case when new.status::text = 'active' then 'active'::customer_status else 'suspended'::customer_status end,
      now()
    )
    on conflict (id) do update set
      full_name = excluded.full_name,
      email = excluded.email,
      phone = excluded.phone,
      role = 'employee',
      status = excluded.status,
      updated_at = now();

    insert into public.user_roles (user_id, role)
    values (new.user_id, 'employee'::app_role)
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.remove_employee_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.user_id is not null then
    delete from public.user_roles
    where user_id = old.user_id and role = 'employee'::app_role;

    if not exists (select 1 from public.user_roles where user_id = old.user_id) then
      update public.profiles
      set role = 'customer', updated_at = now()
      where id = old.user_id;
    end if;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_link_employee_user on public.employees;
drop trigger if exists trg_sync_employee_to_profile on public.employees;
drop trigger if exists trg_sync_employee_identity on public.employees;
drop trigger if exists trg_remove_employee_identity on public.employees;

create trigger trg_sync_employee_identity
before insert or update of user_id, email, full_name, phone, status on public.employees
for each row execute function public.sync_employee_identity();

create trigger trg_remove_employee_identity
after delete on public.employees
for each row execute function public.remove_employee_identity();

update public.employees e
set user_id = coalesce(
  (select u.id from auth.users u where lower(u.email) = lower(e.email) limit 1),
  e.user_id
);

insert into public.user_roles (user_id, role)
select e.user_id, 'employee'::app_role
from public.employees e
where e.user_id is not null
on conflict (user_id, role) do nothing;

update public.profiles p
set role = 'employee', updated_at = now()
where exists (select 1 from public.employees e where e.user_id = p.id);

drop policy if exists employees_admin_all on public.employees;
create policy employees_admin_all
on public.employees
for all
using (public.has_role(auth.uid(), 'admin'::app_role))
with check (public.has_role(auth.uid(), 'admin'::app_role));
