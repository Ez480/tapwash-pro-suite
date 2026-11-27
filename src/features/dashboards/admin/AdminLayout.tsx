import { Link, Outlet } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BadgeDollarSign, Bell, CalendarDays, ClipboardCheck, ClipboardList, CreditCard, FileText, Gift, LayoutDashboard, Package, PieChart, Settings, Users, UserSquare, Archive, Mail, CalendarClock, MessageCircle, MapPinned } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AdminNav, AppTopbar } from "@/components/app/Shell";
import { useI18n } from "@/lib/i18n";
import { useIsAdmin, useSession } from "@/lib/auth";
import { adminExists, claimAdmin } from "@/lib/admin.functions";


export function AdminLayout() {
  const { t, pick } = useI18n();
  const { user } = useSession();
  const { data: roles, isLoading } = useIsAdmin(user?.id);
  const queryClient = useQueryClient();
  const checkAdmin = useServerFn(adminExists);
  const claim = useServerFn(claimAdmin);
  const isAdmin = (roles ?? []).includes("admin");
  const { data: existing } = useQuery({
    queryKey: ["admin-exists"],
    enabled: !isLoading && !isAdmin,
    queryFn: () => checkAdmin(),
  });

  // Keep admin navigation independent from optional translation keys.
  // A missing i18n entry must never prevent /admin from rendering.
  const items = [
    { to: "/admin", label: pick("Admin dashboard", "لوحة الإدارة"), icon: LayoutDashboard },
    { to: "/admin/daily", label: pick("Today", "اليوم"), icon: CalendarDays },
    { to: "/admin/scheduled-orders", label: pick("Scheduled orders", "أوردارات مجدولة"), icon: CalendarClock },
    { to: "/admin/archive", label: pick("Archive & search", "الأرشيف والبحث"), icon: Archive },
    { to: "/admin/booking-requests", label: pick("Booking requests", "طلبات الحجز"), icon: ClipboardCheck },
    { to: "/admin/messages", label: pick("Messages", "الرسائل"), icon: Mail },
    { to: "/admin/support", label: pick("Support", "الدعم"), icon: MessageCircle },
    { to: "/admin/live-orders", label: pick("Driver tracking", "تتبع السائقين"), icon: MapPinned },
    { to: "/admin/tasks", label: pick("Tasks", "المهام"), icon: ClipboardList },
    { to: "/admin/customers", label: pick("Customers", "العملاء"), icon: Users },
    { to: "/admin/cards", label: pick("NFC cards", "كروت NFC"), icon: CreditCard },
    { to: "/admin/subscriptions", label: pick("Subscriptions", "الاشتراكات"), icon: Package },
    { to: "/admin/packages", label: pick("Packages", "الباقات"), icon: Package },
    { to: "/admin/offers", label: pick("Offers", "العروض"), icon: Gift },
    { to: "/admin/payments", label: pick("Payments", "المدفوعات"), icon: BadgeDollarSign },
    { to: "/admin/employees", label: pick("Employees", "الموظفون"), icon: UserSquare },
    { to: "/admin/notifications", label: pick("Notifications", "الإشعارات"), icon: Bell },
    { to: "/admin/reports", label: pick("Reports", "التقارير"), icon: PieChart },
    { to: "/admin/pages", label: pick("Pages", "الصفحات"), icon: FileText },
    { to: "/admin/settings", label: pick("Settings", "الإعدادات"), icon: Settings },
  ];

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{t("loading")}</div>;
  }

  if (!isAdmin) {
    return (
      <div className="admin-dashboard-shell min-h-screen bg-background">
        <AppTopbar title={pick("Admin dashboard", "لوحة الإدارة")} extra={<AdminNav items={items} mode="mobile" />} />
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h2 className="font-display text-2xl font-bold">{pick("Administrators only", "الإدارة للمصرح لهم فقط")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{pick("You do not have permission to access the admin dashboard.", "ليس لديك صلاحية الوصول إلى لوحة الإدارة.")}</p>
          {existing && !existing.exists && (
            <div className="panel mt-8 p-6">
              <p className="text-sm text-muted-foreground">{pick("You can enable administrator access for the current account.", "يمكنك تفعيل صلاحية المدير للحساب الحالي.")}</p>
              <Button
                className="mt-4"
                onClick={async () => {
                  try {
                    await claim();
                    toast.success(t("saved"));
                    queryClient.invalidateQueries({ queryKey: ["role", user?.id] });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : t("error"));
                  }
                }}
              >
                تفعيل المدير
              </Button>
            </div>
          )}
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link to="/dashboard">{t("nav_dashboard")}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppTopbar
        title="لوحة الإدارة"
        extra={
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link to="/dashboard">{t("nav_dashboard")}</Link>
          </Button>
        }
      />
      <div className="flex min-w-0">
        <AdminNav items={items} mode="desktop" />
        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:py-8">
          <div className="mx-auto w-full max-w-7xl"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
