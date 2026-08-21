import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "ar" | "en";

const dict = {
  // brand / nav
  brand: { en: "TapWash", ar: "تاب واش" },
  tagline: { en: "NFC Car Care", ar: "عناية سيارات بتقنية NFC" },
  nav_home: { en: "Home", ar: "الرئيسية" },
  nav_about: { en: "About Us", ar: "من نحن" },
  nav_services: { en: "Services", ar: "الخدمات" },
  nav_offers: { en: "Offers", ar: "العروض" },
  nav_packages: { en: "Packages", ar: "الباقات" },
  nav_contact: { en: "Contact", ar: "اتصل بنا" },
  nav_login: { en: "Login", ar: "تسجيل الدخول" },
  nav_dashboard: { en: "Dashboard", ar: "لوحتي" },
  nav_admin: { en: "Admin", ar: "الإدارة" },
  logout: { en: "Sign out", ar: "تسجيل الخروج" },
  language: { en: "Language", ar: "اللغة" },
  theme: { en: "Theme", ar: "المظهر" },

  // generic
  loading: { en: "Loading…", ar: "جارٍ التحميل…" },
  save: { en: "Save", ar: "حفظ" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  add: { en: "Add", ar: "إضافة" },
  edit: { en: "Edit", ar: "تعديل" },
  delete: { en: "Delete", ar: "حذف" },
  search: { en: "Search", ar: "بحث" },
  actions: { en: "Actions", ar: "إجراءات" },
  status: { en: "Status", ar: "الحالة" },
  active: { en: "Active", ar: "نشط" },
  inactive: { en: "Inactive", ar: "غير نشط" },
  suspended: { en: "Suspended", ar: "موقوف" },
  expired: { en: "Expired", ar: "منتهي" },
  cancelled: { en: "Cancelled", ar: "ملغي" },
  pending: { en: "Pending", ar: "قيد الانتظار" },
  none: { en: "None", ar: "لا يوجد" },
  empty: { en: "No records yet", ar: "لا توجد بيانات بعد" },
  saved: { en: "Saved successfully", ar: "تم الحفظ بنجاح" },
  deleted: { en: "Deleted", ar: "تم الحذف" },
  error: { en: "Something went wrong", ar: "حدث خطأ ما" },
  confirm_delete: { en: "Delete this record?", ar: "هل تريد حذف هذا السجل؟" },
  egp: { en: "EGP", ar: "ج.م" },
  currency_month: { en: "/ month", ar: "/ شهرياً" },

  // home
  hero_badge: { en: "Egypt's first NFC car wash membership", ar: "أول عضوية غسيل سيارات NFC في مصر" },
  hero_cta: { en: "See packages", ar: "استعرض الباقات" },
  hero_cta2: { en: "Talk to us", ar: "تحدث إلينا" },
  how_title: { en: "Three taps to a spotless car", ar: "ثلاث لمسات لسيارة نظيفة" },
  how_1_t: { en: "Choose a package", ar: "اختر باقتك" },
  how_1_d: {
    en: "Pick a monthly membership that matches how often you drive.",
    ar: "اختر عضوية شهرية تناسب استخدامك للسيارة.",
  },
  how_2_t: { en: "Get your NFC tag", ar: "استلم أداة NFC" },
  how_2_d: {
    en: "A card, keychain or windshield sticker linked to your account.",
    ar: "كارت أو ميدالية أو ستيكر مرتبط بحسابك.",
  },
  how_3_t: { en: "Tap and drive off", ar: "المس وانطلق" },
  how_3_d: {
    en: "Every wash is logged instantly — your balance updates in real time.",
    ar: "كل غسلة تُسجَّل فوراً ويتحدث رصيدك في الحال.",
  },
  stats_title: { en: "Built for scale", ar: "مبني للتوسع" },
  stat_cards: { en: "NFC tags issued", ar: "أداة NFC مُصدَرة" },
  stat_washes: { en: "Washes delivered", ar: "غسلة تم تنفيذها" },
  stat_members: { en: "Active members", ar: "عضو نشط" },
  stat_rating: { en: "Average rating", ar: "متوسط التقييم" },
  view_all_offers: { en: "View all offers", ar: "كل العروض" },
  featured_packages: { en: "Membership packages", ar: "باقات العضوية" },
  featured_offers: { en: "Live offers", ar: "عروض حالية" },
  cta_title: { en: "Ready to stop washing your own car?", ar: "جاهز تتوقف عن غسل سيارتك بنفسك؟" },
  cta_sub: {
    en: "Join TapWash today and get your NFC tag delivered anywhere in Cairo.",
    ar: "انضم إلى تاب واش اليوم واستلم أداة NFC في أي مكان بالقاهرة.",
  },
  get_started: { en: "Get started", ar: "ابدأ الآن" },

  // services
  service_1_t: { en: "Exterior hand wash", ar: "غسيل خارجي يدوي" },
  service_1_d: {
    en: "pH-neutral foam, two-bucket method, microfiber dry.",
    ar: "رغوة متوازنة، طريقة الدلوين، تجفيف بالميكروفايبر.",
  },
  service_2_t: { en: "Interior deep clean", ar: "تنظيف داخلي عميق" },
  service_2_d: {
    en: "Vacuum, steam, leather conditioning and odour removal.",
    ar: "شفط، بخار، تلميع الجلد وإزالة الروائح.",
  },
  service_3_t: { en: "Ceramic protection", ar: "حماية سيراميك" },
  service_3_d: {
    en: "Hydrophobic coating that keeps dust and water off the paint.",
    ar: "طبقة عازلة تحمي الطلاء من الأتربة والمياه.",
  },
  service_4_t: { en: "Engine bay cleaning", ar: "تنظيف غرفة المحرك" },
  service_4_d: {
    en: "Safe degreasing and dressing of the engine compartment.",
    ar: "إزالة الشحوم بأمان وتلميع غرفة المحرك.",
  },
  service_5_t: { en: "Headlight restoration", ar: "تلميع الكشافات" },
  service_5_d: {
    en: "Polish and seal yellowed headlights back to clarity.",
    ar: "تلميع وحماية الكشافات المصفرة لتعود شفافة.",
  },
  service_6_t: { en: "Mobile wash on demand", ar: "غسيل متنقل عند الطلب" },
  service_6_d: {
    en: "Our van comes to your home or office across Cairo and Giza.",
    ar: "فريقنا يأتي إلى منزلك أو عملك في القاهرة والجيزة.",
  },

  // about
  about_v1_t: { en: "Premium by default", ar: "الفخامة كمعيار" },
  about_v1_d: {
    en: "Trained detailers, safe chemicals and a checklist for every car.",
    ar: "فنيون مدربون، مواد آمنة وقائمة مراجعة لكل سيارة.",
  },
  about_v2_t: { en: "Transparent balances", ar: "رصيد واضح" },
  about_v2_d: {
    en: "You always know how many washes you have left. No arguments.",
    ar: "تعرف دائماً عدد الغسلات المتبقية بدون أي جدال.",
  },
  about_v3_t: { en: "Technology first", ar: "التقنية أولاً" },
  about_v3_d: {
    en: "NFC cards, keychains and stickers replace paper punch cards.",
    ar: "كروت وميداليات وستيكرات NFC بدلاً من الكروت الورقية.",
  },

  // contact
  contact_form_title: { en: "Send us a message", ar: "أرسل لنا رسالة" },
  full_name: { en: "Full name", ar: "الاسم الكامل" },
  phone: { en: "Phone", ar: "الهاتف" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  message: { en: "Message", ar: "الرسالة" },
  send: { en: "Send", ar: "إرسال" },
  message_sent: { en: "Thanks! We will reply shortly.", ar: "شكراً لك! سنتواصل معك قريباً." },
  whatsapp: { en: "WhatsApp", ar: "واتساب" },
  call: { en: "Call", ar: "اتصال" },
  address: { en: "Address", ar: "العنوان" },
  follow_us: { en: "Follow us", ar: "تابعنا" },

  // auth
  login_title: { en: "Welcome back", ar: "مرحباً بعودتك" },
  login_sub: { en: "Sign in to manage your membership.", ar: "سجّل الدخول لإدارة عضويتك." },
  signup_title: { en: "Create your account", ar: "أنشئ حسابك" },
  signup_sub: { en: "Start your TapWash membership.", ar: "ابدأ عضويتك في تاب واش." },
  password: { en: "Password", ar: "كلمة المرور" },
  sign_in: { en: "Sign in", ar: "دخول" },
  sign_up: { en: "Sign up", ar: "إنشاء حساب" },
  no_account: { en: "Don't have an account?", ar: "ليس لديك حساب؟" },
  have_account: { en: "Already have an account?", ar: "لديك حساب بالفعل؟" },
  google_sign_in: { en: "Continue with Google", ar: "المتابعة عبر جوجل" },
  or: { en: "or", ar: "أو" },
  check_email: {
    en: "Account created. You can sign in now.",
    ar: "تم إنشاء الحساب. يمكنك الدخول الآن.",
  },

  // customer dashboard
  my_membership: { en: "My membership", ar: "عضويتي" },
  welcome_back: { en: "Welcome back", ar: "مرحباً" },
  package: { en: "Package", ar: "الباقة" },
  subscription_status: { en: "Subscription status", ar: "حالة الاشتراك" },
  start_date: { en: "Start date", ar: "تاريخ البداية" },
  end_date: { en: "End date", ar: "تاريخ النهاية" },
  remaining_washes: { en: "Remaining washes", ar: "الغسلات المتبقية" },
  used_washes: { en: "Used washes", ar: "الغسلات المستخدمة" },
  last_wash: { en: "Last wash", ar: "آخر غسلة" },
  renew: { en: "Renew subscription", ar: "تجديد الاشتراك" },
  renew_requested: {
    en: "Renewal request sent. Our team will call you.",
    ar: "تم إرسال طلب التجديد. سيتواصل معك الفريق.",
  },
  edit_profile: { en: "Edit profile", ar: "تعديل الملف" },
  change_password: { en: "Change password", ar: "تغيير كلمة المرور" },
  new_password: { en: "New password", ar: "كلمة المرور الجديدة" },
  password_changed: { en: "Password updated", ar: "تم تحديث كلمة المرور" },
  avatar_url: { en: "Profile image URL", ar: "رابط صورة الملف" },
  my_cards: { en: "My NFC tags", ar: "أدوات NFC الخاصة بي" },
  wash_history: { en: "Wash history", ar: "سجل الغسلات" },
  no_subscription: { en: "No active subscription", ar: "لا يوجد اشتراك نشط" },
  no_subscription_d: {
    en: "Pick a package and our team will activate your membership.",
    ar: "اختر باقة وسيقوم الفريق بتفعيل عضويتك.",
  },

  // admin / shared labels
  total_customers: { en: "Total customers", ar: "إجمالي العملاء" },
  active_subs: { en: "Active subscriptions", ar: "الاشتراكات النشطة" },
  washes_month: { en: "Washes this month", ar: "غسلات هذا الشهر" },
  revenue_month: { en: "Revenue this month", ar: "إيرادات هذا الشهر" },
  assigned_cards: { en: "Assigned NFC cards", ar: "كروت NFC المخصصة" },
  available_cards: { en: "Available NFC cards", ar: "كروت NFC المتاحة" },
  a_packages: { en: "Packages", ar: "الباقات" },
  total_washes: { en: "Total washes", ar: "إجمالي الغسلات" },
  recent_washes: { en: "Recent washes", ar: "أحدث الغسلات" },
  recent_payments: { en: "Recent payments", ar: "أحدث المدفوعات" },
  a_subscriptions: { en: "Recent subscriptions", ar: "أحدث الاشتراكات" },
} as const;

type TKey = keyof typeof dict;
type Ctx = {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: TKey) => string;
  pick: <T>(en: T, ar: T) => T;
  fmtDate: (v: unknown) => string;
  fmtMoney: (v: unknown) => string;
};

const LangContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "tapwash.lang";

function safeDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "ar") setLangState(stored);
  }, []);

  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const value = useMemo<Ctx>(() => {
    const t = (key: TKey) => dict[key][lang] ?? dict[key].en;
    return {
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      setLang,
      toggleLang: () => setLang(lang === "ar" ? "en" : "ar"),
      t,
      pick: <T,>(en: T, ar: T) => (lang === "ar" ? ar : en),
      fmtDate: (v) => {
        const date = safeDate(v);
        if (!date) return "—";
        try {
          return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }).format(date);
        } catch {
          return "—";
        }
      },
      fmtMoney: (v) => {
        if (v === null || v === undefined || v === "") return "—";
        const amount = Number(v);
        if (!Number.isFinite(amount)) return "—";
        return `${new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
          maximumFractionDigits: 0,
        }).format(amount)} ${t("egp")}`;
      },
    };
  }, [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useI18n must be used inside LanguageProvider");
  return ctx;
}
