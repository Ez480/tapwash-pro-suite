alter table public.profiles add column if not exists first_location_saved_at timestamptz;
alter table public.subscription_requests add column if not exists service_address text;
alter table public.subscription_requests add column if not exists service_location_url text;
alter table public.subscription_requests add column if not exists service_latitude numeric;
alter table public.subscription_requests add column if not exists service_longitude numeric;
alter table public.subscriptions add column if not exists service_address text;
alter table public.subscriptions add column if not exists service_location_url text;
alter table public.subscriptions add column if not exists service_latitude numeric;
alter table public.subscriptions add column if not exists service_longitude numeric;

create or replace function public.populate_subscription_service_location()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.service_address is null and new.service_location_url is null and nullif(trim(coalesce(new.notes, '')), '') is not null then
    new.service_address := nullif(trim(split_part(new.notes, ' | ', 1)), '');
    new.service_location_url := nullif(trim(split_part(new.notes, ' | ', 2)), '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_populate_subscription_service_location on public.subscription_requests;
create trigger trg_populate_subscription_service_location
before insert on public.subscription_requests
for each row execute function public.populate_subscription_service_location();

create or replace function public.capture_first_customer_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is null then return new; end if;
  if nullif(trim(coalesce(new.address, '')), '') is null and nullif(trim(coalesce(new.location_url, '')), '') is null then return new; end if;
  update public.profiles
     set address_text = case when first_location_saved_at is null then nullif(trim(coalesce(new.address, '')), '') else address_text end,
         location_url = case when first_location_saved_at is null then nullif(trim(coalesce(new.location_url, '')), '') else location_url end,
         first_location_saved_at = case when first_location_saved_at is null then now() else first_location_saved_at end
   where id = new.customer_id and first_location_saved_at is null;
  return new;
end;
$$;

drop trigger if exists trg_capture_first_customer_location on public.booking_requests;
create trigger trg_capture_first_customer_location
after insert on public.booking_requests
for each row execute function public.capture_first_customer_location();

create or replace function public.capture_first_subscription_customer_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is null then return new; end if;
  if nullif(trim(coalesce(new.service_address, '')), '') is null and nullif(trim(coalesce(new.service_location_url, '')), '') is null then return new; end if;
  update public.profiles
     set address_text = case when first_location_saved_at is null then nullif(trim(coalesce(new.service_address, '')), '') else address_text end,
         location_url = case when first_location_saved_at is null then nullif(trim(coalesce(new.service_location_url, '')), '') else location_url end,
         latitude = case when first_location_saved_at is null then new.service_latitude else latitude end,
         longitude = case when first_location_saved_at is null then new.service_longitude else longitude end,
         first_location_saved_at = case when first_location_saved_at is null then now() else first_location_saved_at end
   where id = new.customer_id and first_location_saved_at is null;
  return new;
end;
$$;

drop trigger if exists trg_capture_first_subscription_customer_location on public.subscription_requests;
create trigger trg_capture_first_subscription_customer_location
after insert on public.subscription_requests
for each row execute function public.capture_first_subscription_customer_location();

create or replace function public.copy_subscription_service_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r public.subscription_requests%rowtype;
begin
  if new.request_id is null then return new; end if;
  select * into r from public.subscription_requests where id = new.request_id;
  if found then
    new.service_address := coalesce(new.service_address, r.service_address);
    new.service_location_url := coalesce(new.service_location_url, r.service_location_url);
    new.service_latitude := coalesce(new.service_latitude, r.service_latitude);
    new.service_longitude := coalesce(new.service_longitude, r.service_longitude);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_copy_subscription_service_location on public.subscriptions;
create trigger trg_copy_subscription_service_location
before insert on public.subscriptions
for each row execute function public.copy_subscription_service_location();

grant execute on function public.populate_subscription_service_location() to authenticated;
grant execute on function public.capture_first_customer_location() to authenticated;
grant execute on function public.capture_first_subscription_customer_location() to authenticated;
grant execute on function public.copy_subscription_service_location() to authenticated;
