import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Clock3, MapPin, PackageCheck, Sparkles, Truck } from "lucide-react";

import { AppTopbar } from "@/components/app/Shell";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/orders")({ component: CustomerOrders });

type Order = {
  id: string;
  customer_id: string;
  customer_name: string | null;
  wash_type: string | null;
  scheduled_at: string | null;
  amount: number | null;
  payment_status: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

const stages = [
  { key: "pending", label: "تم إنشاء الطلب", icon: PackageCheck },
  { key: "confirmed", label: "تم تأكيد الطلب", icon: Check },
  { key: "assigned", label: "تم تعيين المندوب", icon: Truck },
  { key: "picked_up", label: "المندوب استلم الطلب", icon: MapPin },
  { key: "in_progress", label: "جاري تنفيذ الخدمة", icon: Sparkles },
  { key: "completed", label: "تم الانتهاء", icon: Check },
  { key: "ready", label: "جاهز للتسليم", icon: PackageCheck },
  { key: "delivered", label: "تم التسليم", icon: Check },
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

function CustomerOrders() {
  const { user } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("booking_requests")
      .select("id, customer_id, customer_name, wash_type, scheduled_at, amount, payment_status, status, created_at, updated_at")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });
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

  return (
    <div className="min-h-screen bg-background">
      <AppTopbar title="حالة الطلبات" />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 rounded-3xl border border-white/20 bg-white/10 p-6 shadow-xl backdrop-blur-2xl dark:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">TapWash Live</p>
          <h2 className="mt-2 text-3xl font-black">تابع طلبك لحظة بلحظة</h2>
          <p className="mt-2 text-sm text-muted-foreground">تتحدث الحالة تلقائيًا عند استلام المندوب للطلب وأثناء تنفيذ الخدمة وحتى التسليم.</p>
        </div>

        <div className="space-y-5">
          {orders.length === 0 ? (
            <div className="rounded-3xl border border-white/20 bg-white/10 p-10 text-center shadow-lg backdrop-blur-2xl dark:bg-white/5">
              <Clock3 className="mx-auto size-10 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-bold">لا توجد طلبات حتى الآن</h3>
            </div>
          ) : orders.map((order) => {
            const current = normalizeStatus(order.status);
            const index = Math.max(stages.findIndex((stage) => stage.key === current), 0);
            return (
              <section key={order.id} className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-xl backdrop-blur-2xl dark:bg-white/5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">رقم الطلب</p>
                    <p className="font-mono text-sm font-bold">{order.id.slice(0, 8).toUpperCase()}</p>
                    <p className="mt-2 text-lg font-bold">{order.wash_type || "خدمة TapWash"}</p>
                  </div>
                  <Badge className="rounded-full px-3 py-1">{stages[index]?.label ?? order.status}</Badge>
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
                          <p>{stage.label}</p>
                          {active && <p className="mt-1 text-xs font-normal text-primary">الحالة الحالية</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 grid gap-3 border-t border-border/60 pt-4 text-sm sm:grid-cols-3">
                  <div><p className="text-xs text-muted-foreground">تاريخ الطلب</p><p className="mt-1 font-medium">{new Date(order.created_at).toLocaleString("ar-EG")}</p></div>
                  <div><p className="text-xs text-muted-foreground">الدفع</p><p className="mt-1 font-medium">{order.payment_status || "غير محدد"}</p></div>
                  <div><p className="text-xs text-muted-foreground">القيمة</p><p className="mt-1 font-medium">{order.amount != null ? `${Number(order.amount).toLocaleString("ar-EG")} جنيه` : "—"}</p></div>
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
