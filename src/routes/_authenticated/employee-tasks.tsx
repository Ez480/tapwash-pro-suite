import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Clock3, MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSession, useUserRoles } from "@/lib/auth";
import { useAdminTable } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/employee-tasks")({ component: EmployeeTasks });

function EmployeeTasks() {
  const { pick, fmtDate } = useI18n();
  const { user } = useSession();
  const { data: roles = [] } = useUserRoles(user?.id);
  const { data: tasks = [], refetch } = useAdminTable("employee_tasks", "*", "created_at");
  const [loading, setLoading] = useState<string | null>(null);
  const mine = roles.includes("employee") ? tasks.filter((t) => t.employee_id === user?.id) : [];
  const pending = mine.filter((t) => ["pending", "accepted", "in_progress"].includes(t.status));

  const setStatus = async (id: string, status: string) => {
    setLoading(id);
    const { error } = await (supabase as any).from("employee_tasks").update({ status, ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}) }).eq("id", id);
    setLoading(null);
    if (error) toast.error(error.message); else refetch();
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">{pick("My orders & tasks", "أوردراتي ومهامي")}</h1><p className="text-sm text-muted-foreground">{pick("All orders assigned to you with customer and location details.", "كل الأوردرات المكلف بها مع بيانات العميل والموقع بالتفصيل.")}</p></div><Badge variant="secondary">{pending.length} {pick("available orders", "أوردر متاح")}</Badge></div>
    <div className="grid gap-4 sm:grid-cols-3"><div className="panel p-5"><p className="text-sm text-muted-foreground">{pick("Available", "متاح")}</p><p className="mt-1 text-3xl font-bold">{mine.filter((t) => t.status === "pending").length}</p></div><div className="panel p-5"><p className="text-sm text-muted-foreground">{pick("In progress", "قيد التنفيذ")}</p><p className="mt-1 text-3xl font-bold">{mine.filter((t) => t.status === "in_progress" || t.status === "accepted").length}</p></div><div className="panel p-5"><p className="text-sm text-muted-foreground">{pick("Completed", "تم التنفيذ")}</p><p className="mt-1 text-3xl font-bold">{mine.filter((t) => t.status === "completed").length}</p></div></div>
    <div className="space-y-4">{mine.map((task) => <article key={task.id} className="panel p-5"><div className="flex flex-wrap justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-lg font-bold">{task.title}</h2><Badge>{task.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{task.wash_type}</p></div>{task.scheduled_at && <div className="flex items-center gap-1 text-sm text-muted-foreground"><Clock3 className="size-4" />{fmtDate(task.scheduled_at)}</div>}</div><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-xl border p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">{pick("Customer", "العميل")}</p><p className="mt-1 font-bold">{task.customer_name}</p><p className="text-sm">{task.customer_phone || "—"}</p><p className="text-sm">{task.customer_email || "—"}</p></div><div className="rounded-xl border p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">{pick("Subscription / offer", "الاشتراك / العرض")}</p><p className="mt-1 font-bold">{task.package_name || task.offer_name || pick("No package or offer", "لا توجد باقة أو عرض")}</p><p className="text-sm">{task.remaining_washes != null ? `${task.remaining_washes} ${pick("orders/washes remaining", "أوردر/غسلة متبقية")}` : "—"}</p></div><div className="rounded-xl border p-4 md:col-span-2"><p className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground"><MapPin className="size-4" />{pick("Customer location", "موقع العميل")}</p><p className="mt-1 font-semibold">{task.location_text}</p>{task.latitude != null && task.longitude != null && <Button className="mt-3" size="sm" variant="outline" asChild><a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${task.latitude},${task.longitude}`}><Navigation className="me-1 size-4" />{pick("Open map", "فتح الخريطة")}</a></Button>}</div></div>{task.notes && <div className="mt-4 rounded-xl bg-muted p-4 text-sm">{task.notes}</div>}<div className="mt-5 flex flex-wrap gap-2">{task.status === "pending" && <Button disabled={loading === task.id} onClick={() => setStatus(task.id, "accepted")}>{pick("Accept order", "استلام الأوردر")}</Button>}{task.status === "accepted" && <Button disabled={loading === task.id} onClick={() => setStatus(task.id, "in_progress")}>{pick("Start", "بدء التنفيذ")}</Button>}{task.status === "in_progress" && <Button disabled={loading === task.id} onClick={() => setStatus(task.id, "completed")}><CheckCircle2 className="me-1 size-4" />{pick("Complete", "تم التنفيذ")}</Button>}</div></article>)}{mine.length === 0 && <div className="panel p-10 text-center text-muted-foreground">{pick("No orders assigned yet.", "لا توجد أوردرات مكلف بها حتى الآن.")}</div>}</div>
  </div>;
}
