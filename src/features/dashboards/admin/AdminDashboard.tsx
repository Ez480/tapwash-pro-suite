import { Download } from "lucide-react";
import { toast } from "sonner";

import { StatCard } from "@/components/app/Shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";
import { downloadCustomersExcel } from "@/lib/admin-export";
import { NfcCheckin } from "@/components/admin/NfcCheckin";


export function AdminDashboard() {
  const { t, fmtDate, fmtMoney, pick } = useI18n();
  const { data: customers } = useAdminTable("profiles", "*", "created_at");
  const { data: subs } = useAdminTable("subscriptions", "*, packages(title_en,title_ar)", "created_at");
  const { data: washes } = useAdminTable("washes", "*", "washed_at");
  const { data: payments } = useAdminTable("payments", "*", "paid_at");
  const { data: cards } = useAdminTable("nfc_cards", "*", "created_at");
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const washesMonth = (washes ?? []).filter((w) => new Date(String(w.washed_at)) >= monthStart).length;
  const revenueMonth = (payments ?? []).filter((p) => p.status === "paid" && new Date(String(p.paid_at || p.created_at)) >= monthStart).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const activeSubs = (subs ?? []).filter((s) => s.status === "active").length;
  const assigned = (cards ?? []).filter((c) => c.status === "assigned").length;
  const available = (cards ?? []).filter((c) => c.status === "available").length;
  const exportCustomers = async () => { try { const [ordersResult, cardsResult] = await Promise.all([supabase.from("booking_requests").select("*").order("created_at", { ascending: false }), supabase.from("nfc_cards").select("*").order("created_at", { ascending: false })]); if (ordersResult.error) throw ordersResult.error; if (cardsResult.error) throw cardsResult.error; downloadCustomersExcel({ customers: (customers ?? []) as Record<string, unknown>[], orders: (ordersResult.data ?? []) as Record<string, unknown>[], cards: (cardsResult.data ?? []) as Record<string, unknown>[] }); toast.success(pick("Customer, order and NFC card data exported to Excel.","تم تصدير بيانات العملاء والأوردرات والكروت إلى ملف Excel.")); } catch (error) { toast.error(error instanceof Error ? error.message : pick("Could not export the data.","تعذر تصدير البيانات")); } };
  return <div>
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-white/45 bg-white/20 p-4 text-foreground shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_8px_30px_rgba(0,0,0,0.22)] sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-lg font-bold">{pick("Customer data management","إدارة بيانات العملاء")}</h2><p className="text-sm text-muted-foreground">{pick("Export complete customer data, previous orders and NFC cards.","تصدير بيانات العملاء الكاملة، الأوردرات السابقة، وكروت NFC.")}</p></div><Button onClick={exportCustomers} className="gap-2"><Download className="size-4" />{pick("Export Excel","تصدير Excel")}</Button></div>
    <NfcCheckin />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl border border-sky-300/45 bg-sky-200/25 p-1 shadow-[0_8px_24px_rgba(14,165,233,0.10)] backdrop-blur-xl dark:border-sky-200/15 dark:bg-sky-300/[0.08]"><StatCard tone="default" label={t("total_customers")} value={(customers ?? []).length} /></div><div className="rounded-2xl border border-amber-300/45 bg-amber-200/25 p-1 shadow-[0_8px_24px_rgba(245,158,11,0.10)] backdrop-blur-xl dark:border-amber-200/15 dark:bg-amber-300/[0.08]"><StatCard tone="default" label={t("active_subs")} value={activeSubs} /></div><StatCard label={t("washes_month")} value={washesMonth} /><StatCard label={t("revenue_month")} value={fmtMoney(revenueMonth)} /><StatCard label={t("assigned_cards")} value={assigned} /><StatCard label={t("available_cards")} value={available} /><StatCard label={t("a_packages")} value={new Set((subs ?? []).map((s) => s.package_id)).size} /><StatCard label={t("total_washes")} value={(washes ?? []).length} /></div>
    <div className="mt-8 grid gap-6 lg:grid-cols-2"><section className="panel p-6"><h3 className="text-lg font-bold">{t("recent_washes")}</h3><div className="mt-4 space-y-2 text-sm">{(washes ?? []).slice(0, 8).map((w) => <div key={String(w.id)} className="flex items-center justify-between rounded-lg border border-border px-4 py-3"><span>{fmtDate(String(w.washed_at))}</span><span className="text-muted-foreground">{String(w.branch ?? "—")}</span></div>)}{(washes ?? []).length === 0 ? <p className="text-muted-foreground">{t("empty")}</p> : null}</div></section><section className="panel p-6"><h3 className="text-lg font-bold">{t("recent_payments")}</h3><div className="mt-4 space-y-2 text-sm">{(payments ?? []).slice(0, 8).map((p) => <div key={String(p.id)} className="flex items-center justify-between rounded-lg border border-border px-4 py-3"><span>{fmtDate(String(p.paid_at))}</span><span className="font-semibold">{fmtMoney(Number(p.amount ?? 0))}</span></div>)}{(payments ?? []).length === 0 ? <p className="text-muted-foreground">{t("empty")}</p> : null}</div></section></div>
    <section className="panel mt-6 p-6"><h3 className="text-lg font-bold">{t("a_subscriptions")}</h3><div className="mt-4 space-y-2 text-sm">{(subs ?? []).slice(0, 8).map((s) => { const pkg = s.packages as { title_en?: string; title_ar?: string } | null; return <div key={String(s.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3"><span className="font-medium">{pkg ? pick(pkg.title_en ?? "", pkg.title_ar ?? "") : "—"}</span><span className="text-muted-foreground">{String(s.used_washes ?? 0)} / {String(s.total_washes ?? 0)}</span><span className="text-muted-foreground">{fmtDate(String(s.end_date))}</span></div>; })}{(subs ?? []).length === 0 ? <p className="text-muted-foreground">{t("empty")}</p> : null}</div></section>
  </div>;
}
