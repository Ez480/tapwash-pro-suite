-- Keep employee_tasks in sync with the booking-assignment workflow used by the admin UI.
-- The original employee_tasks table predates booking_request linkage and assignment metadata.

alter table public.employee_tasks
  add column if not exists serial_number text,
  add column if not exists booking_request_id uuid references public.booking_requests(id) on delete set null,
  add column if not exists collection_amount numeric default 0,
  add column if not exists location_url text;

create index if not exists employee_tasks_booking_request_idx
  on public.employee_tasks(booking_request_id);

create unique index if not exists employee_tasks_serial_number_idx
  on public.employee_tasks(serial_number)
  where serial_number is not null;

notify pgrst, 'reload schema';
