import { useEffect, useMemo, useState } from "react";
import { Banknote, ClipboardList, Clock3, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useUserRoles } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export function EmployeeDashboardSummary() {
  const { user } = useSession();
  const { data: roles = [] } = useUserRoles(user?.id);
  const { pick, lang } = useI18n();
  const [tasks, setTasks] = useState<any[]>([]);

  const isEmployeePage = typeof window !== "undefined" && window.location.pathname === "/employee-tasks";
  const isEmployee = roles.includes("employee") && !roles.includes("admin");

  useEffect(() => {
    if (!user?.id || !isEmployee || !isEmployeePage) return;
    let mounted = true;
    const load = async () => {
      const { data } = await (supabase as any)
        .from("employee_tasks")
        .select("id,title,status,employee_id,collection_amount,created_at,scheduled_at,serial_number,booking_request_id")
        .eq("employee_id", user.id)
        .order("created_at", { ascending: false });
      if (mounted) setTasks(data ?? []);
    };
    void load();
    const channel = supabase
      .channel(`employee-summary-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_tasks", filter: `employee_id=eq.${user.id}` }, () => void load())
      .subscribe();
    return () => { mounted = false; void supabase.removeChannel(channel); };
  }, [user?.id, isEmployee, isEmployeePage]);

  const today = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return tasks.filter(t => { const d = new Date(t.created_at || t.scheduled_at || 0); return d >= start && d <= end; });
  }, [tasks]);
  const available = tasks.filter(t => ["pending", "accepted", "in_progress"].includes(String(t.status).toLowerCase()));
  const collection = today.reduce((sum, t) => sum + Number(t.collection_amount || 0), 0);
  const money = (v: number) => `${v.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")} ${pick("EGP", "جنيه")}`;
  const paymentLabel = (task: any) => {
    const status = String(task.payment_status || "").toLowerCase();
    if (status === "paid" || status === "confirmed" || status === "completed") return pick("Paid", "مدفوع");
    if (status === "awaiting_proof" || status === "pending" || status === "awaiting") return pick("Pending payment", "في انتظار الدفع");
    return pick("Not specified", "غير محدد");
  };

  if (!isEmployee || !isEmployeePage) return null;

  return <section className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="panel p-4"><div className="flex items-center gap-3"><span className="surface-blue flex size-10 items-center justify-center rounded-xl"><ClipboardList className="size-5" /></span><div><p className="text-xs text-muted-foreground">{pick("Today's orders", "إجمالي الأوردرات اليوم")}</p><p className="text-2xl font-extrabold">{today.length}</p></div></div></div>
      <div className="panel p-4"><div className="flex items-center gap-3"><span className="surface-blue flex size-10 items-center justify-center rounded-xl"><Banknote className="size-5" /></span><div><p className="text-xs text-muted-foreground">{pick("Today's collection", "إجمالي التحصيل اليوم")}</p><p className="text-2xl font-extrabold">{money(collection)}</p></div></div></div>
      <div className="panel p-4"><div className="flex items-center gap-3"><span className="surface-blue flex size-10 items-center justify-center rounded-xl"><Clock3 className="size-5" /></span><div><p className="text-xs text-muted-foreground">{pick("Available orders", "الطلبات المتاحة")}</p><p className="text-2xl font-extrabold">{available.length}</p></div></div></div>
    </div>
    {available.length > 0 && <div className="panel mt-3 overflow-hidden"><div className="border-b px-4 py-3 font-bold">{pick("Order payment details", "تفاصيل سعر وحالة دفع الأوردرات")}</div><div className="divide-y">{available.slice(0, 8).map(task => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate font-semibold">{task.title || pick("Order", "أوردر")} <span className="text-xs text-muted-foreground">#{task.serial_number || String(task.id).slice(0, 8).toUpperCase()}</span></p><p className="text-xs text-muted-foreground">{task.scheduled_at ? new Date(task.scheduled_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-US") : "—"}</p></div><div className="flex items-center gap-2"><Badge variant="outline"><CreditCard className="me-1 size-3" />{paymentLabel(task)}</Badge><span className="font-bold">{money(Number(task.collection_amount || 0))}</span></div></div>)}</div></div>}
  </section>;
}
