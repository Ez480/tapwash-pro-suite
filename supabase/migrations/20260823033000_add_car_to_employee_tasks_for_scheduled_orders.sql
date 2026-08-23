alter table public.employee_tasks
  add column if not exists car_id uuid references public.cars(id) on delete set null;

create index if not exists employee_tasks_scheduled_at_idx
  on public.employee_tasks (scheduled_at);

create index if not exists employee_tasks_car_id_idx
  on public.employee_tasks (car_id);
