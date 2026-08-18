import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Clock3, MapPin, PackageCheck, RotateCcw, Sparkles, Truck } from "lucide-react";
import { toast } from "sonner";

import { AppTopbar } from "@/components/app/Shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/orders")({ component: CustomerOrders });

type Order = {
  id: string;
  customer_id: string;
  package_id: string | null;
  offer_id: string | null;
  car_id: string | null;
  customer_name: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  wash_type: string | null;
  scheduled_at: string | null;
  amount: number | null;
  payment_method?: string | null;
  payment_status: string | null;
  status: string | null;
  car_type?: string | null;
  car_brand?: string | null;
  car_model?: string | null;
  car_color?: string | null;
  plate_number?: string | null;
  address?: string | null;
  location_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

const stages = [
  { key: "pending", en: "Order created", ar: "تم إنشاء الطلب", icon: PackageCheck },
  { key: "confirmed", en: "Order confirmed", ar: "تم تأكيد الطلب", icon: Check },
  { key: "assigned", en: "Employee assigned", ar: "تم تعيين المندوب", icon: Truck },
  { key: "picked_up", en: "Employee picked up the order", ar: "المندوب استلم الطلب", icon: MapPin },
  { key: "in_progress", en: "Service in progress", ar: "جاري تنفيذ الخدمة", icon: Sparkles },
  { key: "completed", en: "Completed", ar: "تم الانتهاء", icon: Check },
  { key: "ready", en: "Ready for delivery", ar: "جاهز للتسليم", icon: PackageCheck },
  { key: "delivered", en: "Delivered", ar: "تم التسليم", icon: Check },
];

function normalizeStatus(status: string | null | undefined) {
  const value = String(status ?? "pending").toLowerCase();
  if (["new", "created", "pending", "requested"].includes(value)) return "pending";
  if (["approved", "confirmed", "accepted"].includes(value)) return "confirmed";
  if (["assigned", "courier_assigned"].includes(value)) return "assigned";
  if (["picked_up", "picked-up", "pickup", "collected", "courier_picked_up"].includes(value)) return "picked_up";
  if (["in_progress", "in-progress", "washing", "processing", "started"].includes(value)) return "in_progress";
  if (["completed", "complete", "finished"].includes(value)) return "completed";
  if (["ready", "ready_for_delivery"].includes(value)) return "ready";
  if (["delivered", "closed"].includes(value)) return "delivered";
  return value;
}

const isFinished = (status: string | null | undefined) =>
  ["completed", "complete", "finished", "delivered", "closed"].includes(String(status ?? "").toLowerCase());

function CustomerOrders() {
  const { user } = useSession();
  const { pick, fmtDate, fmtMoney } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [reordering, setReordering] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("booking_requests")
      .select("id, customer_id, package_id, offer_id, car_id, customer_name, customer_phone, customer_email, wash_type, scheduled_at, amount, payment_method, payment_status, status, car_type, car_brand, car_model, car_color, plate_number, address, location_url, latitude, longitude, notes, created_at, updated_at")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setOrders((data ?? []) as Order[]);
  };

  useEffect(() => {
    if (!user) return;
    void load();
    const channel = supabase
      .channel(`tapwash-orders-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "booking_requests", filter: `customer_id=eq.${user.id}` }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "booking_requests", filter: `customer_id=eq.${user.id}` }, () => void load())
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [user?.id]);

  const reorder = async (order: Order) => {
    if (!user || reordering) return;
    setReordering(order.id);
    const sourceDate = order.scheduled_at ? new Date(order.scheduled_at) : new Date();
    const scheduled = new Date();
    scheduled.setDate(scheduled.getDate() + 1);
    scheduled.setHours(sourceDate.getHours(), sourceDate.getMinutes(), 0, 0);

    const { error } = await supabase.from("booking_requests").insert({
      customer_id: user.id,
      package_id: order.package_id,
      offer_id: order.offer_id,
      car_id: order.car_id,
      wash_type: order.wash_type ?? "car_wash",
      scheduled_at: scheduled.toISOString(),
      customer_name: order.customer_name ?? "",
      customer_phone: order.customer_phone ?? null,
      customer_email: order.customer_email ?? user.email ?? null,
      car_type: order.car_type ?? null,
      car_brand: order.car_brand ?? null,
      car_model: order.car_model ?? null,
      car_color: order.car_color ?? null,
      plate_number: order.plate_number ?? null,
      address: order.address ?? "",
      location_url: order.location_url ?? null,
      latitude: order.latitude ?? null,
      longitude: order.longitude ?? null,
      notes: order.notes ?? null,
      amount: Number(order.amount ?? 0),
      payment_method: order.payment_method ?? null,
      payment_status: "pending",
      status: "pending",
    });

    setReordering(null);
    if (error) {
      toast.error(pick("Could not reorder. Please try again.", "تعذر إعادة الطلب، حاول مرة أخرى."));
      return;
    }
    toast.success(pick("New order created for tomorrow at the same time.", "تم إنشاء طلب جديد للغد في نفس الموعد."));
    await load();
  };

  const activeOrders = orders.filter((order) => !isFinished(order.status));
  const previousOrders = orders.filter((order) => isFinished(order.status));

  const renderActive = (order: Order) => {
    const current = normalizeStatus(order.status);
    const index = Math.max(stages.findIndex((stage) => stage.key === current), 0);
    const currentStage = stages[index];
    return (
      <section key={order.id} className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-xl backdrop-blur-2xl dark:bg-white/5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{pick("Order number", "رقم الطلب")}</p>
            <p className="font-mono text-sm font-bold">{order.id.slice(0, 8).toUpperCase()}</p>
            <p className="mt-2 text-lg font-bold">{order.wash_type || pick("TapWash service", "خدمة TapWash")}</p>
          </div>
          <Badge className="rounded-full px-3 py-1">{currentStage ? pick(currentStage.en, currentStage.ar) : order.status}</Badge>
        </div>

        <div className="mt-7 space-y-1">
          {stages.map((stage, stageIndex) => {
            const Icon = stage.icon;
            const done = stageIndex <= index;
            const active = stageIndex === index;
            return (
              <div key={stage.key} className="flex items-start gap-3">
                <div className="flex w-8 shrink-0 flex-col items-center">
                  <div className={`flex size-8 items-center justify-center rounded-full border ${done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/50 text-muted-foreground"}`}>
                    <Icon className="size-4" />
                  </div>
                  {stageIndex < stages.length - 1 && <div className={`my-1 h-8 w-px ${stageIndex < index ? "bg-primary" : "bg-border"}`} />}
                </div>
                <div className={`pb-5 ${active ? "font-bold" : done ? "text-foreground" : "text-muted-foreground"}`}>
                  <p>{pick(stage.en, stage.ar)}</p>
                  {active && <p className="mt-1 text-xs font-normal text-primary">{pick("Current status", "الحالة الحالية")}</p>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 grid gap-3 border-t border-border/60 pt-4 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">{pick("Order date", "تاريخ الطلب")}</p><p className="mt-1 font-medium">{order.created_at ? new Date(order.created_at).toLocaleString(pick("en-GB", "ar-EG")) : "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">{pick("Payment", "الدفع")}</p><p className="mt-1 font-medium">{order.payment_status || pick("Not specified", "غير محدد")}</p></div>
          <div><p className="text-xs text-muted-foreground">{pick("Amount", "القيمة")}</p><p className="mt-1 font-medium">{fmtMoney(order.amount)}</p></div>
        </div>
      </section>
    );
  };

  const renderPrevious = (order: Order) => (
    <section key={order.id} className="rounded-3xl border border-border/70 bg-card/70 p-5 shadow-lg backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">{pick("Order number", "رقم الطلب")}</p>
          <p className="font-mono text-sm font-bold">{order.id.slice(0, 8).toUpperCase()}</p>
          <p className="mt-2 font-bold">{order.wash_type || pick("TapWash service", "خدمة TapWash")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{order.created_at ? new Date(order.created_at).toLocaleString(pick("en-GB", "ar-EG")) : "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{pick("Completed", "منتهي")}</Badge>
          <Button onClick={() => void reorder(order)} disabled={reordering !== null}>
            <RotateCcw className="me-1.5 size-4" />
            {reordering === order.id ? pick("Creating…", "جاري إنشاء الطلب…") : pick("Order again", "إعادة الطلب مرة أخرى")}
          </Button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 text-sm sm:grid-cols-3">
        <div><p className="text-xs text-muted-foreground">{pick("Payment", "الدفع")}</p><p className="mt-1 font-medium">{order.payment_status || pick("Not specified", "غير محدد")}</p></div>
        <div><p className="text-xs text-muted-foreground">{pick("Amount", "القيمة")}</p><p className="mt-1 font-medium">{fmtMoney(order.amount)}</p></div>
        <div><p className="text-xs text-muted-foreground">{pick("Vehicle", "السيارة")}</p><p className="mt-1 font-medium">{[order.car_brand, order.car_model, order.plate_number].filter(Boolean).join(" · ") || "—"}</p></div>
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppTopbar title={pick("Orders", "حالة الطلبات")} />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 rounded-3xl border border-white/20 bg-white/10 p-6 shadow-xl backdrop-blur-2xl dark:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">TapWash Live</p>
          <h2 className="mt-2 text-3xl font-black">{pick("Track your order in real time", "تابع طلبك لحظة بلحظة")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{pick("The status updates automatically from assignment through service completion and delivery.", "تتحدث الحالة تلقائيًا من استلام المندوب للطلب وحتى تنفيذ الخدمة والتسليم.")}</p>
        </div>

        <section>
          <div className="mb-4 flex items-center gap-2"><Clock3 className="size-5 text-primary" /><h3 className="text-xl font-bold">{pick("Active orders", "الطلبات الحالية")}</h3></div>
          <div className="space-y-5">
            {activeOrders.length === 0 ? (
              <div className="rounded-3xl border border-white/20 bg-white/10 p-10 text-center shadow-lg backdrop-blur-2xl dark:bg-white/5">
                <Clock3 className="mx-auto size-10 text-muted-foreground" />
                <h3 className="mt-4 text-xl font-bold">{pick("No active orders", "لا توجد طلبات حالية")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{pick("Completed orders will appear below in order history.", "الطلبات التي تنتهي ستظهر بالأسفل في الطلبات السابقة.")}</p>
              </div>
            ) : activeOrders.map(renderActive)}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2"><RotateCcw className="size-5 text-primary" /><h3 className="text-xl font-bold">{pick("Previous orders", "الطلبات السابقة")}</h3></div>
          <div className="space-y-4">
            {previousOrders.length === 0 ? (
              <div className="rounded-3xl border border-border/70 bg-card/70 p-8 text-center text-sm text-muted-foreground">{pick("No previous orders yet.", "لا توجد طلبات سابقة حتى الآن.")}</div>
            ) : previousOrders.map(renderPrevious)}
          </div>
        </section>
      </main>
    </div>
  );
}
