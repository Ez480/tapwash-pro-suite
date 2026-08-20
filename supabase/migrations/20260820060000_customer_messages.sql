CREATE TABLE IF NOT EXISTS public.customer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_email TEXT,
  customer_phone TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_messages_created_at_idx ON public.customer_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS customer_messages_read_idx ON public.customer_messages(is_read);

ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer messages public insert" ON public.customer_messages;
CREATE POLICY "customer messages public insert" ON public.customer_messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admins read customer messages" ON public.customer_messages;
CREATE POLICY "admins read customer messages" ON public.customer_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

DROP POLICY IF EXISTS "admins update customer messages" ON public.customer_messages;
CREATE POLICY "admins update customer messages" ON public.customer_messages
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

GRANT INSERT ON public.customer_messages TO anon, authenticated;
GRANT SELECT, UPDATE ON public.customer_messages TO authenticated;
GRANT ALL ON public.customer_messages TO service_role;
