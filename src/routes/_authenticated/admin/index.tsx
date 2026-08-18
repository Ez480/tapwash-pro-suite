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

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminOverview });

function AdminOverview() {
  const { t, fmtDate, fmtMoney, pick } = useI18n();
  const { data: customers } = useAdminTable("profiles", "*", "created_at");
  const { data: subs } = useAdminTable("subscriptions", "*, packages(title_en,title_ar)", "created_at");
  const { data: washes } = useAdminTable("washes", "*", "washed_at");
  const { data: payments } = useAdminTable("payments", "*", "paid_at");
  const { data: cards } = useAdminTable("nfc_cards", "*", "created_at");
  const [tasks, setTasks] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const loadLive = async () => {
    const [{ data: taskData, error: taskError }, { data: photoData, error: photoError }] = await Promise.all([
      (supabase as any).from("employee_tasks").select("*").order("updated_at", { ascending: false }).limit(30),
      (supabase as any).from("order_photos").select("id,task_id,kind,url,created_at").order("created_at", { ascending: false }).limit(200),
    ]);
    if (taskError) toast.error(taskError.message);
    if (photoError) toast.error(photoError.message);
    setTasks(taskData ?? []);
    setPhotos(photoData ?? []);
  };

  useEffect(() => {
    void loadLive();
    const channel = supabase
      .channel("manager-live-operations")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_tasks" }, () => void loadLive())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_photos" }, () => void loadLive())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const selectedTask = useMemo(() => tasks.find((task) => String(task.id) === selectedTaskId) ?? null, [tasks, selectedTaskId]);
  const selectedPhotos = useMemo(() => photos.filter((photo) => String(photo.task_id) === selectedTaskId), [photos, selectedTaskId]);

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const washesMonth = (washes ?? []).filter((w) => new Date(String(w.washed_at)) >= monthStart).length;
  const revenueMonth = (payments ?? []).filter((p) => new Date(String(p.paid_at)) >= monthStart).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const activeSubs = (subs ?? []).filter((s) => s.status === "active").length;
  const assigned = (cards ?? []).filter((c) => c.status === "assigned").length;
  const available = (cards ?? []).filter((c) => c.status === "available").length;

  const exportCustomers = async () => {
    try {
      const [ordersResult, cardsResult] = await Promise.all([
        supabase.from("booking_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("nfc_cards").select("*").order("created_at", { ascending: false }),
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (cardsResult.error) throw cardsResult.error;
      downloadCustomersExcel({ customers: (customers ?? []) as Record<string, unknown>[], orders: (ordersResult.data ?? []) as Record<string, unknown>[], cards: (cardsResult.data ?? []) as Record<string, unknown>[] });
      toast.success("تم تصدير بيانات العملاء والأوردرات والكروت إلى ملف Excel.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تصدير البيانات"); }
  };

  const statusLabel = (status: string) => ({ pending: "قيد الانتظار", accepted: "تم الاستلام", in_progress: "جاري التنفيذ", completed: "مكتمل" } as Record<string,string>)[status] ?? status;
  const deliveryLabel = (status: string) => ({ not_started: "لم يبدأ الدليفري", picked_up: "تم الاستلام", on_the_way: "في الطريق", delivered: "تم التسليم", cancelled: "ملغي" } as Record<string,string>)[status] ?? status;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-display text-lg font-bold">إدارة بيانات العملاء</h2><p className="text-sm text-muted-foreground">تصدير بيانات العملاء الكاملة، الأوردرات السابقة، وكروت NFC.</p></div>
        <Button onClick={exportCustomers} className="gap-2"><Download className="size-4" />تصدير Excel</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard tone="ink" label={t("total_customers")} value={(customers ?? []).length} />
        <StatCard tone="primary" label={t("active_subs")} value={activeSubs} />
        <StatCard label={t("washes_month")} value={washesMonth} />
        <StatCard label={t("revenue_month")} value={fmtMoney(revenueMonth)} />
        <StatCard label={t("assigned_cards")} value={assigned} />
        <StatCard label={t("available_cards")} value={available} />
        <StatCard label={t("a_packages")} value={new Set((subs ?? []).map((s) => s.package_id)).size} />
        <StatCard label={t("total_washes")} value={(washes ?? []).length} />
      </div>

      <section className="panel mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="flex items-center gap-2 text-lg font-bold"><Truck className="size-5 text-primary" />متابعة الأوردرات والدليفري لايف</h3><p className="text-sm text-muted-foreground">اضغط على أي أوردر لعرض تفاصيله وصوره. التحديثات تظهر فورًا بدون Refresh.</p></div>
          <Button size="sm" variant="outline" onClick={() => void loadLive()}><RefreshCw className="me-1 size-4" />تحديث</Button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {tasks.length === 0 && <p className="text-sm text-muted-foreground">لا توجد أوردرات موظفين حاليًا.</p>}
          {tasks.slice(0, 20).map((task) => {
            const taskPhotos = photos.filter((photo) => String(photo.task_id) === String(task.id));
            return (
              <button key={task.id} type="button" onClick={() => setSelectedTaskId(String(task.id))} className="w-full rounded-xl border bg-card p-4 text-start transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary">
                <div className="flex flex-wrap items-center gap-2"><b>{task.title || "Order"}</b><Badge>{statusLabel(task.status)}</Badge><Badge variant="outline">{deliveryLabel(task.delivery_status)}</Badge>{task.serial_number && <span className="text-xs text-muted-foreground">#{task.serial_number}</span>}</div>
                <p className="mt-1 text-sm text-muted-foreground">{task.customer_name || "—"}</p>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>آخر تحديث: {fmtDate(task.updated_at)}</span><span>{taskPhotos.length} صورة</span></div>
              </button>
            );
          })}
        </div>
      </section>

      <Dialog open={Boolean(selectedTask)} onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          {selectedTask && <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">{selectedTask.title || "تفاصيل الأوردر"}<Badge>{statusLabel(selectedTask.status)}</Badge><Badge variant="outline">{deliveryLabel(selectedTask.delivery_status)}</Badge></DialogTitle>
              <DialogDescription>المتابعة الحية للأوردر والصور الخاصة به.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div><span className="text-xs text-muted-foreground">العميل</span><p className="font-semibold">{selectedTask.customer_name || "—"}</p></div>
              <div><span className="text-xs text-muted-foreground">رقم الأوردر</span><p className="font-semibold">{selectedTask.serial_number ? `#${selectedTask.serial_number}` : selectedTask.id}</p></div>
              <div><span className="text-xs text-muted-foreground">آخر تحديث</span><p className="font-semibold">{fmtDate(selectedTask.updated_at)}</p></div>
              <div><span className="text-xs text-muted-foreground">حالة الغسيل</span><p className="font-semibold">{statusLabel(selectedTask.status)}</p></div>
              <div><span className="text-xs text-muted-foreground">حالة الدليفري</span><p className="font-semibold">{deliveryLabel(selectedTask.delivery_status)}</p></div>
              {selectedTask.employee_id && <div><span className="text-xs text-muted-foreground">الموظف</span><p className="font-semibold">{selectedTask.employee_id}</p></div>}
              {selectedTask.address && <div className="sm:col-span-2 lg:col-span-3"><span className="text-xs text-muted-foreground">العنوان</span><p className="font-semibold">{selectedTask.address}</p></div>}
              {selectedTask.notes && <div className="sm:col-span-2 lg:col-span-3"><span className="text-xs text-muted-foreground">ملاحظات</span><p className="font-semibold">{selectedTask.notes}</p></div>}
            </div>
            <div>
              <div className="mb-3 flex items-center gap-2"><Camera className="size-5 text-primary" /><h4 className="font-bold">صور هذا الأوردر</h4><Badge variant="outline">{selectedPhotos.length}</Badge></div>
              {selectedPhotos.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">لم يتم رفع صور لهذا الأوردر حتى الآن.</p> : <div className="grid gap-4 sm:grid-cols-2"><div><h5 className="mb-2 font-semibold">قبل الغسيل</h5><div className="grid gap-3">{selectedPhotos.filter((p) => p.kind === "before").map((p) => <img key={p.id} src={p.url} alt="قبل الغسيل" className="w-full rounded-xl border object-cover" />)}{selectedPhotos.filter((p) => p.kind === "before").length === 0 && <p className="text-sm text-muted-foreground">لا توجد صورة.</p>}</div></div><div><h5 className="mb-2 font-semibold">بعد التنظيف</h5><div className="grid gap-3">{selectedPhotos.filter((p) => p.kind === "after").map((p) => <img key={p.id} src={p.url} alt="بعد التنظيف" className="w-full rounded-xl border object-cover" />)}{selectedPhotos.filter((p) => p.kind === "after").length === 0 && <p className="text-sm text-muted-foreground">لا توجد صورة.</p></div></div></div>}
            </div>
          </>}
        </DialogContent>
      </Dialog>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="panel p-6"><h3 className="text-lg font-bold">{t("recent_washes")}</h3><div className="mt-4 space-y-2 text-sm">{(washes ?? []).slice(0, 8).map((w) => <div key={String(w.id)} className="flex items-center justify-between rounded-lg border border-border px-4 py-3"><span>{fmtDate(String(w.washed_at))}</span><span className="text-muted-foreground">{String(w.branch ?? "—")}</span></div>)}{(washes ?? []).length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}</div></section>
        <section className="panel p-6"><h3 className="text-lg font-bold">{t("recent_payments")}</h3><div className="mt-4 space-y-2 text-sm">{(payments ?? []).slice(0, 8).map((p) => <div key={String(p.id)} className="flex items-center justify-between rounded-lg border border-border px-4 py-3"><span>{fmtDate(String(p.paid_at))}</span><span className="font-semibold">{fmtMoney(Number(p.amount ?? 0))}</span></div>)}{(payments ?? []).length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}</div></section>
      </div>

      <section className="panel mt-6 p-6"><h3 className="text-lg font-bold">{t("a_subscriptions")}</h3><div className="mt-4 space-y-2 text-sm">{(subs ?? []).slice(0, 8).map((s) => { const pkg = s.packages as { title_en?: string; title_ar?: string } | null; return <div key={String(s.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3"><span className="font-medium">{pkg ? pick(pkg.title_en ?? "", pkg.title_ar ?? "") : "—"}</span><span className="text-muted-foreground">{String(s.used_washes ?? 0)} / {String(s.total_washes ?? 0)}</span><span className="text-muted-foreground">{fmtDate(String(s.end_date))}</span></div>; })}{(subs ?? []).length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}</div></section>
    </div>
  );
}
