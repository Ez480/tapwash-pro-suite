import { createFileRoute } from "@tanstack/react-router";
import { Download, Camera, Truck, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { StatCard } from "@/components/app/Shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";
import { downloadCustomersExcel } from "@/lib/admin-export";
import { NfcCheckin } from "@/components/admin/NfcCheckin";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminOverview });
type Task = Record<string, any>;
type Photo = { id: string; task_id: string; kind: string; url: string; created_at: string };

function AdminOverview() {
  const { t, fmtDate, fmtMoney, pick } = useI18n();
  const { data: customers } = useAdminTable("profiles", "*", "created_at");
  const { data: subs } = useAdminTable("subscriptions", "*, packages(title_en,title_ar)", "created_at");
  const { data: washes } = useAdminTable("washes", "*", "washed_at");
  const { data: payments } = useAdminTable("payments", "*", "paid_at");
  const { data: cards } = useAdminTable("nfc_cards", "*", "created_at");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const loadLive = async () => {
    const [{ data: taskData, error: taskError }, { data: photoData, error: photoError }] = await Promise.all([
      (supabase as any).from("employee_tasks").select("*").order("updated_at", { ascending: false }).limit(30),
      (supabase as any).from("order_photos").select("id,task_id,kind,url,created_at").order("created_at", { ascending: false }).limit(200),
    ]);
    if (taskError) toast.error(taskError.message);
    if (photoError) toast.error(photoError.message);
    setTasks(taskData ?? []); setPhotos(photoData ?? []);
  };

  useEffect(() => { void loadLive(); const channel = supabase.channel("manager-live-operations").on("postgres_changes", { event: "*", schema: "public", table: "employee_tasks" }, () => void loadLive()).on("postgres_changes", { event: "*", schema: "public", table: "order_photos" }, () => void loadLive()).subscribe(); return () => { void supabase.removeChannel(channel); }; }, []);

  const visibleTasks = useMemo(() => tasks.filter((task) => String(task.status ?? "").toLowerCase() !== "completed"), [tasks]);
  const selectedTask = useMemo(() => visibleTasks.find((task) => String(task.id) === selectedTaskId) ?? null, [visibleTasks, selectedTaskId]);
  const selectedPhotos = useMemo(() => photos.filter((photo) => String(photo.task_id) === selectedTaskId), [photos, selectedTaskId]);
  const beforePhotos = selectedPhotos.filter((photo) => photo.kind === "before");
  const afterPhotos = selectedPhotos.filter((photo) => photo.kind === "after");
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const washesMonth = (washes ?? []).filter((w) => new Date(String(w.washed_at)) >= monthStart).length;
  const revenueMonth = (payments ?? []).filter((p) => p.status === "paid" && new Date(String(p.paid_at || p.created_at)) >= monthStart).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const activeSubs = (subs ?? []).filter((s) => s.status === "active").length;
  const assigned = (cards ?? []).filter((c) => c.status === "assigned").length;
  const available = (cards ?? []).filter((c) => c.status === "available").length;
  const exportCustomers = async () => { try { const [ordersResult, cardsResult] = await Promise.all([supabase.from("booking_requests").select("*").order("created_at", { ascending: false }), supabase.from("nfc_cards").select("*").order("created_at", { ascending: false })]); if (ordersResult.error) throw ordersResult.error; if (cardsResult.error) throw cardsResult.error; downloadCustomersExcel({ customers: (customers ?? []) as Record<string, unknown>[], orders: (ordersResult.data ?? []) as Record<string, unknown>[], cards: (cardsResult.data ?? []) as Record<string, unknown>[] }); toast.success("تم تصدير بيانات العملاء والأوردرات والكروت إلى ملف Excel."); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تصدير البيانات"); } };
  const statusLabel = (status: string) => ({ pending: "قيد الانتظار", accepted: "تم الاستلام", in_progress: "جاري التنفيذ", completed: "مكتمل" } as Record<string, string>)[status] ?? status;
  const deliveryLabel = (status: string) => ({ not_started: "لم يبدأ الدليفري", picked_up: "تم الاستلام", on_the_way: "في الطريق", delivered: "تم التسليم", cancelled: "ملغي" } as Record<string, string>)[status] ?? status;
  return <div>
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-white/45 bg-white/20 p-4 text-foreground shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_8px_30px_rgba(0,0,0,0.22)] sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-lg font-bold">إدارة بيانات العملاء</h2><p className="text-sm text-muted-foreground">تصدير بيانات العملاء الكاملة، الأوردرات السابقة، وكروت NFC.</p></div><Button onClick={exportCustomers} className="gap-2"><Download className="size-4" />تصدير Excel</Button></div>
    <NfcCheckin />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl border border-sky-300/45 bg-sky-200/25 p-1 shadow-[0_8px_24px_rgba(14,165,233,0.10)] backdrop-blur-xl dark:border-sky-200/15 dark:bg-sky-300/[0.08]"><StatCard tone="default" label={t("total_customers")} value={(customers ?? []).length} /></div><div className="rounded-2xl border border-amber-300/45 bg-amber-200/25 p-1 shadow-[0_8px_24px_rgba(245,158,11,0.10)] backdrop-blur-xl dark:border-amber-200/15 dark:bg-amber-300/[0.08]"><StatCard tone="default" label={t("active_subs")} value={activeSubs} /></div><StatCard label={t("washes_month")} value={washesMonth} /><StatCard label={t("revenue_month")} value={fmtMoney(revenueMonth)} /><StatCard label={t("assigned_cards")} value={assigned} /><StatCard label={t("available_cards")} value={available} /><StatCard label={t("a_packages")} value={new Set((subs ?? []).map((s) => s.package_id)).size} /><StatCard label={t("total_washes")} value={(washes ?? []).length} /></div>
    <section className="panel mt-8 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-lg font-bold"><Truck className="size-5 text-primary" />متابعة الأوردرات والدليفري لايف</h3><p className="text-sm text-muted-foreground">اضغط على أي أوردر لعرض تفاصيله وصوره. التحديثات تظهر فورًا بدون Refresh.</p></div><Button size="sm" variant="outline" onClick={() => void loadLive()}><RefreshCw className="me-1 size-4" />تحديث</Button></div><div className="mt-4 grid gap-3 lg:grid-cols-2">{visibleTasks.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد أوردرات موظفين نشطة حاليًا.</p> : null}{visibleTasks.slice(0, 20).map((task) => { const taskPhotos = photos.filter((photo) => String(photo.task_id) === String(task.id)); return <button key={String(task.id)} type="button" onClick={() => setSelectedTaskId(String(task.id))} className="w-full rounded-xl border bg-card p-4 text-start transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"><div className="flex flex-wrap items-center gap-2"><b>{task.title || "Order"}</b><Badge>{statusLabel(String(task.status ?? ""))}</Badge><Badge variant="outline">{deliveryLabel(String(task.delivery_status ?? ""))}</Badge>{task.serial_number ? <span className="text-xs text-muted-foreground">#{task.serial_number}</span> : null}</div><p className="mt-1 text-sm text-muted-foreground">{task.customer_name || "—"}</p><div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>آخر تحديث: {fmtDate(task.updated_at)}</span><span>{taskPhotos.length} صورة</span></div></button>; })}</div></section>
    <Dialog open={Boolean(selectedTask)} onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">{selectedTask ? <><DialogHeader><DialogTitle>{selectedTask.title || "تفاصيل الأوردر"}</DialogTitle><DialogDescription>المتابعة الحية للأوردر والصور الخاصة به.</DialogDescription></DialogHeader><div className="grid gap-3 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3"><div><span className="text-xs text-muted-foreground">العميل</span><p className="font-semibold">{selectedTask.customer_name || "—"}</p></div><div><span className="text-xs text-muted-foreground">رقم الأوردر</span><p className="font-semibold">{selectedTask.serial_number ? `#${selectedTask.serial_number}` : selectedTask.id}</p></div><div><span className="text-xs text-muted-foreground">آخر تحديث</span><p className="font-semibold">{fmtDate(selectedTask.updated_at)}</p></div><div><span className="text-xs text-muted-foreground">حالة الغسيل</span><p className="font-semibold">{statusLabel(String(selectedTask.status ?? ""))}</p></div><div><span className="text-xs text-muted-foreground">حالة الدليفري</span><p className="font-semibold">{deliveryLabel(String(selectedTask.delivery_status ?? ""))}</p></div>{selectedTask.employee_id ? <div><span className="text-xs text-muted-foreground">الموظف</span><p className="font-semibold">{selectedTask.employee_id}</p></div> : null}</div><div><div className="mb-3 flex items-center gap-2"><Camera className="size-5 text-primary" /><h4 className="font-bold">صور هذا الأوردر</h4></div><div className="grid gap-4 sm:grid-cols-2"><div><h5 className="mb-2 font-semibold">قبل الغسيل</h5>{beforePhotos.map((photo) => <img key={photo.id} src={photo.url} alt="قبل الغسيل" className="mb-3 w-full rounded-xl border object-cover" />)}</div><div><h5 className="mb-2 font-semibold">بعد التنظيف</h5>{afterPhotos.map((photo) => <img key={photo.id} src={photo.url} alt="بعد التنظيف" className="mb-3 w-full rounded-xl border object-cover" />)}</div></div></div></> : null}</DialogContent></Dialog>
    <div className="mt-8 grid gap-6 lg:grid-cols-2"><section className="panel p-6"><h3 className="text-lg font-bold">{t("recent_washes")}</h3><div className="mt-4 space-y-2 text-sm">{(washes ?? []).slice(0, 8).map((w) => <div key={String(w.id)} className="flex items-center justify-between rounded-lg border border-border px-4 py-3"><span>{fmtDate(String(w.washed_at))}</span><span className="text-muted-foreground">{String(w.branch ?? "—")}</span></div>)}{(washes ?? []).length === 0 ? <p className="text-muted-foreground">{t("empty")}</p> : null}</div></section><section className="panel p-6"><h3 className="text-lg font-bold">{t("recent_payments")}</h3><div className="mt-4 space-y-2 text-sm">{(payments ?? []).slice(0, 8).map((p) => <div key={String(p.id)} className="flex items-center justify-between rounded-lg border border-border px-4 py-3"><span>{fmtDate(String(p.paid_at))}</span><span className="font-semibold">{fmtMoney(Number(p.amount ?? 0))}</span></div>)}{(payments ?? []).length === 0 ? <p className="text-muted-foreground">{t("empty")}</p> : null}</div></section></div>
    <section className="panel mt-6 p-6"><h3 className="text-lg font-bold">{t("a_subscriptions")}</h3><div className="mt-4 space-y-2 text-sm">{(subs ?? []).slice(0, 8).map((s) => { const pkg = s.packages as { title_en?: string; title_ar?: string } | null; return <div key={String(s.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3"><span className="font-medium">{pkg ? pick(pkg.title_en ?? "", pkg.title_ar ?? "") : "—"}</span><span className="text-muted-foreground">{String(s.used_washes ?? 0)} / {String(s.total_washes ?? 0)}</span><span className="text-muted-foreground">{fmtDate(String(s.end_date))}</span></div>; })}{(subs ?? []).length === 0 ? <p className="text-muted-foreground">{t("empty")}</p> : null}</div></section>
  </div>;
}
