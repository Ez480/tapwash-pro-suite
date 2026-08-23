import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CarFront, Clock3, Search, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/scheduled-orders")({ component: AdminScheduledOrders });

function cairoToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function cairoDayBounds(date: string) {
  const start = new Date(`${date}T00:00:00+03:00`);
  const end = new Date(`${date}T23:59:59.999+03:00`);
  return { start: start.toISOString(), end: end.toISOString() };
}

function AdminScheduledOrders() {
  const { pick, fmtDate } = useI18n();
  const [selectedDate, setSelectedDate] = useState(cairoToday());
  const [tasks, setTasks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: profiles = [] } = useAdminTable("profiles", "*", "created_at");
  const { data: cars = [] } = useAdminTable("cars", "*", "created_at");

  const load = async () => {
    setLoading(true);
    try {
      const { start, end } = cairoDayBounds(selectedDate);
      const { data, error } = await (supabase as any)
        .from("employee_tasks")
        .select("*")
        .not("scheduled_at", "is", null)
        .gte("scheduled_at", start)
        .lte("scheduled_at", end)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      setTasks(data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [selectedDate]);
  useEffect(() => {
    const scheduleReload = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => { reloadTimer.current = null; void load(); }, 250);
    };
    const channel = supabase.channel("admin-scheduled-orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_tasks" }, scheduleReload)
      .subscribe();
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  const q = search.trim().toLowerCase();
  const filteredTasks = useMemo(() => tasks.filter((task: any) => !q || JSON.stringify(task).toLowerCase().includes(q)), [tasks, q]);
  const employee = (task: any) => profiles.find((p: any) => p.id === task.employee_id);
  const car = (task: any) => cars.find((c: any) => c.id === task.car_id);
  const carLabel = (c: any) => c ? [c.brand, c.model, c.color, c.plate_number].filter(Boolean).join(" · ") || "—" : "—";
  const orderType = (task: any) => task.subscription_id ? pick("Subscription", "اشتراك") : task.offer_id ? pick("Offer", "عرض") : pick("Service order", "أوردر خدمة");

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><span className="inline-flex size-11 items-center justify-center rounded-2xl border border-white/50 bg-white/35 text-primary shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/10"><CalendarDays className="size-5"/></span><div><h1 className="text-2xl font-bold">{pick("Scheduled orders", "أوردارات مجدولة")}</h1><p className="text-sm text-muted-foreground">{pick("Orders scheduled for the selected execution date.", "كل الأوردرات التي حدد المدير لها موعد تنفيذ في التاريخ المختار.")}</p></div></div>
      <div className="flex items-center gap-2"><label htmlFor="scheduled-date" className="text-sm font-semibold">{pick("Execution date", "تاريخ التنفيذ")}</label><Input id="scheduled-date" type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="w-auto"/></div>
    </div>

    <div className="relative"><Search className="absolute start-3 top-3 size-4 text-muted-foreground"/><Input className="ps-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder={pick("Search scheduled orders", "ابحث في الأوردرات المجدولة")}/></div>

    <div className="grid gap-4 sm:grid-cols-3"><div className="panel p-5"><p className="text-sm text-muted-foreground">{pick("Selected date", "التاريخ المحدد")}</p><p className="mt-2 text-lg font-bold">{selectedDate}</p></div><div className="panel p-5"><p className="text-sm text-muted-foreground">{pick("Scheduled orders", "الأوردرات المجدولة")}</p><p className="mt-2 text-3xl font-bold">{filteredTasks.length}</p></div><div className="panel p-5"><p className="text-sm text-muted-foreground">{pick("Completed", "تم التنفيذ")}</p><p className="mt-2 text-3xl font-bold">{filteredTasks.filter((x:any)=>x.status==="completed").length}</p></div></div>

    <section className="panel p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{pick("Orders for this execution date", "أوردرات تاريخ التنفيذ")}</h2>{loading&&<span className="text-sm text-muted-foreground">{pick("Loading…", "جاري التحميل…")}</span>}</div>
      <div className="space-y-4">
        {filteredTasks.map((x:any)=>{const emp=employee(x);const c=car(x);return <article key={x.id} className="rounded-2xl border border-border p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><b className="text-lg">#{x.serial_number || x.id.slice(0,8)}</b><Badge variant={x.subscription_id ? "default" : "secondary"}>{orderType(x)}</Badge><Badge variant="outline">{x.status || "pending"}</Badge></div><div className="mt-2 font-semibold">{x.customer_name || "—"}</div><div className="text-sm text-muted-foreground">{x.customer_phone || "—"} · {x.customer_email || "—"}</div></div><div className="rounded-xl border bg-muted/30 px-3 py-2 text-sm font-semibold"><Clock3 className="me-1 inline size-4"/>{x.scheduled_at ? `${fmtDate(x.scheduled_at)} · ${new Date(x.scheduled_at).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}` : "—"}</div></div>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><b>{pick("Order number", "رقم الأوردر")}:</b> {x.serial_number || x.id}</div>
            <div><b>{pick("Customer name", "اسم العميل")}:</b> {x.customer_name || "—"}</div>
            <div><b>{pick("Customer phone", "رقم العميل")}:</b> {x.customer_phone || "—"}</div>
            <div><b>Email:</b> {x.customer_email || "—"}</div>
            <div><b>{pick("Order type", "نوع الأوردر")}:</b> {orderType(x)}</div>
            <div><b>{pick("Package / offer", "الباقة / العرض")}:</b> {x.offer_name || x.package_name || x.wash_type || "—"}</div>
            <div><b>{pick("Amount", "المبلغ")}:</b> {Number(x.collection_amount ?? x.amount ?? 0).toFixed(2)} EGP</div>
            <div><b>{pick("Payment", "الدفع")}:</b> {x.payment_method || "—"} · {x.payment_status || "—"}</div>
            <div className="sm:col-span-2"><b>{pick("Car details", "تفاصيل العربية")}:</b> {c ? <span className="inline-flex items-center gap-1"><CarFront className="ms-1 inline size-4"/>{carLabel(c)}</span> : "—"}</div>
            <div className="sm:col-span-2"><b>{pick("Employee", "الموظف")}:</b> <span className="inline-flex items-center gap-1"><UserRound className="ms-1 inline size-4"/>{emp?.full_name || emp?.email || x.employee_name || "—"} · ID: {x.employee_id || "—"}</span></div>
            <div className="sm:col-span-2"><b>{pick("Address", "العنوان")}:</b> {x.location_text || x.address || "—"}</div>
            <div className="sm:col-span-2 lg:col-span-4"><b>{pick("Notes", "ملاحظات")}:</b> {x.notes || "—"}</div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">{x.created_at ? `${pick("Order created", "وقت إنشاء الأوردر")}: ${new Date(x.created_at).toLocaleString()}` : ""}</div>
        </article>})}
        {!loading&&!filteredTasks.length&&<div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{pick("No scheduled orders for this date.", "لا توجد أوردرات مجدولة في هذا التاريخ.")}</div>}
      </div>
    </section>
  </div>;
}
