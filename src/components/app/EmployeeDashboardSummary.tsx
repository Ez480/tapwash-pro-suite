import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Banknote, ClipboardList, Clock3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useUserRoles } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export function EmployeeDashboardSummary() {
  const { user } = useSession();
  const { data: roles = [] } = useUserRoles(user?.id);
  const { pick, lang } = useI18n();
  const [tasks, setTasks] = useState<any[]>([]);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  const isEmployeePage = typeof window !== "undefined" && window.location.pathname === "/employee-tasks";
  const isEmployee = roles.includes("employee") && !roles.includes("admin");

  useEffect(() => {
    if (!isEmployeePage || !isEmployee) return;
    const header = document.querySelector("header");
    const main = document.querySelector("main");
    const employeeCard = main?.querySelector("section");
    if (!header || !employeeCard) return;
    const target = document.createElement("div");
    target.className = "employee-summary-slot w-full";
    employeeCard.insertAdjacentElement("afterend", target);
    setSlot(target);
    return () => { target.remove(); setSlot(null); };
  }, [isEmployeePage, isEmployee]);

  useEffect(() => {
    if (!user?.id || !isEmployee || !isEmployeePage) return;
    let mounted = true;
    const load = async () => {
      const { data } = await (supabase as any)
        .from("employee_tasks")
        .select("id,status,employee_id,collection_amount,created_at,scheduled_at")
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

  if (!isEmployee || !isEmployeePage || !slot) return null;

  return createPortal(
    <section className="w-full border-b border-border/60 bg-background/80 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="panel p-4"><div className="flex items-center gap-3"><span className="surface-blue flex size-10 items-center justify-center rounded-xl"><ClipboardList className="size-5" /></span><div><p className="text-xs text-muted-foreground">{pick("Today's orders", "إجمالي الأوردرات اليوم")}</p><p className="text-2xl font-extrabold">{today.length}</p></div></div></div>
          <div className="panel p-4"><div className="flex items-center gap-3"><span className="surface-blue flex size-10 items-center justify-center rounded-xl"><Banknote className="size-5" /></span><div><p className="text-xs text-muted-foreground">{pick("Today's collection", "إجمالي التحصيل اليوم")}</p><p className="text-2xl font-extrabold">{money(collection)}</p></div></div></div>
          <div className="panel p-4"><div className="flex items-center gap-3"><span className="surface-blue flex size-10 items-center justify-center rounded-xl"><Clock3 className="size-5" /></span><div><p className="text-xs text-muted-foreground">{pick("Available orders", "الطلبات المتاحة")}</p><p className="text-2xl font-extrabold">{available.length}</p></div></div></div>
        </div>
      </div>
    </section>,
    slot,
  );
}
