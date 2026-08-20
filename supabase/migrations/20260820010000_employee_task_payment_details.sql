alter table public.employee_tasks
  add column if not exists payment_method text,
  add column if not exists payment_status text;

comment on column public.employee_tasks.payment_method is 'Payment method copied from the customer booking so the assigned employee can see how the order will be paid.';
comment on column public.employee_tasks.payment_status is 'Payment status copied from the customer booking.';
