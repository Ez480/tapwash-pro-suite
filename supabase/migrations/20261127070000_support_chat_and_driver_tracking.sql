-- TapWash support chat, employee presence, and delivery status audit.
-- Additive migration only: new tables, indexes, policies, bucket, and realtime publication entries.

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('employee', 'admin')),
  body text not null default '',
  attachment_path text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint support_messages_body_or_attachment check (length(btrim(body)) > 0 or attachment_path is not null)
);

create index if not exists support_messages_employee_created_idx
  on public.support_messages(employee_id, created_at asc);
create index if not exists support_messages_employee_unread_idx
  on public.support_messages(employee_id, sender_role, read_at)
  where read_at is null;

alter table public.support_messages enable row level security;
grant select, insert, update on public.support_messages to authenticated;

drop policy if exists support_messages_admin_select on public.support_messages;

create policy support_messages_admin_select
  on public.support_messages for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'::app_role));

drop policy if exists support_messages_admin_insert on public.support_messages;

create policy support_messages_admin_insert
  on public.support_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and sender_role = 'admin'
    and public.has_role((select auth.uid()), 'admin'::app_role)
  );

drop policy if exists support_messages_admin_update on public.support_messages;

create policy support_messages_admin_update
  on public.support_messages for update to authenticated
  using (public.has_role((select auth.uid()), 'admin'::app_role))
  with check (public.has_role((select auth.uid()), 'admin'::app_role));

drop policy if exists support_messages_employee_select on public.support_messages;

create policy support_messages_employee_select
  on public.support_messages for select to authenticated
  using (
    employee_id = (select auth.uid())
    and public.has_role((select auth.uid()), 'employee'::app_role)
  );

drop policy if exists support_messages_employee_insert on public.support_messages;

create policy support_messages_employee_insert
  on public.support_messages for insert to authenticated
  with check (
    employee_id = (select auth.uid())
    and sender_id = (select auth.uid())
    and sender_role = 'employee'
    and public.has_role((select auth.uid()), 'employee'::app_role)
  );

create table if not exists public.employee_presence (
  employee_id uuid primary key references public.profiles(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  is_online boolean not null default false,
  active_task_id uuid references public.employee_tasks(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists employee_presence_online_updated_idx
  on public.employee_presence(is_online, updated_at desc);
create index if not exists employee_presence_active_task_idx
  on public.employee_presence(active_task_id)
  where active_task_id is not null;

alter table public.employee_presence enable row level security;
grant select, insert, update on public.employee_presence to authenticated;

drop policy if exists employee_presence_admin_select on public.employee_presence;

create policy employee_presence_admin_select
  on public.employee_presence for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'::app_role));

drop policy if exists employee_presence_employee_select on public.employee_presence;

create policy employee_presence_employee_select
  on public.employee_presence for select to authenticated
  using (
    employee_id = (select auth.uid())
    and public.has_role((select auth.uid()), 'employee'::app_role)
  );

drop policy if exists employee_presence_employee_insert on public.employee_presence;

create policy employee_presence_employee_insert
  on public.employee_presence for insert to authenticated
  with check (
    employee_id = (select auth.uid())
    and public.has_role((select auth.uid()), 'employee'::app_role)
  );

drop policy if exists employee_presence_employee_update on public.employee_presence;

create policy employee_presence_employee_update
  on public.employee_presence for update to authenticated
  using (
    employee_id = (select auth.uid())
    and public.has_role((select auth.uid()), 'employee'::app_role)
  )
  with check (
    employee_id = (select auth.uid())
    and public.has_role((select auth.uid()), 'employee'::app_role)
  );

create table if not exists public.delivery_status_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.employee_tasks(id) on delete cascade,
  previous_status text not null,
  new_status text not null check (new_status in ('picked_up', 'on_the_way', 'delivered', 'cancelled')),
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now()
);

create index if not exists delivery_status_logs_task_changed_idx
  on public.delivery_status_logs(task_id, changed_at desc);

alter table public.delivery_status_logs enable row level security;
grant select, insert on public.delivery_status_logs to authenticated;

drop policy if exists delivery_status_logs_admin_select on public.delivery_status_logs;

create policy delivery_status_logs_admin_select
  on public.delivery_status_logs for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'::app_role));

drop policy if exists delivery_status_logs_admin_insert on public.delivery_status_logs;

create policy delivery_status_logs_admin_insert
  on public.delivery_status_logs for insert to authenticated
  with check (
    changed_by = (select auth.uid())
    and public.has_role((select auth.uid()), 'admin'::app_role)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-media', 'support-media', false, 5242880, array['image/*'])
on conflict (id) do nothing;

drop policy if exists support_media_admin_read on storage.objects;

create policy support_media_admin_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'support-media'
    and public.has_role((select auth.uid()), 'admin'::app_role)
  );

drop policy if exists support_media_employee_read_own on storage.objects;

create policy support_media_employee_read_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'support-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and public.has_role((select auth.uid()), 'employee'::app_role)
  );

drop policy if exists support_media_admin_insert on storage.objects;

create policy support_media_admin_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'support-media'
    and public.has_role((select auth.uid()), 'admin'::app_role)
  );

drop policy if exists support_media_employee_insert_own on storage.objects;

create policy support_media_employee_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'support-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and public.has_role((select auth.uid()), 'employee'::app_role)
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table public.support_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'employee_presence'
  ) then
    alter publication supabase_realtime add table public.employee_presence;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'delivery_status_logs'
  ) then
    alter publication supabase_realtime add table public.delivery_status_logs;
  end if;
end $$;
