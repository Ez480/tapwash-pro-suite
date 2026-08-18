alter table public.employee_tasks add column if not exists delivery_status text not null default 'not_started';
alter table public.employee_tasks drop constraint if exists employee_tasks_delivery_status_check;
alter table public.employee_tasks add constraint employee_tasks_delivery_status_check check (delivery_status in ('not_started','picked_up','on_the_way','delivered','cancelled'));

create table if not exists public.order_photos (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.employee_tasks(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('before','after')),
  path text not null,
  url text not null,
  created_at timestamptz not null default now()
);
create index if not exists order_photos_task_id_created_at_idx on public.order_photos(task_id, created_at desc);
create index if not exists order_photos_uploaded_by_idx on public.order_photos(uploaded_by);
alter table public.order_photos enable row level security;

drop policy if exists "order_photos_admin_select" on public.order_photos;
drop policy if exists "order_photos_employee_select" on public.order_photos;
drop policy if exists "order_photos_customer_select" on public.order_photos;
drop policy if exists "order_photos_employee_insert" on public.order_photos;
drop policy if exists "order_photos_admin_insert" on public.order_photos;
drop policy if exists "order_photos_owner_delete" on public.order_photos;
create policy "order_photos_admin_select" on public.order_photos for select to authenticated using (public.has_role((select auth.uid()), 'admin'::app_role));
create policy "order_photos_employee_select" on public.order_photos for select to authenticated using (public.has_role((select auth.uid()), 'employee'::app_role) and exists (select 1 from public.employee_tasks t where t.id = order_photos.task_id and t.employee_id = (select auth.uid())));
create policy "order_photos_customer_select" on public.order_photos for select to authenticated using (exists (select 1 from public.employee_tasks t where t.id = order_photos.task_id and t.customer_id = (select auth.uid())));
create policy "order_photos_employee_insert" on public.order_photos for insert to authenticated with check (uploaded_by = (select auth.uid()) and public.has_role((select auth.uid()), 'employee'::app_role) and exists (select 1 from public.employee_tasks t where t.id = order_photos.task_id and t.employee_id = (select auth.uid())));
create policy "order_photos_admin_insert" on public.order_photos for insert to authenticated with check (uploaded_by = (select auth.uid()) and public.has_role((select auth.uid()), 'admin'::app_role));
create policy "order_photos_owner_delete" on public.order_photos for delete to authenticated using (uploaded_by = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'::app_role));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tapwash-media', 'tapwash-media', true, 10485760, array['image/*'])
on conflict (id) do update set public = true, file_size_limit = 10485760, allowed_mime_types = array['image/*'];

drop policy if exists "tapwash_media_insert" on storage.objects;
drop policy if exists "tapwash_media_update" on storage.objects;
drop policy if exists "tapwash_media_delete" on storage.objects;
create policy "tapwash_media_insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'tapwash-media' and (
    ((storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = (select auth.uid()::text))
    or ((storage.foldername(name))[1] = 'catalog' and public.has_role((select auth.uid()), 'admin'::app_role))
    or ((storage.foldername(name))[1] = 'orders' and public.has_role((select auth.uid()), 'employee'::app_role) and exists (select 1 from public.employee_tasks t where t.id::text = (storage.foldername(name))[2] and t.employee_id = (select auth.uid())))
  )
);
create policy "tapwash_media_update" on storage.objects for update to authenticated using (bucket_id = 'tapwash-media' and (owner_id = (select auth.uid()::text) or public.has_role((select auth.uid()), 'admin'::app_role))) with check (bucket_id = 'tapwash-media');
create policy "tapwash_media_delete" on storage.objects for delete to authenticated using (bucket_id = 'tapwash-media' and (owner_id = (select auth.uid()::text) or public.has_role((select auth.uid()), 'admin'::app_role)));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON c.oid = pr.prrelid JOIN pg_publication p ON p.oid = pr.prpubid WHERE p.pubname = 'supabase_realtime' AND c.relname = 'employee_tasks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_tasks;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON c.oid = pr.prrelid JOIN pg_publication p ON p.oid = pr.prpubid WHERE p.pubname = 'supabase_realtime' AND c.relname = 'order_photos') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_photos;
  END IF;
END $$;
