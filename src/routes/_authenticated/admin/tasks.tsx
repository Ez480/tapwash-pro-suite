import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, ClipboardList, ExternalLink, MapPin, Navigation, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/tasks")({ component: AdminTasks });

type FormState = {
  employee_id: string; customer_id: string; subscription_id: string; offer_id: string;
  title: string; wash_type: string; collection_amount: string;
  location_text: string; location_url: string; latitude: string; longitude: string;
  scheduled_at: string; notes: string;
};

const emptyForm: FormState = {
  employee_id: "", customer_id: "", subscription_id: "", offer_id: "", title: "",
  wash_type: "car_wash", collection_amount: "", location_text: "", location_url: "",
  latitude: "", longitude: "", scheduled_at: "", notes: "",
};

function AdminTasks() {
  const { pick, fmtDate } = useI18n();
  const { data: profiles = [] } = useAdminTable("profiles", "*", "created_at");
  const { data: customers = [] } = useAdminTable("customers", "*", "created_at");
  const { data: subscriptions = [] } = useAdminTable("subscriptions", "*, packages(title_en,title_ar)", "created_at");
  const { data: offers = [] } = useAdminTable("offers", "*", "created_at");
  const { data: tasks = [], refetch } = useAdminTable("employee_tasks", "*", "created_at");
  const [form, setForm] = useState<FormState>(emptyForm);

  const employees = profiles.filter((p: any) => p.role === "employee" && p.status !== "suspended");
  const customerLabel = (c: any) => c?.full_name || c?.name || c?.email || c?.phone || c?.id;
  const employeeLabel = (e: any) => e?.full_name || e?.name || e?.email || e?.id;
  const set = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error(pick("Location is not supported by this browser", "المتصفح لا يدعم تحديد الموقع"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = String(position.coords.latitude);
        const longitude = String(position.coords.longitude);
        setForm((f) => ({ ...f, latitude, longitude, location_url: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}` }));
      },
      () => toast.error(pick("Could not get your location", "تعذر الحصول على موقعك")),
    );
  };

  const createTask = async () => {
    if (!form.employee_id || !form.customer_id || !form.title || (!form.location_text && !form.location_url && !(form.latitude && form.longitude))) {
      toast.error(pick("Fill employee, customer, task and a location", "اكمل الموظف والعميل والمهمة والموقع"));
      return;
    }
    const customer = customers.find((c: any) => c.id === form.customer_id);
    const sub = subscriptions.find((s: any) => s.id === form.subscription_id);
    const offer = offers.find((o: any) => o.id === form.offer_id);
    const pkg = sub?.packages as { title_en?: string; title_ar?: string } | null;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const locationUrl = form.location_url || (form.latitude && form.longitude ? `https://www.google.com/maps/search/?api=1&query=${form.latitude},${form.longitude}` : null);
    const serialNumber = `TW-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await (supabase as any).from("employee_tasks").insert({
      serial_number: serialNumber,
      collection_amount: form.collection_amount ? Number(form.collection_amount) : 0,
      title: form.title,
      wash_type: form.wash_type,
      employee_id: form.employee_id,
      customer_id: form.customer_id,
      subscription_id: form.subscription_id || null,
      offer_id: form.offer_id || null,
      customer_name: customerLabel(customer),
      customer_phone: customer?.phone ?? null,
      customer_email: customer?.email ?? null,
      package_name: pkg ? pick(pkg.title_en ?? "", pkg.title_ar ?? "") : null,
      offer_name: offer ? pick(offer.title_en ?? "", offer.title_ar ?? "") : null,
      total_washes: sub?.total_washes ?? null,
      used_washes: sub?.used_washes ?? null,
      remaining_washes: sub ? Math.max(Number(sub.total_washes ?? 0) - Number(sub.used_washes ?? 0), 0) : null,
      location_text: form.location_text || locationUrl,
      location_url: locationUrl,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      scheduled_at: form.scheduled_at || null,
      notes: form.notes || null,
      status: "pending",
      created_by: auth.user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(pick("Task assigned", "تم تكليف الموظف بالمهمة"));
    setForm(emptyForm);
    refetch();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await (supabase as any).from("employee_tasks").update({
      status,
      ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
    }).eq("id", id);
    if (error) toast.error(error.message); else refetch();
  };

  const removeTask = async (id: string) => {
    const { error } = await (supabase as any).from("employee_tasks").delete().eq("id", id);
    if (error) toast.error(error.message); else refetch();
  };

  const openTaskLocation = (task: any) => {
    const url = task.location_url || (task.latitude != null && task.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${task.latitude},${task.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.location_text || "")}`);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="size-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{pick("Employee tasks & orders", "مهام وأوردرات الموظفين")}</h1>
          <p className="text-sm text-muted-foreground">{pick("Assign washes with customer, subscription, offer and location details.", "كلف الموظف بالغسيل مع بيانات العميل والاشتراك أو العرض والموقع بالتفصيل.")}</p>
        </div>
      </div>

      <section className="panel p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>{pick("Employee", "الموظف")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={form.employee_id} onChange={(e) => set("employee_id", e.target.value)}><option value="">{pick("Choose employee", "اختر الموظف")}</option>{employees.map((e: any) => <option key={e.id} value={e.id}>{employeeLabel(e)}</option>)}</select></div>
          <div className="space-y-2"><Label>{pick("Customer", "العميل")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={form.customer_id} onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value, subscription_id: "", offer_id: "" }))}><option value="">{pick("Choose customer", "اختر العميل")}</option>{customers.map((c: any) => <option key={c.id} value={c.id}>{customerLabel(c)}</option>)}</select></div>
          <div className="space-y-2"><Label>{pick("Subscription / package", "الاشتراك / الباقة")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={form.subscription_id} onChange={(e) => set("subscription_id", e.target.value)}><option value="">{pick("No subscription", "بدون اشتراك")}</option>{subscriptions.filter((s: any) => !form.customer_id || s.customer_id === form.customer_id).map((s: any) => { const pkg = s.packages as { title_en?: string; title_ar?: string } | null; return <option key={s.id} value={s.id}>{pkg ? pick(pkg.title_en ?? "", pkg.title_ar ?? "") : "Subscription"} — {s.used_washes ?? 0}/{s.total_washes ?? 0}</option>; })}</select></div>
          <div className="space-y-2"><Label>{pick("Customer offer", "عرض العميل")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={form.offer_id} onChange={(e) => set("offer_id", e.target.value)}><option value="">{pick("No offer", "بدون عرض")}</option>{offers.filter((o: any) => o.status === "active").map((o: any) => <option key={o.id} value={o.id}>{pick(o.title_en ?? "", o.title_ar ?? "")} — {o.new_price ?? o.old_price ?? ""}</option>)}</select></div>
          <div className="space-y-2"><Label>{pick("Task / wash", "المهمة / الغسيل")}</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="space-y-2"><Label>{pick("Wash type", "نوع الغسيل")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={form.wash_type} onChange={(e) => set("wash_type", e.target.value)}><option value="car_wash">{pick("Car wash", "غسيل سيارة")}</option><option value="interior">{pick("Interior", "داخلي")}</option><option value="exterior">{pick("Exterior", "خارجي")}</option><option value="full">{pick("Full", "كامل")}</option></select></div>
          <div className="space-y-2"><Label>{pick("Collection amount", "مبلغ التحصيل")}</Label><Input type="number" min="0" step="0.01" value={form.collection_amount} onChange={(e) => set("collection_amount", e.target.value)} placeholder="0.00" /></div>
          <div className="space-y-2"><Label>{pick("Scheduled time", "موعد التنفيذ")}</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => set("scheduled_at", e.target.value)} /></div>
          <div className="space-y-2 md:col-span-2"><Label>{pick("Location address", "عنوان الموقع")}</Label><Input value={form.location_text} onChange={(e) => set("location_text", e.target.value)} /></div>
          <div className="space-y-2 md:col-span-2"><Label>{pick("Shared Google Maps / location link", "لينك الموقع أو Google Maps")}</Label><div className="flex gap-2"><Input value={form.location_url} onChange={(e) => set("location_url", e.target.value)} placeholder="https://maps.google.com/..." />{form.location_url && <Button type="button" variant="outline" size="icon" onClick={() => window.open(form.location_url, "_blank", "noopener,noreferrer")}><ExternalLink className="size-4" /></Button>}</div></div>
          <div className="space-y-2"><Label>{pick("Latitude", "خط العرض")}</Label><Input value={form.latitude} onChange={(e) => set("latitude", e.target.value)} /></div>
          <div className="space-y-2"><Label>{pick("Longitude", "خط الطول")}</Label><Input value={form.longitude} onChange={(e) => set("longitude", e.target.value)} /></div>
          <div className="md:col-span-2 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={useMyLocation}><Navigation className="me-1 size-4" />{pick("Use my current location", "استخدام موقعي الحالي")}</Button>{form.latitude && form.longitude && <Button type="button" variant="outline" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${form.latitude},${form.longitude}`, "_blank", "noopener,noreferrer")}><MapPin className="me-1 size-4" />{pick("Open on map", "فتح على الخريطة")}</Button>}</div>
          <div className="space-y-2 md:col-span-2"><Label>{pick("Instructions / notes", "تعليمات وملاحظات")}</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <Button className="mt-5" onClick={createTask}><Plus className="me-2 size-4" />{pick("Assign task", "تكليف الموظف")}</Button>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-bold">{pick("Assigned orders", "الأوردرات المكلفة")}</h2>
        <div className="mt-4 space-y-3">
          {tasks.map((task: any) => {
            const emp = profiles.find((p: any) => p.id === task.employee_id);
            return (
              <div key={task.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{task.title} <span className="text-xs text-muted-foreground">#{task.serial_number || task.id.slice(0, 8).toUpperCase()}</span></p>
                    <p className="text-sm text-muted-foreground">{emp?.full_name || emp?.email} · {task.customer_name || "—"} · {task.customer_phone || "—"}</p>
                    <p className="mt-1 flex items-center gap-1 text-sm"><MapPin className="size-4" />{task.location_text || task.location_url || "—"}</p>
                    <p className="mt-1 text-sm font-semibold">{pick("Collection", "التحصيل")}: {Number(task.collection_amount ?? 0).toFixed(2)} EGP</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(task.location_url || task.latitude != null || task.longitude != null || task.location_text) && <Button size="sm" variant="outline" onClick={() => openTaskLocation(task)}><Navigation className="me-1 size-4" />{pick("Open location", "فتح الموقع")}</Button>}
                      {task.location_url && <Button size="sm" variant="outline" onClick={() => window.open(task.location_url, "_blank", "noopener,noreferrer")}><ExternalLink className="me-1 size-4" />{pick("Shared link", "لينك الموقع")}</Button>}
                    </div>
                  </div>
                  <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => updateStatus(task.id, task.status === "completed" ? "pending" : "completed")}><CheckCircle2 className="me-1 size-4" />{task.status}</Button><Button size="sm" variant="destructive" onClick={() => removeTask(task.id)}><Trash2 className="size-4" /></Button></div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{task.scheduled_at ? fmtDate(task.scheduled_at) : pick("No scheduled time", "بدون موعد")}{task.notes ? ` · ${task.notes}` : ""}</p>
              </div>
            );
          })}
          {tasks.length === 0 && <p className="text-sm text-muted-foreground">{pick("No tasks yet", "لا توجد مهام بعد")}</p>}
        </div>
      </section>
    </div>
  );
}
