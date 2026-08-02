-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','employee','customer');
CREATE TYPE public.card_type AS ENUM ('card','sticker','keychain');
CREATE TYPE public.card_status AS ENUM ('available','assigned','blocked');
CREATE TYPE public.entity_status AS ENUM ('active','inactive');
CREATE TYPE public.customer_status AS ENUM ('active','suspended');
CREATE TYPE public.subscription_status AS ENUM ('active','expired','cancelled','pending');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  status public.customer_status NOT NULL DEFAULT 'active',
  language TEXT NOT NULL DEFAULT 'ar',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles admin all" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- new user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email, NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PACKAGES
CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description_en TEXT DEFAULT '',
  description_ar TEXT DEFAULT '',
  features_en TEXT[] NOT NULL DEFAULT '{}',
  features_ar TEXT[] NOT NULL DEFAULT '{}',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 30,
  washes_count INTEGER NOT NULL DEFAULT 4,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status public.entity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.packages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packages public read" ON public.packages FOR SELECT USING (status = 'active' OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "packages admin write" ON public.packages FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_packages_updated BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- OFFERS
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description_en TEXT DEFAULT '',
  description_ar TEXT DEFAULT '',
  old_price NUMERIC(10,2),
  new_price NUMERIC(10,2),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status public.entity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.offers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offers public read" ON public.offers FOR SELECT USING (status = 'active' OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "offers admin write" ON public.offers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_offers_updated BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NFC CARDS
CREATE TABLE public.nfc_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid TEXT NOT NULL UNIQUE,
  serial_number TEXT NOT NULL UNIQUE,
  card_type public.card_type NOT NULL DEFAULT 'card',
  status public.card_status NOT NULL DEFAULT 'available',
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  activation_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nfc_cards TO authenticated;
GRANT ALL ON public.nfc_cards TO service_role;
ALTER TABLE public.nfc_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cards own read" ON public.nfc_cards FOR SELECT TO authenticated USING (customer_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'));
CREATE POLICY "cards admin write" ON public.nfc_cards FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_cards_updated BEFORE UPDATE ON public.nfc_cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL DEFAULT (CURRENT_DATE + 30),
  total_washes INTEGER NOT NULL DEFAULT 0,
  used_washes INTEGER NOT NULL DEFAULT 0,
  status public.subscription_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs own read" ON public.subscriptions FOR SELECT TO authenticated USING (customer_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'));
CREATE POLICY "subs admin write" ON public.subscriptions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- WASHES
CREATE TABLE public.washes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  washed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.washes TO authenticated;
GRANT ALL ON public.washes TO service_role;
ALTER TABLE public.washes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "washes own read" ON public.washes FOR SELECT TO authenticated USING (customer_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'));
CREATE POLICY "washes staff write" ON public.washes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'));

-- EMPLOYEES
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  job_title TEXT,
  branch TEXT,
  status public.entity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees admin all" ON public.employees FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'paid',
  reference TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments own read" ON public.payments FOR SELECT TO authenticated USING (customer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "payments admin write" ON public.payments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications own read" ON public.notifications FOR SELECT TO authenticated USING (customer_id = auth.uid() OR customer_id IS NULL OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "notifications own update" ON public.notifications FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "notifications admin write" ON public.notifications FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- SITE PAGES
CREATE TABLE public.site_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  subtitle_en TEXT DEFAULT '',
  subtitle_ar TEXT DEFAULT '',
  content_en TEXT DEFAULT '',
  content_ar TEXT DEFAULT '',
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  status public.entity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_pages TO authenticated;
GRANT ALL ON public.site_pages TO service_role;
ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pages public read" ON public.site_pages FOR SELECT USING (true);
CREATE POLICY "pages admin write" ON public.site_pages FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_pages_updated BEFORE UPDATE ON public.site_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SETTINGS
CREATE TABLE public.site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  logo_url TEXT,
  company_name_en TEXT NOT NULL DEFAULT 'TapWash',
  company_name_ar TEXT NOT NULL DEFAULT 'تاب واش',
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address_en TEXT,
  address_ar TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  tiktok_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#1D6BFF',
  secondary_color TEXT NOT NULL DEFAULT '#0A0A0A',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "settings admin write" ON public.site_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SEED
INSERT INTO public.site_settings (id, company_name_en, company_name_ar, phone, whatsapp, email, address_en, address_ar, facebook_url, instagram_url, tiktok_url)
VALUES (1,'TapWash','تاب واش','+201000000000','+201000000000','hello@tapwash.eg','New Cairo, Cairo, Egypt','التجمع الخامس، القاهرة، مصر','https://facebook.com/tapwash','https://instagram.com/tapwash','https://tiktok.com/@tapwash');

INSERT INTO public.packages (title_en,title_ar,description_en,description_ar,features_en,features_ar,price,duration_days,washes_count,sort_order) VALUES
('Silver Tap','تاب سيلفر','Perfect for city drivers who wash weekly.','مثالي لقائدي السيارات داخل المدينة أسبوعياً.',ARRAY['4 exterior washes','Tire shine','NFC keychain'],ARRAY['4 غسلات خارجية','تلميع الإطارات','ميدالية NFC'],750,30,4,1),
('Gold Tap','تاب جولد','Our most popular plan with interior detailing.','الأكثر طلباً مع تنظيف داخلي كامل.',ARRAY['8 washes','Interior vacuum','Dashboard polish','NFC card'],ARRAY['8 غسلات','شفط داخلي','تلميع التابلوه','كارت NFC'],1350,30,8,2),
('Platinum Tap','تاب بلاتينيوم','Unlimited care with premium ceramic protection.','عناية كاملة مع حماية سيراميك متميزة.',ARRAY['16 washes','Ceramic spray','Engine bay clean','Priority booking','NFC sticker + card'],ARRAY['16 غسلة','رشة سيراميك','تنظيف غرفة المحرك','أولوية في الحجز','ستيكر وكارت NFC'],2400,30,16,3);

INSERT INTO public.offers (title_en,title_ar,description_en,description_ar,old_price,new_price,end_date) VALUES
('Summer Shine','لمعة الصيف','Two extra washes free on any Gold plan this month.','غسلتان إضافيتان مجاناً على باقة جولد هذا الشهر.',1350,1150,CURRENT_DATE + 45),
('NFC Starter Kit','باقة NFC للبداية','Card, keychain and sticker bundle with your first subscription.','كارت وميدالية وستيكر مع أول اشتراك.',400,250,CURRENT_DATE + 60);

INSERT INTO public.site_pages (slug,title_en,title_ar,subtitle_en,subtitle_ar,content_en,content_ar) VALUES
('home','Tap. Wash. Shine.','المس. اغسل. المع.','Egypt''s first NFC-powered car wash membership.','أول عضوية غسيل سيارات بتقنية NFC في مصر.','Tap your NFC card, keychain or sticker at any TapWash bay and your wash is logged instantly. No paper cards, no phone calls, no confusion.','المس كارت أو ميدالية أو ستيكر NFC في أي فرع من تاب واش وسيتم تسجيل الغسلة فوراً. بدون كروت ورقية أو مكالمات.'),
('about','About TapWash','عن تاب واش','A premium car care company built for modern Egypt.','شركة عناية بالسيارات مبنية لمصر الحديثة.','TapWash started in Cairo with one belief: car care should feel effortless and premium. We combine trained detailers, safe products and NFC technology so every customer knows exactly what they paid for and what is left.','بدأت تاب واش في القاهرة بفكرة واحدة: العناية بالسيارة يجب أن تكون سهلة وفاخرة. نجمع بين فنيين مدربين ومنتجات آمنة وتقنية NFC حتى يعرف كل عميل ما دفعه وما تبقى له.'),
('services','Our Services','خدماتنا','Detailing services designed around your schedule.','خدمات عناية مصممة حسب وقتك.','Exterior hand wash, interior deep cleaning, ceramic protection, engine bay cleaning, headlight restoration and on-demand mobile washing across Cairo and Giza.','غسيل خارجي يدوي، تنظيف داخلي عميق، حماية سيراميك، تنظيف غرفة المحرك، تجليخ الكشافات وغسيل متنقل في القاهرة والجيزة.'),
('contact','Contact Us','اتصل بنا','We reply within minutes on WhatsApp.','نرد في دقائق على واتساب.','Reach the TapWash team any day from 9am to 11pm. Send us your location and car model and we will recommend the right package.','فريق تاب واش متاح يومياً من 9 صباحاً حتى 11 مساءً. أرسل موقعك وموديل سيارتك وسنقترح الباقة المناسبة.');