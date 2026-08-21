import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, CalendarClock, Droplets, Package, RefreshCw, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppTopbar, StatCard } from "@/components/app/Shell";
import { ProfileEditor } from "@/components/app/ProfileEditor";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSession, useUserRoles } from "@/lib/auth";
import { useMyCards, useMyEmployee, useMySubscription, useMyWashes, useProfile } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: CustomerDashboard });
type CurrentOrder = Record<string, any>;
type EmployeeInfo = { employee_id: string | null; job_title: string | null; full_name: string | null };

const orderStages = [
  { key: "pending", en: "Your order has been received", ar: "تم استلام طلبك", icon: "📥" },
  { key: "confirmed", en: "Your order has been confirmed", ar: "تم تأكيد طلبك", icon: "✅" },
  { key: "on_the_way", en: "TapWash is on the way", ar: "تاب وش في الطريق", icon: "🚗" },
  { key: "arrived", en: "TapWash has arrived", ar: "تم وصول تاب وش", icon: "📍" },
  { key: "in_progress", en: "Service has started", ar: "بدء التنفيذ", icon: "✨" },
  { key: "completed", en: "Your order is complete", ar: "تم انهاء طلبك", icon: "🏁" },
];
function normalizeOrderStatus(status: string | null | undefined) { const value = String(status ?? "pending").toLowerCase(); if (["new", "created", "pending", "requested"].includes(value)) return "pending"; if (["approved", "confirmed", "accepted", "assigned"].includes(value)) return "confirmed"; if (["on_the_way", "on-the-way", "out_for_delivery"].includes(value)) return "on_the_way"; if (["arrived", "delivered", "picked_up", "picked-up", "pickup", "collected", "courier_picked_up"].includes(value)) return "arrived"; if (["in_progress", "in-progress", "washing", "processing", "started"].includes(value)) return "in_progress"; if (["completed", "complete", "finished", "closed"].includes(value)) return "completed"; return "pending"; }

function NfcGlassCard({ cards, pick }: { cards: any[] | undefined; pick: (en: string, ar: string) => string }) {
  const card = cards?.[0];
  const active = String(card?.status ?? "active").toLowerCase() === "active";
  return <section className="relative mt-4 overflow-hidden rounded-[1.8rem] border border-cyan-300/30 bg-gradient-to-br from-cyan-400/20 via-sky-500/10 to-blue-600/15 p-3 shadow-xl backdrop-blur-2xl sm:p-4">
    <div className="pointer-events-none absolute -left-14 -top-16 size-40 rounded-full bg-cyan-300/25 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-16 -right-14 size-44 rounded-full bg-blue-500/20 blur-3xl" />
    <div className="relative overflow-hidden rounded-[1.45rem] border border-white/40 bg-white/25 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-cyan-400/10 dark:from-white/10" />
      <div className="relative flex items-center gap-3 border-b border-white/25 px-3 py-3 sm:px-4">
        <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/50 bg-white/35 text-primary shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
          <svg viewBox="0 0 48 48" className="size-9 text-primary" fill="none" aria-hidden="true">
            <circle cx="24" cy="24" r="3.5" fill="currentColor" />
            <path d="M16.5 17.5a9.2 9.2 0 0 0 0 13M31.5 17.5a9.2 9.2 0 0 1 0 13" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M11 12a17 17 0 0 0 0 24M37 12a17 17 0 0 1 0 24" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" opacity=".62" />
          </svg>
          <span className={`absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-background ${active ? "bg-blue-500" : "bg-red-500"} ${active ? "animate-pulse" : ""}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/75">TapWash NFC</p>
          <h3 className="truncate text-base font-black sm:text-lg">{pick("NFC card", "كارت NFC")}</h3>
        </div>
        <Badge variant={active ? "default" : "destructive"} className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold sm:px-3">{active ? pick("Active", "شغال") : pick("Suspended", "موقوف")}</Badge>
      </div>
      <div className="relative flex items-center gap-3 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/30 bg-white/20 px-3 py-2.5 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ScanLine className="size-5" /></div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{pick("Ready to scan", "جاهز للمسح")}</p>
            <p className="truncate text-[11px] text-muted-foreground">{pick("Tap your card to continue", "قرّب الكارت من الهاتف للمتابعة")}</p>
          </div>
        </div>
        <Button asChild size="icon" className="size-12 shrink-0 rounded-2xl shadow-lg" type="button" aria-label={pick("Scan NFC card", "تشغيل مسح الكارت")}>
          <Link to="/nfc-reorder"><ScanLine className="size-5" /></Link>
        </Button>
      </div>
    </div>
  </section>;
}

function MembershipGlassCard({ sub, total, remaining, used, statusLabel, pick, t }: { sub: any; total: number; remaining: number; used: number; statusLabel: (s?: string | null) => string; pick: (en: string, ar: string) => string; t: (key: string) => string }) {
  const packageName = sub?.packages ? pick(sub.packages.title_en, sub.packages.title_ar) : t("none");
  const status = String(sub?.status ?? "").toLowerCase();
  const statusDot = status === "active" ? "bg-blue-500" : status === "pending" ? "bg-amber-400" : "bg-red-500";
  return <section className="panel relative mt-6 overflow-hidden p-0 shadow-xl">
    <div className="absolute -left-16 -top-20 size-48 rounded-full bg-primary/15 blur-3xl" />
    <div className="absolute -bottom-20 -right-16 size-52 rounded-full bg-cyan-400/10 blur-3xl" />
    <div className="relative p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">TapWash Membership</p><h3 className="mt-1 text-xl font-black">{t("package")}</h3></div><Badge variant={status === "active" ? "default" : status === "pending" ? "secondary" : "destructive"} className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5"><span className={`size-2 rounded-full ${statusDot} ${status === "active" ? "animate-pulse" : ""}`} />{statusLabel(sub?.status)}</Badge></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/35 bg-white/25 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]"><div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Package className="size-5" /></div><p className="text-xs text-muted-foreground">{t("package")}</p><p className="mt-1 font-bold">{packageName}</p></div>
        <div className="rounded-2xl border border-white/35 bg-white/25 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]"><div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Droplets className="size-5" /></div><p className="text-xs text-muted-foreground">{t("remaining_washes")}</p><p className="mt-1 text-2xl font-black">{remaining}</p><p className="text-xs text-muted-foreground">{used} {pick("used", "مستخدمة")} / {total}</p></div>
        <div className="rounded-2xl border border-white/35 bg-white/25 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]"><div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" /></div><p className="text-xs text-muted-foreground">{t("subscription_status")}</p><p className="mt-1 font-bold">{statusLabel(sub?.status)}</p></div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary/10"><Progress value={total ? (used / total) * 100 : 0} className="h-full" /></div>
    </div>
  </section>;
}

function WashDateCards({ lastWash, nextWash, fmtDate, pick }: { lastWash: string | null; nextWash: string | null; fmtDate: (date: string | null) => string; pick: (en: string, ar: string) => string }) {
  const items = [{ icon: Droplets, title: pick("Last wash", "آخر غسلة"), value: fmtDate(lastWash), tone: "bg-blue-500/10 text-blue-500" }, { icon: CalendarClock, title: pick("Next wash", "الغسلة القادمة"), value: nextWash ? fmtDate(nextWash) : pick("Not scheduled", "غير محددة"), tone: "bg-cyan-500/10 text-cyan-500" }];
  return <div className="mt-4 grid gap-4 sm:grid-cols-2">{items.map(({ icon: Icon, title, value, tone }) => <div key={title} className="panel flex items-center gap-4 p-5"><div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${tone}`}><Icon className="size-6" /></div><div className="min-w-0"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-1 truncate font-bold">{value}</p></div></div>)}</div>;
}

function CustomerDashboard() {
  const { t, pick, fmtDate, lang, setLang } = useI18n(); const { user } = useSession(); const { data: profile } = useProfile(user?.id); const { data: sub } = useMySubscription(user?.id); const { data: washes } = useMyWashes(user?.id); const { data: cards } = useMyCards(user?.id); const { data: roles } = useUserRoles(user?.id); const { data: employeeData, isLoading: employeeQueryLoading, refetch: refetchEmployee } = useMyEmployee(user?.id);
  const [currentOrder, setCurrentOrder] = useState<CurrentOrder | null>(null); const [employeeInfo, setEmployeeInfo] = useState<EmployeeInfo | null>(null); const [employeeLoading, setEmployeeLoading] = useState(false);
  useEffect(() => { if (profile?.language && (profile.language === "ar" || profile.language === "en") && profile.language !== lang) setLang(profile.language); }, [profile?.language, lang, setLang]); useEffect(() => { setEmployeeInfo((employeeData as EmployeeInfo | null) ?? null); }, [employeeData]);
  const isAdmin = (roles ?? []).includes("admin"); const isEmployee = !isAdmin && (roles ?? []).includes("employee"); const total = sub?.total_washes ?? 0; const used = sub?.used_washes ?? 0; const remaining = Math.max(total - used, 0); const lastWash = washes?.[0]?.washed_at ?? null; const nextWash = currentOrder?.scheduled_at ?? null;
  const loadEmployee = async () => { if (!user?.id) return; setEmployeeLoading(true); try { const result = await refetchEmployee(); const employee = (result.data as EmployeeInfo | null) ?? null; setEmployeeInfo(employee); if (!employee && isEmployee) toast.error(pick("No employee record is linked to this account.", "لا يوجد سجل موظف مرتبط بهذا الحساب.")); } catch (error) { console.error("Employee load failed", error); setEmployeeInfo(null); if (isEmployee) toast.error(pick("Could not load employee information.", "تعذر تحميل بيانات الموظف.")); } finally { setEmployeeLoading(false); } };
  useEffect(() => { if (!user?.id) return; const channel = supabase.channel(`employee-data-${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "employees" }, () => void refetchEmployee()).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [user?.id, refetchEmployee]);
  useEffect(() => { if (!user?.id) return; let mounted = true; const loadOrder = async () => { const { data } = await (supabase as any).from("booking_requests").select("*").eq("customer_id", user.id).not("status", "in", "(completed,closed,rejected)").order("updated_at", { ascending: false }).limit(1).maybeSingle(); if (mounted) setCurrentOrder(data ?? null); }; void loadOrder(); const channel = supabase.channel(`customer-booking-order-${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "booking_requests", filter: `customer_id=eq.${user.id}` }, () => void loadOrder()).subscribe(); return () => { mounted = false; void supabase.removeChannel(channel); }; }, [user?.id]);
  const statusLabel = (s?: string | null) => s === "active" ? t("active") : s === "expired" ? t("expired") : s === "cancelled" ? t("cancelled") : s === "pending" ? t("pending") : t("none"); const currentStage = orderStages.find(s => s.key === normalizeOrderStatus(currentOrder?.status)) ?? orderStages[0]; const currentIndex = Math.max(orderStages.findIndex(s => s.key === currentStage.key), 0);
  return <div className="customer-dashboard min-h-screen bg-background"><AppTopbar title={t("my_membership")} extra={isAdmin ? <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex"><Link to="/admin"><ShieldCheck className="me-1.5 size-4" />{t("nav_admin")}</Link></Button> : null} /><div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
    <div className="panel animate-fade-up flex flex-wrap items-center gap-5 p-6">{profile?.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name || "avatar"} className="size-16 rounded-2xl object-cover" /> : <div className="surface-blue flex size-16 items-center justify-center rounded-2xl font-display text-xl font-bold shadow-luxe">{(profile?.full_name || user?.email || "T").slice(0, 1).toUpperCase()}</div>}<div className="min-w-0"><p className="text-xs uppercase tracking-widest text-muted-foreground">{t("welcome_back")}</p><h2 className="truncate text-2xl font-bold">{profile?.full_name || user?.email}</h2><div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><Badge variant={profile?.status === "active" ? "default" : "destructive"}>{profile?.status === "active" ? t("active") : t("suspended")}</Badge>{isEmployee && <Badge variant="secondary">{pick("Employee", "موظف")}</Badge>}{isAdmin && <Badge variant="secondary">{pick("Admin", "مدير")}</Badge>}{profile?.phone && <span>{profile.phone}</span>}</div></div><div className="ms-auto flex flex-wrap gap-2"><ProfileEditor /></div></div>
    <NfcGlassCard cards={cards} pick={pick} />
    {sub && <MembershipGlassCard sub={sub} total={total} remaining={remaining} used={used} statusLabel={statusLabel} pick={pick} t={t} />}
    <WashDateCards lastWash={lastWash} nextWash={nextWash} fmtDate={fmtDate} pick={pick} />
    {(isEmployee || employeeInfo) && <section className="panel mt-6 p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><BriefcaseBusiness className="size-5 text-primary" /><div><h3 className="text-lg font-bold">{pick("Employee information", "بيانات الموظف")}</h3><p className="text-sm text-muted-foreground">{pick("Managed by management and read-only for employees.", "هذه البيانات يتم تعديلها من المدير فقط.")}</p></div></div><Button variant="outline" size="sm" onClick={() => void loadEmployee()} disabled={employeeLoading || employeeQueryLoading}><RefreshCw className={`me-1.5 size-4 ${(employeeLoading || employeeQueryLoading) ? "animate-spin" : ""}`} />{pick("Refresh", "تحديث")}</Button></div>{employeeInfo ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="rounded-xl border p-4"><span className="text-xs text-muted-foreground">{pick("Employee ID", "رقم ID الموظف")}</span><p className="mt-1 font-semibold">{employeeInfo.employee_id || "—"}</p></div><div className="rounded-xl border p-4"><span className="text-xs text-muted-foreground">{pick("Full name", "الاسم كامل")}</span><p className="mt-1 font-semibold">{employeeInfo.full_name || "—"}</p></div><div className="rounded-xl border p-4"><span className="text-xs text-muted-foreground">{pick("Job title", "المسمى الوظيفي")}</span><p className="mt-1 font-semibold">{employeeInfo.job_title || "—"}</p></div></div> : <div className="rounded-xl border p-5 text-sm text-muted-foreground">{employeeLoading || employeeQueryLoading ? pick("Loading employee information...", "جاري تحميل بيانات الموظف...") : pick("No employee information is linked to this account yet.", "لا توجد بيانات موظف مرتبطة بهذا الحساب حتى الآن.")}</div>}</section>}
    {currentOrder ? <section className="panel mt-6 overflow-hidden p-0"><div className="border-b bg-primary/5 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-muted-foreground">{pick("Current order", "الطلب الحالي")}</p><h3 className="mt-1 text-xl font-bold">{currentOrder.title || pick("Car wash order", "طلب غسيل سيارة")}</h3></div><Badge className="px-3 py-1">{pick(currentStage.en, currentStage.ar)}</Badge></div></div><div className="p-6"><div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><span className="text-xs text-muted-foreground">{pick("Order number", "رقم الطلب")}</span><p className="mt-1 font-semibold">{currentOrder.serial_number ? `#${currentOrder.serial_number}` : String(currentOrder.id).slice(0, 8)}</p></div><div><span className="text-xs text-muted-foreground">{pick("Scheduled", "الموعد")}</span><p className="mt-1 font-semibold">{currentOrder.scheduled_at ? fmtDate(currentOrder.scheduled_at) : "—"}</p></div><div><span className="text-xs text-muted-foreground">{pick("Payment", "الدفع")}</span><p className="mt-1 font-semibold">{currentOrder.payment_status || "—"}</p></div><div><span className="text-xs text-muted-foreground">{pick("Last update", "آخر تحديث")}</span><p className="mt-1 font-semibold">{currentOrder.updated_at ? fmtDate(currentOrder.updated_at) : "—"}</p></div></div><div className="space-y-3">{orderStages.map((stage, i) => { const done = i <= currentIndex; const activeStage = i === currentIndex; return <div key={stage.key} className="flex items-center gap-3"><div className={`flex size-9 shrink-0 items-center justify-center rounded-full border ${done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}>{stage.icon}</div><div className={`flex-1 rounded-xl px-3 py-2 ${activeStage ? "bg-primary/10 font-bold" : done ? "text-foreground" : "text-muted-foreground"}`}><p>{pick(stage.en, stage.ar)}</p>{activeStage && <p className="mt-0.5 text-xs font-normal text-primary">{pick("Current status", "الحالة الحالية")}</p>}</div></div>; })}</div></div></section> : null}
    {sub ? <div className="panel mt-6 p-6"><div className="flex items-center justify-between text-sm"><span className="font-semibold">{t("used_washes")}</span><span className="text-muted-foreground">{used} / {total}</span></div><Progress value={total ? used / total * 100 : 0} className="mt-3" /><div className="mt-6 grid gap-4 sm:grid-cols-2"><div><p className="text-xs uppercase tracking-widest text-muted-foreground">{t("start_date")}</p><p className="mt-1 font-semibold">{fmtDate(sub.start_date)}</p></div><div><p className="text-xs uppercase tracking-widest text-muted-foreground">{t("end_date")}</p><p className="mt-1 font-semibold">{fmtDate(sub.end_date)}</p></div></div></div> : <div className="panel mt-6 p-8 text-center"><h3 className="text-xl font-bold">{t("no_subscription")}</h3><p className="mt-2 text-sm text-muted-foreground">{t("no_subscription_d")}</p><Button asChild className="mt-5"><Link to="/packages">{t("hero_cta")}</Link></Button></div>}
  </div></div>;
}
