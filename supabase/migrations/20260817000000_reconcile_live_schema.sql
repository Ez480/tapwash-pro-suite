-- Production schema reconciliation: aligns the legacy live schema with the current app schema.
-- Existing profile/customer data is preserved; legacy customers and compatibility columns remain.

create type public.app_role as enum ('admin','employee','customer');
create type public.card_status as enum ('available','assigned','blocked');
create type public.card_type as enum ('card','sticker','keychain');
create type public.customer_status as enum ('active','suspended');
create type public.entity_status as enum ('active','inactive');
create type public.subscription_status as enum ('active','expired','cancelled','pending');

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists status public.customer_status default 'active';
alter table public.profiles add column if not exists language text default 'ar';
alter table public.profiles add column if not exists notes text;
alter table public.profiles add column if not exists updated_at timestamptz default now();
update public.profiles set email=coalesce(email,(select email from auth.users where id=profiles.id)),status=coalesce(status,'active'::public.customer_status),language=coalesce(language,'ar'),updated_at=coalesce(updated_at,created_at);
alter table public.profiles alter column full_name set default '';
alter table public.profiles alter column full_name set not null;

alter table public.packages rename column name to title_en;
alter table public.packages rename column description to description_en;
alter table public.packages rename column washes to washes_count;
alter table public.packages add column title_ar text;
alter table public.packages add column description_ar text;
alter table public.packages add column features_en text[] not null default '{}';
alter table public.packages add column features_ar text[] not null default '{}';
alter table public.packages add column sort_order integer not null default 0;
alter table public.packages add column status public.entity_status not null default 'active';
alter table public.packages add column image_url text;
alter table public.packages add column updated_at timestamptz not null default now();
update public.packages set title_ar=coalesce(title_ar,title_en),description_ar=coalesce(description_ar,description_en);
alter table public.packages alter column title_en set not null;
alter table public.packages alter column title_ar set not null;
alter table public.packages alter column price set default 0;
alter table public.packages alter column price set not null;
alter table public.packages alter column duration_days set default 30;
alter table public.packages alter column duration_days set not null;
alter table public.packages alter column washes_count set default 0;
alter table public.packages alter column washes_count set not null;

alter table public.offers rename column title to title_en;
alter table public.offers rename column description to description_en;
alter table public.offers rename column price to new_price;
alter table public.offers rename column image to image_url;
alter table public.offers rename column active to _legacy_active;
alter table public.offers add column title_ar text;
alter table public.offers add column description_ar text;
alter table public.offers add column old_price numeric;
alter table public.offers add column start_date timestamptz not null default now();
alter table public.offers add column end_date timestamptz;
alter table public.offers add column status public.entity_status not null default 'active';
alter table public.offers add column updated_at timestamptz not null default now();
update public.offers set title_ar=coalesce(title_ar,title_en),description_ar=coalesce(description_ar,description_en),status=case when _legacy_active then 'active'::public.entity_status else 'inactive'::public.entity_status end;
alter table public.offers alter column title_en set not null;
alter table public.offers alter column title_ar set not null;

alter table public.nfc_cards add column serial_number text;
alter table public.nfc_cards add column card_type public.card_type not null default 'card';
alter table public.nfc_cards add column activation_date timestamptz;
alter table public.nfc_cards add column updated_at timestamptz not null default now();
update public.nfc_cards set serial_number=coalesce(serial_number,uid);
alter table public.nfc_cards alter column serial_number set not null;
alter table public.nfc_cards alter column status drop default;
alter table public.nfc_cards alter column status type public.card_status using case when status in ('available','assigned','blocked') then status::public.card_status else 'available'::public.card_status end;
alter table public.nfc_cards alter column status set default 'available';

alter table public.subscriptions rename column remaining_washes to total_washes;
alter table public.subscriptions add column updated_at timestamptz not null default now();
alter table public.subscriptions alter column customer_id set not null;
alter table public.subscriptions alter column start_date set default current_date;
alter table public.subscriptions alter column start_date set not null;
alter table public.subscriptions alter column end_date set default (current_date+30);
alter table public.subscriptions alter column end_date set not null;
alter table public.subscriptions alter column total_washes set default 0;
alter table public.subscriptions alter column total_washes set not null;
alter table public.subscriptions alter column used_washes set default 0;
alter table public.subscriptions alter column used_washes set not null;
alter table public.subscriptions alter column status drop default;
alter table public.subscriptions alter column status type public.subscription_status using case when status in ('active','expired','cancelled','pending') then status::public.subscription_status else 'active'::public.subscription_status end;
alter table public.subscriptions alter column status set default 'active';

alter table public.washes rename column notes to note;
alter table public.washes alter column customer_id set not null;
alter table public.site_pages add column blocks jsonb not null default '[]';
alter table public.site_pages add column status public.entity_status not null default 'active';
alter table public.site_pages add column updated_at timestamptz not null default now();
alter table public.site_pages alter column title_en set not null;
alter table public.site_pages alter column title_ar set not null;

alter table public.site_settings rename column company_name to company_name_en;
alter table public.site_settings rename column logo to logo_url;
alter table public.site_settings rename column address to address_en;
alter table public.site_settings add column company_name_ar text not null default 'El.EZZ CAR WASH';
alter table public.site_settings add column address_ar text;
alter table public.site_settings add column facebook_url text;
alter table public.site_settings add column instagram_url text;
alter table public.site_settings add column tiktok_url text;
alter table public.site_settings add column primary_color text not null default '#2563eb';
alter table public.site_settings add column secondary_color text not null default '#0f172a';
alter table public.site_settings add column updated_at timestamptz not null default now();
insert into public.site_settings(id,company_name_en,company_name_ar) values(1,'El.EZZ CAR WASH','El.EZZ CAR WASH') on conflict(id) do nothing;

create table if not exists public.employees(id uuid primary key default gen_random_uuid(),full_name text not null,email text,phone text,job_title text,branch text,status public.entity_status not null default 'active',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.payments(id uuid primary key default gen_random_uuid(),customer_id uuid not null references public.profiles(id) on delete cascade,subscription_id uuid references public.subscriptions(id) on delete set null,amount numeric not null default 0,method text not null default 'cash',reference text,status text not null default 'paid',paid_at timestamptz not null default now(),created_at timestamptz not null default now());

-- Replace ambiguous legacy customer relationships with one profile relationship per field.
alter table public.nfc_cards drop constraint if exists nfc_cards_customer_fk;
alter table public.nfc_cards drop constraint if exists nfc_cards_customer_id_fkey;
alter table public.nfc_cards drop constraint if exists nfc_cards_car_fk;
alter table public.nfc_cards drop constraint if exists nfc_cards_car_id_fkey;
alter table public.subscriptions drop constraint if exists subscriptions_customer_fk;
alter table public.subscriptions drop constraint if exists subscriptions_customer_id_fkey;
alter table public.subscriptions drop constraint if exists subscriptions_car_fk;
alter table public.subscriptions drop constraint if exists subscriptions_car_id_fkey;
alter table public.subscriptions drop constraint if exists subscriptions_package_fk;
alter table public.subscriptions drop constraint if exists subscriptions_package_id_fkey;
alter table public.cars drop constraint if exists cars_customer_id_fkey;
alter table public.washes drop constraint if exists washes_customer_fk;
alter table public.washes drop constraint if exists washes_customer_id_fkey;
alter table public.washes drop constraint if exists washes_car_fk;
alter table public.washes drop constraint if exists washes_car_id_fkey;
alter table public.washes drop constraint if exists washes_subscription_fk;
alter table public.washes drop constraint if exists washes_subscription_id_fkey;
alter table public.notifications drop constraint if exists notifications_customer_id_fkey;
alter table public.cars add constraint cars_customer_id_fkey foreign key(customer_id) references public.profiles(id) on delete cascade;
alter table public.nfc_cards add constraint nfc_cards_customer_id_fkey foreign key(customer_id) references public.profiles(id) on delete set null;
alter table public.nfc_cards add constraint nfc_cards_car_id_fkey foreign key(car_id) references public.cars(id) on delete set null;
alter table public.subscriptions add constraint subscriptions_customer_id_fkey foreign key(customer_id) references public.profiles(id) on delete cascade;
alter table public.subscriptions add constraint subscriptions_car_id_fkey foreign key(car_id) references public.cars(id) on delete set null;
alter table public.subscriptions add constraint subscriptions_package_id_fkey foreign key(package_id) references public.packages(id) on delete set null;
alter table public.washes add constraint washes_customer_id_fkey foreign key(customer_id) references public.profiles(id) on delete cascade;
alter table public.washes add constraint washes_subscription_id_fkey foreign key(subscription_id) references public.subscriptions(id) on delete set null;
alter table public.washes add constraint washes_car_id_fkey foreign key(car_id) references public.cars(id) on delete set null;
alter table public.notifications add constraint notifications_customer_id_fkey foreign key(customer_id) references public.profiles(id) on delete cascade;

alter table public.user_roles alter column role drop default;
alter table public.user_roles alter column role type public.app_role using role::public.app_role;
alter table public.user_roles alter column role set default 'customer';
alter table public.user_roles alter column role set not null;
alter table public.user_roles add constraint user_roles_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
create unique index if not exists user_roles_user_role_uidx on public.user_roles(user_id,role);

create or replace function public.has_role(_user_id uuid,_role public.app_role) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role); $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin
insert into public.profiles(id,full_name,email,phone,status,language) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),coalesce(split_part(new.email,'@',1),'New Customer')),new.email,nullif(new.raw_user_meta_data->>'phone',''),'active','ar') on conflict(id) do update set email=excluded.email;
insert into public.user_roles(user_id,role) values(new.id,'customer') on conflict(user_id,role) do nothing;
insert into public.customers(id,full_name,phone,email,status) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),coalesce(split_part(new.email,'@',1),'New Customer')),nullif(new.raw_user_meta_data->>'phone',''),new.email,'active') on conflict(id) do update set full_name=excluded.full_name,email=excluded.email,phone=excluded.phone,status=excluded.status;
return new; end; $$;

notify pgrst,'reload schema';
