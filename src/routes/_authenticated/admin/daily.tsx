import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Search, Archive, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/daily")({ component: AdminDaily });

function AdminDaily() {
  const { pick, fmtDate } = useI18n();
  const [tasks, setTasks] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    const start = `${today}T00:00:00.000Z`, end = `${today}T23:59:59.999Z`;
    const [{ data: t }, { data: b }, { data: p }] = await Promise.all([
      supabase.from("employee_tasks").select("*").gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }),
      supabase.from("booking_requests").select("*").gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }),
      supabase.from("payments").select("*").gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }),
    ]);
    setTasks(t ?? []); setBookings(b ?? []); setPayments(p ?? []);
  };

  useEffect(() => {
    void load();
    const c = supabase.channel("admin-daily-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_tasks" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_requests" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(c); };
  }, []);

  const q = search.trim().toLowerCase();
  const match = (x: any) => !q || JSON.stringify(x).toLowerCase().includes(q);
  const filteredTasks = useMemo(() => tasks.filter(match), [tasks, q]);
  const filteredBookings = useMemo(() => bookings.filter(match), [bookings, q]);
  const filteredPayments = useMemo(() => payments.filter(match), [payments, q]);

  const confirmManualPayment = async (r: any) => {
    if (String(r.payment_status) !== "awaiting_proof") return;
    const { error } = await (supabase as any).from("booking_requests").update({ payment_status: "paid" }).eq("id", r.id).eq("payment_status", "awaiting_proof");
    if (error) return toast.error(error.message);
    toast.success(pick("Payment confirmed", "تم تأكيد الدفع"));
    void load();
  };

  const rejectManualPayment = async (r: any) => {
    if (String(r.payment_status) !== "awaiting_proof") return;
    const { error } = await (supabase as any).from("booking_requests").update({ payment_status: "rejected" }).eq("id", r.id).eq("payment_status", "awaiting_proof");
    if (error) return toast.error(error.message);
    toast.success(pick("Payment rejected", "تم رفض الدفع"));
    void load();
  };

  const paymentLabel = (method: any) => method === "cash" ? pick("Cash", "كاش") : method === "smart_wallet" ? pick("Smart Wallet", "محفظة") : method === "instapay" ? "InstaPay" : method === "bank_transfer" ? pick("Bank transfer", "تحويل بنكي") : method || "—";

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="flex items-center gap-2"><CalendarDays className="size-6 text-primary"/><h1 className="text-2xl font-bold">{pick("Today", "طلبات اليوم")}</h1></div><p className="text-sm text-muted-foreground">{today}</p></div>
      <Button asChild variant="outline"><a href="/admin/archive"><Archive className="me-2 size-4"/>{pick("Archive & search", "الأرشيف والبحث")}</a></Button>
    </div>
    <div className="relative"><Search className="absolute start-3 top-3 size-4 text-muted-foreground"/><Input className="ps-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder={pick("Search today's orders, bookings or payments", "ابحث في أوردرات وطلبات ومدفوعات اليوم")}/></div>
    <div className="grid gap-4 sm:grid-cols-3"><div className="panel p-5"><p className="text-sm text-muted-foreground">{pick("Orders", "الأوردرات")}</p><p className="mt-2 text-3xl font-bold">{filteredTasks.length}</p></div><div className="panel p-5"><p className="text-sm text-muted-foreground">{pick("Booking requests", "طلبات الحجز")}</p><p className="mt-2 text-3xl font-bold">{filteredBookings.length}</p></div><div className="panel p-5"><p className="text-sm text-muted-foreground">{pick("Payments", "المدفوعات")}</p><p className="mt-2 text-3xl font-bold">{filteredPayments.length}</p></div></div>

    <section className="panel p-5"><h2 className="font-bold">{pick("Today's orders", "أوردرات اليوم")}</h2><div className="mt-4 space-y-3">
      {filteredTasks.map(x=><article key={x.id} className="rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><b className="text-lg">#{x.serial_number || x.id.slice(0,8)}</b><div className="mt-1 font-semibold">{x.customer_name || "—"}</div><div className="text-sm text-muted-foreground">{x.customer_phone || "—"} · {x.title || "—"}</div></div><span className="rounded-full bg-muted px-3 py-1 text-xs">{x.status || "pending"}</span></div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><b>رقم الأوردر:</b> {x.serial_number || x.id}</div>
          <div><b>اسم العميل:</b> {x.customer_name || "—"}</div>
          <div><b>رقم العميل:</b> {x.customer_phone || "—"}</div>
          <div><b>الإيميل:</b> {x.customer_email || "—"}</div>
          <div><b>الباقة:</b> {x.package_name || x.offer_name || x.wash_type || "—"}</div>
          <div><b>المبلغ:</b> {Number(x.collection_amount ?? x.amount ?? 0).toFixed(2)} EGP</div>
          <div><b>الدفع:</b> {paymentLabel(x.payment_method)} · {x.payment_status || "—"}</div>
          <div><b>موعد الغسيل:</b> {x.scheduled_at ? `${fmtDate(x.scheduled_at)} · ${new Date(x.scheduled_at).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}` : "—"}</div>
          <div className="sm:col-span-2"><b>الموظف:</b> {x.employee_name || x.assigned_employee_name || x.employee_full_name || "—"} · ID: {x.employee_id || x.assigned_employee_id || "—"}</div>
          <div className="sm:col-span-2"><b>العنوان:</b> {x.location_text || x.address || "—"}</div>
          <div className="sm:col-span-2 lg:col-span-4"><b>ملاحظات:</b> {x.notes || "—"}</div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">{x.created_at ? `${pick("Order time", "وقت إنشاء الأوردر")}: ${new Date(x.created_at).toLocaleString()}` : ""}</div>
      </article>)}
      {!filteredTasks.length&&<p className="text-sm text-muted-foreground">{pick("No orders today", "لا توجد أوردرات اليوم")}</p>}
    </div></section>

    <section className="panel p-5"><h2 className="font-bold">{pick("Today's booking requests", "طلبات حجز اليوم")}</h2><div className="mt-4 space-y-3">
      {filteredBookings.map(x=><div key={x.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><b>#{x.id.slice(0,8)}</b> · {x.customer_name || x.name || "—"}<div className="mt-1 text-sm text-muted-foreground">{x.customer_phone || "—"} · {x.customer_email || "—"}</div></div><div className="flex gap-2"><span className="rounded-full bg-muted px-3 py-1 text-xs">{x.status || "pending"}</span>{x.payment_status && <span className="rounded-full bg-muted px-3 py-1 text-xs">{x.payment_status}</span>}</div></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><b>{pick("Request date/time", "تاريخ ووقت الطلب")}:</b> {x.created_at ? `${fmtDate(x.created_at)} · ${new Date(x.created_at).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}` : "—"}</div><div><b>{pick("Wash appointment", "موعد الغسيل")}:</b> {x.scheduled_at ? `${fmtDate(x.scheduled_at)} · ${new Date(x.scheduled_at).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}` : "—"}</div><div><b>{pick("Amount", "المبلغ")}:</b> {Number(x.amount ?? 0).toFixed(2)} EGP</div><div><b>{pick("Payment", "الدفع")}:</b> {paymentLabel(x.payment_method)} · {x.payment_status || "—"}</div><div><b>{pick("Car", "العربية")}:</b> {[x.car_type, x.car_brand, x.car_model, x.car_color, x.plate_number].filter(Boolean).join(" · ") || "—"}</div><div><b>{pick("Address", "العنوان")}:</b> {x.address || "—"}</div></div>{x.notes && <div className="mt-3 rounded-lg bg-muted p-3 text-sm"><b>{pick("Notes", "ملاحظات")}:</b> {x.notes}</div>}</div>)}
      {!filteredBookings.length&&<p className="text-sm text-muted-foreground">{pick("No booking requests today", "لا توجد طلبات حجز اليوم")}</p>}
    </div></section>

    <section className="panel p-5"><h2 className="font-bold">{pick("Today's payments", "مدفوعات اليوم")}</h2><div className="mt-4 space-y-2">
      {filteredPayments.map(x=><div key={x.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><b>#{x.order_id || x.id.slice(0,8)}</b> · {x.amount ?? "—"} · {x.status || "pending"}</div>{x.status === "pending" && <Button size="sm" onClick={() => toast.info(pick("Use the Payments page to confirm this payment and activate the subscription.", "استخدم صفحة المدفوعات لتأكيد الدفع وتفعيل الاشتراك."))}><CheckCircle2 className="me-1 size-4"/>{pick("Action", "إجراء")}</Button>}</div></div>)}
      {!filteredPayments.length&&<p className="text-sm text-muted-foreground">{pick("No payments today", "لا توجد مدفوعات اليوم")}</p>}
    </div></section>
  </div>;
}
