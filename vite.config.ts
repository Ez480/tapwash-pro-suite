import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

const restoreAdminI18n = () => ({
  name: "tapwash-restore-admin-i18n",
  enforce: "pre" as const,
  transform(code: string, id: string) {
    if (!id.endsWith("/src/lib/i18n.tsx")) return null;

    const missingTranslations = `\nconst missingTranslations: Record<string, { en: string; ar: string }> = ${JSON.stringify({
      notifications: { en: "Notifications", ar: "الإشعارات" },
      admin_panel: { en: "Admin panel", ar: "لوحة الإدارة" },
      a_dashboard: { en: "Dashboard", ar: "الرئيسية" },
      a_customers: { en: "Customers", ar: "العملاء" },
      a_cards: { en: "NFC Cards", ar: "كروت NFC" },
      a_packages: { en: "Packages", ar: "الباقات" },
      a_offers: { en: "Offers", ar: "العروض" },
      a_pages: { en: "Pages", ar: "الصفحات" },
      a_settings: { en: "Settings", ar: "الإعدادات" },
      a_employees: { en: "Employees", ar: "الموظفون" },
      a_subscriptions: { en: "Subscriptions", ar: "الاشتراكات" },
      a_payments: { en: "Payments", ar: "المدفوعات" },
      a_notifications: { en: "Notifications", ar: "الإشعارات" },
      a_reports: { en: "Reports", ar: "التقارير" },
      assign_package: { en: "Assign package", ar: "إسناد باقة" },
      assign_card: { en: "Assign NFC tag", ar: "إسناد أداة NFC" },
      add_wash: { en: "Add wash", ar: "إضافة غسلة" },
      remove_wash: { en: "Remove wash", ar: "خصم غسلة" },
      view_history: { en: "View history", ar: "عرض السجل" },
      activate: { en: "Activate", ar: "تنشيط" },
      suspend: { en: "Suspend", ar: "إيقاف" },
      customer: { en: "Customer", ar: "العميل" },
      card_type: { en: "Type", ar: "النوع" },
      card: { en: "Card", ar: "كارت" },
      sticker: { en: "Sticker", ar: "ستيكر" },
      keychain: { en: "Keychain", ar: "ميدالية" },
      uid: { en: "UUID", ar: "المعرف UUID" },
      serial_number: { en: "Serial number", ar: "الرقم التسلسلي" },
      activation_date: { en: "Activation date", ar: "تاريخ التنشيط" },
      available: { en: "Available", ar: "متاح" },
      assigned: { en: "Assigned", ar: "مُسند" },
      blocked: { en: "Blocked", ar: "محظور" },
      title_en: { en: "Title (EN)", ar: "العنوان (إنجليزي)" },
      title_ar: { en: "Title (AR)", ar: "العنوان (عربي)" },
      desc_en: { en: "Description (EN)", ar: "الوصف (إنجليزي)" },
      desc_ar: { en: "Description (AR)", ar: "الوصف (عربي)" },
      features_en: { en: "Features (EN, comma separated)", ar: "المميزات (إنجليزي، بفواصل)" },
      features_ar: { en: "Features (AR, comma separated)", ar: "المميزات (عربي، بفواصل)" },
      price: { en: "Price", ar: "السعر" },
      old_price: { en: "Old price", ar: "السعر القديم" },
      new_price: { en: "New price", ar: "السعر الجديد" },
      duration_days: { en: "Duration (days)", ar: "المدة (أيام)" },
      washes_count: { en: "Number of washes", ar: "عدد الغسلات" },
      image_url: { en: "Image URL", ar: "رابط الصورة" },
      sort_order: { en: "Sort order", ar: "الترتيب" },
      amount: { en: "Amount", ar: "المبلغ" },
      method: { en: "Method", ar: "طريقة الدفع" },
      reference: { en: "Reference", ar: "المرجع" },
      paid_at: { en: "Paid at", ar: "تاريخ الدفع" },
      job_title: { en: "Job title", ar: "المسمى الوظيفي" },
      branch: { en: "Branch", ar: "الفرع" },
      total_washes: { en: "Total washes", ar: "إجمالي الغسلات" },
      title: { en: "Title", ar: "العنوان" },
      broadcast: { en: "Broadcast to all", ar: "إرسال للجميع" },
      content_en: { en: "Content (EN)", ar: "المحتوى (إنجليزي)" },
      content_ar: { en: "Content (AR)", ar: "المحتوى (عربي)" },
      subtitle_en: { en: "Subtitle (EN)", ar: "العنوان الفرعي (إنجليزي)" },
      subtitle_ar: { en: "Subtitle (AR)", ar: "العنوان الفرعي (عربي)" },
      slug: { en: "Page", ar: "الصفحة" },
      company_logo: { en: "Company logo URL", ar: "رابط شعار الشركة" },
      company_name_en: { en: "Company name (EN)", ar: "اسم الشركة (إنجليزي)" },
      company_name_ar: { en: "Company name (AR)", ar: "اسم الشركة (عربي)" },
      address_en: { en: "Address (EN)", ar: "العنوان (إنجليزي)" },
      address_ar: { en: "Address (AR)", ar: "العنوان (عربي)" },
      primary_color: { en: "Primary color", ar: "اللون الأساسي" },
      secondary_color: { en: "Secondary color", ar: "اللون الثانوي" },
      social_links: { en: "Social links", ar: "روابط التواصل" },
      reports_note: { en: "Last 6 months", ar: "آخر 6 أشهر" },
      washes_by_month: { en: "Washes by month", ar: "الغسلات شهرياً" },
      revenue_by_month: { en: "Revenue by month", ar: "الإيرادات شهرياً" },
      packages_share: { en: "Members per package", ar: "الأعضاء لكل باقة" },
      claim_admin: { en: "Claim admin access", ar: "الحصول على صلاحية الإدارة" },
      claim_admin_d: { en: "No admin exists yet. Claim the admin role for this account.", ar: "لا يوجد مدير بعد. احصل على صلاحية الإدارة لهذا الحساب." },
      admin_only: { en: "Admins only", ar: "للمديرين فقط" },
      admin_only_d: { en: "This account does not have admin access.", ar: "هذا الحساب لا يملك صلاحية الإدارة." },
    })};\n`;

    const injected = code.includes("const missingTranslations") ? code : code.replace("} as const;", "} as const;" + missingTranslations);
    return injected.replace(
      "const t = (key: TKey) => dict[key][lang] ?? dict[key].en;",
      "const t = (key: TKey) => (dict[key] ?? missingTranslations[key])?.[lang] ?? (dict[key] ?? missingTranslations[key])?.en ?? String(key);",
    );
  },
});

export default defineConfig({
  plugins: [
    restoreAdminI18n(),
    tanstackStart(),
    nitro(),
    react(),
    tsconfigPaths(),
    tailwindcss(),
  ],
});
