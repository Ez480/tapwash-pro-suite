import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, ClipboardList, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/tasks")({ component: AdminTasks });

function AdminTasks() {
  const { pick, fmtDate } = useI18n();
  const { data: profiles = [] } = useAdminTable("profiles", "*", "created_at");
  const { data: customers = [] } = useAdminTable("customers", "*", "created_at");
  const { data: subscriptions = [] } = useAdminTable("subscriptions", "*, packages(title_en,title_ar)", "created_at");
  const { data: offers = [] } = useAdminTable("offers", "*", "created_at");
  const { data: tasks = [], refetch } = useAdminTable("employee_tasks", "*", "created_at");
  const employees = profiles.filter((p) => p.role === "employee" && p.status !== "suspended");
  const [form, setForm] = useState({ employee_id: "", customer_id: "", subscription_id: "", offer_id: "", title: "", wash_type: "car_wash", location_text: "", latitude: "", longitude: "", scheduled_at: "", notes: "" });

  const createTask = async () => {
    if (!form.employee_id || !form.customer_id || !form.title || !form.location_text) { toast.error(pick("Fill employee, customer, task and location", "اكمل الموظف والعميل والمهمة والموقع")); return; }
    const customer = customers.find((c) => c.id === form.customer_id);
    const sub = subscriptions.find((s) => s.id === form.subscription_id);
    const offer = offers.find((o) => o.id === form.offer_id);
    const pkg = sub?.packages as { title_en?: string; title_ar?: string } | null;
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { error } = await supabase.from("employee_tasks").insert({
      title: form.title, wash_type: form.wash_type, employee_id: form.employee_id, customer_id: form.customer_id,
      subscription_id: form.subscription_id || null, offer_id: form.offer_id || null,
      customer_name: customer?.full_name ?? "", customer_phone: customer?.phone ?? null, customer_email: customer?.email ?? null,
      package_name: pkg ? pick(pkg.title_en ?? "", pkg.title_ar ?? "") : null,
      offer_name: offer ? pick(offer.title_en ?? "", offer.title_ar ?? "") : null,
      total_washes: sub?.total_washes ?? null, used_washes: sub?.used_washes ?? null,
      remaining_washes: sub ? Math.max(Number(sub.total_washes ?? 0) - Number(sub.used_washes ?? 0), 0) : null,
      location_text: form.location_text, latitude: form.latitude ? Number(form.latitude) : null, longitude: form.longitude ? Number(form.longitude) : null,
      scheduled_at: form.scheduled_at || null, notes: form.notes || null, status: "pending", created_by: user.user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(pick("Task assigned", "تم تكليف الموظف بالمهمة"));
    setForm({ employee_id: "", customer_id: "", subscription_id: "", offer_id: "", title: "", wash_type: "car_wash", location_text: "", latitude: "", longitude: "", scheduled_at: "", notes: "" });
    refetch();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("employee_tasks").update({ status, ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}) }).eq("id", id);
    if (error) toast.error(error.message); else refetch();
  };
  const removeTask = async (id: string) => { const { error } = await supabase.from("employee_tasks").delete().eq("id", id); if (error) toast.error(error.message); else refetch(); };

  return <div className="space-y-6">
    <div className="flex items-center gap-3"><ClipboardList className="size-6 text-primary" /><div><h1 className="text-2xl font-bold">{pick("Employee tasks & orders", "مهام وأوردرات الموظفين")}</h1><p className="text-sm text-muted-foreground">{pick("Assign washes with customer, subscription, offer and location details.", "كلف الموظف بالغسيل مع بيانات العميل والاشتراك أو العرض والموقع بالتفصيل.")}</p></div></div>
    <section className="panel p-6"><div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2"><Label>{pick("Employee", "الموظف")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}><option value="">{pick("Choose employee", "اختر الموظف")}</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name || e.email}</option>)}</select></div>
      <div className="space-y-2"><Label>{pick("Customer", "العميل")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value, subscription_id: "", offer_id: "" })}><option value="">{pick("Choose customer", "اختر العميل")}</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}</select></div>
      <div className="space-y-2"><Label>{pick("Subscription / package", "الاشتراك / الباقة")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={form.subscription_id} onChange={(e) => setForm({ ...form, subscription_id: e.target.value })}><option value="">{pick("No subscription", "بدون اشتراك")}</option>{subscriptions.filter((s) => !form.customer_id || s.customer_id === form.customer_id).map((s) => { const pkg = s.packages as { title_en?: string; title_ar?: string } | null; return <option key={s.id} value={s.id}>{pkg ? pick(pkg.title_en ?? "", pkg.title_ar ?? "") : "Subscription"} — {s.used_washes ?? 0}/{s.total_washes ?? 0}</option>; })}</select></div>
      <div className="space-y-2"><Label>{pick("Customer offer", "عرض العميل")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={form.offer_id} onChange={(e) => setForm({ ...form, offer_id: e.target.value })}><option value="">{pick("No offer", "بدون عرض")}</option>{offers.filter((o) => o.status === "active").map((o) => <option key={o.id} value={o.id}>{pick(o.title_en ?? "", o.title_ar ?? "")} — {o.new_price ?? o.old_price ?? ""}</option>)}</select></div>
      <div className="space-y-2"><Label>{pick("Task / wash", "المهمة / الغسيل")}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={pick("e.g. Full exterior + interior wash", "مثال: غسيل خارجي وداخلي كامل")} /></div>
      <div className="space-y-2"><Label>{pick("Wash type", "نوع الغسيل")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={form.wash_type} onChange={(e) => setForm({ ...form, wash_type: e.target.value })}><option value="car_wash">{pick("Car wash", "غسيل سيارة")}</option><option value="interior">{pick("Interior", "داخلي")}</option><option value="exterior">{pick("Exterior", "خارجي")}</option><option value="full">{pick("Full", "كامل")}</option></select></div>
      <div className="space-y-2"><Label>{pick("Scheduled time", "موعد التنفيذ")}</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
      <div className="space-y-2 md:col-span-2"><Label>{pick("Customer location", "موقع العميل")}</Label><Input value={form.location_text} onChange={(e) => setForm({ ...form, location_text: e.target.value })} placeholder={pick("Address / compound / landmark", "العنوان / الكمبوند / علامة مميزة")} /></div>
      <div className="space-y-2"><Label>{pick("Latitude", "خط العرض")}</Label><Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></div>
      <div className="space-y-2"><Label>{pick("Longitude", "خط الطول")}</Label><Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></div>
      <div className="space-y-2 md:col-span-2"><Label>{pick("Instructions / notes", "تعليمات وملاحظات")}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
    </div><Button className="mt-5" onClick={createTask}><Plus className="me-2 size-4" />{pick("Assign task", "تكليف الموظف")}</Button></section>
    <section className="panel p-6"><h2 className="text-lg font-bold">{pick("Assigned orders", "الأوردرات المكلفة")}</h2><div className="mt-4 space-y-3">{tasks.map((task) => { const emp = profiles.find((p) => p.id === task.employee_id); return <div key={task.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{task.title}</p><p className="text-sm text-muted-foreground">{emp?.full_name || emp?.email} · {task.customer_name} · {task.customer_phone || "—"}</p><p className="mt-1 flex items-center gap-1 text-sm"><MapPin className="size-4" />{task.location_text}</p><p className="mt-1 text-xs text-muted-foreground">{task.package_name || task.offer_name || pick("No package or offer", "بدون باقة أو عرض")} · {task.remaining_washes ?? "—"} {pick("remaining", "متبقي")}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => updateStatus(task.id, task.status === "completed" ? "pending" : "completed")}><CheckCircle2 className="me-1 size-4" />{task.status}</Button><Button size="sm" variant="destructive" onClick={() => removeTask(task.id)}><Trash2 className="size-4" /></Button></div></div><p className="mt-2 text-xs text-muted-foreground">{task.scheduled_at ? fmtDate(task.scheduled_at) : pick("No scheduled time", "بدون موعد")}{task.notes ? ` · ${task.notes}` : ""}</p></div>; })}{tasks.length === 0 && <p className="text-sm text-muted-foreground">{pick("No tasks yet", "لا توجد مهام بعد")}</p>}</div></section>
  </div>;
}
