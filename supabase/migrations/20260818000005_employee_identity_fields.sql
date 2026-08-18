ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employee_code TEXT,
  ADD COLUMN IF NOT EXISTS card_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_code_unique
  ON public.employees (employee_code)
  WHERE employee_code IS NOT NULL AND employee_code <> '';

CREATE UNIQUE INDEX IF NOT EXISTS employees_card_number_unique
  ON public.employees (card_number)
  WHERE card_number IS NOT NULL AND card_number <> '';
