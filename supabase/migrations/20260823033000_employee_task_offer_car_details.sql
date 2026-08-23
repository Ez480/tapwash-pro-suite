alter table public.employee_tasks
  add column if not exists car_brand text,
  add column if not exists car_model text,
  add column if not exists car_color text,
  add column if not exists plate_number text;

create index if not exists employee_tasks_customer_id_idx
  on public.employee_tasks (customer_id);