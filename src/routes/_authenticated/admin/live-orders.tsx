import { createFileRoute } from "@tanstack/react-router";
import { Camera, MapPinned, RefreshCw, Search, Truck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DriversMap } from "@/components/app/DriversMap";
import { DeliveryMap } from "@/components/app/DeliveryMap";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/live-orders")({ component: LiveOrdersPage });
type Task = Record<string, any>;
type Photo = { id: string; task_id: string; kind: string; url: string; created_at: string };
type Location = { task_id: string; employee_id: string; latitude: number; longitude: number; accuracy?: number | null; heading?: number | null; speed?: number | null; updated_at: string };
type Presence = { employee_id: string; latitude: number; longitude: number; accuracy: number | null; is_online: boolean; active_task_id: string | null; updated_at: string };
type Point = { lat: number; lng: number };
type Employee = { id: string; full_name: string };
type DeliveryLog = { id: string; task_id: string; previous_status: string; new_status: string; changed_by: string; changed_at: string };
const DELIVERY_STATES = [
  { value: "picked_up", label: "تم الاستلام" },
  { value: "on_the_way", label: "في الطريق" },
  { value: "delivered", label: "تم التسليم" },
  { value: "cancelled", label: "إلغاء" },
];
function parseCustomerLocation(task: Task): Point | null {
  const lat = Number(task?.latitude), lng = Number(task?.longitude);
  if (task?.latitude != null && task?.longitude != null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  const url = String(task?.location_url ?? "");
  if (!url) return null;
  try {
    const decoded = decodeURIComponent(url);
    const candidates = [decoded.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/), decoded.match(/[?&](?:q|ll|query|center)=(-?\d+(?:\.\d+)?)[,%20]+(-?\d+(?:\.\d+)?)/i), decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)];
    for (const match of candidates) {
      if (!match) continue;
      const a = Number(match[1]), b = Number(match[2]);
      if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lng: b };
    }
  } catch {}
  return null;
}
function distanceKm(a: Point, b: Point) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function formatDate(value: string | null | undefined) { return value ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—"; }
function LiveOrdersPage() {
  const { fmtDate } = useI18n();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [driverQuery, setDriverQuery] = useState("");
  const [driverFilter, setDriverFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const db = supabase as any;

  const load = async () => {
    const [taskResult, photoResult, locationResult, presenceResult, roleResult, profileResult, logResult] = await Promise.all([
      db.from("employee_tasks").select("*").order("updated_at", { ascending: false }).limit(200),
      db.from("order_photos").select("id,task_id,kind,url,created_at").order("created_at", { ascending: false }).limit(500),
      db.from("employee_locations").select("task_id,employee_id,latitude,longitude,accuracy,heading,speed,updated_at").limit(200),
      db.from("employee_presence").select("*").limit(500),
      db.from("user_roles").select("user_id").eq("role", "employee"),
      db.from("profiles").select("id,full_name").limit(1000),
      db.from("delivery_status_logs").select("*").order("changed_at", { ascending: false }).limit(500),
    ]);
    for (const result of [taskResult, photoResult, locationResult, presenceResult, roleResult, profileResult, logResult]) if (result.error) toast.error(result.error.message);
    setTasks(taskResult.data ?? []);
    setPhotos(photoResult.data ?? []);
    setLocations(locationResult.data ?? []);
    setPresence(presenceResult.data ?? []);
    setEmployeeIds((roleResult.data ?? []).map((row: any) => row.user_id));
    setEmployees((profileResult.data ?? []).map((row: any) => ({ id: row.id, full_name: row.full_name })));
    setLogs(logResult.data ?? []);
    return [taskResult, photoResult, locationResult, presenceResult, roleResult, profileResult, logResult].every(result => !result.error);
  };

  useEffect(() => {
    void load();
    const channel = supabase.channel("manager-live-orders-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_tasks" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_photos" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_locations" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_presence" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_status_logs" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const refresh = async () => { setRefreshing(true); const ok = await load(); setRefreshing(false); if (ok) toast.success("تم تحديث البيانات"); };
  const driverRows = useMemo(() => employeeIds.map(id => {
    const profile = employees.find(item => item.id === id);
    const row = presence.find(item => item.employee_id === id);
    const activeTask = tasks.find(task => task.employee_id === id && ["pending", "accepted", "in_progress"].includes(String(task.status)));
    const fresh = Boolean(row?.is_online && Date.now() - new Date(row.updated_at).getTime() < 2 * 60 * 1000);
    const status = fresh ? (row?.active_task_id || activeTask ? "active" : "available") : "offline";
    return { employee_id: id, name: profile?.full_name || "موظف", status, latitude: Number(row?.latitude ?? 0), longitude: Number(row?.longitude ?? 0), accuracy: row?.accuracy == null ? null : Number(row.accuracy), updated_at: row?.updated_at ?? "", taskLabel: activeTask?.serial_number ? "#" + activeTask.serial_number : null };
  }), [employeeIds, employees, presence, tasks]);
  const filteredDrivers = driverRows.filter(row => {
    const matchesQuery = !driverQuery.trim() || row.name.toLowerCase().includes(driverQuery.trim().toLowerCase());
    return matchesQuery && (driverFilter === "all" || row.status === driverFilter);
  });
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(task => [task.id, task.serial_number, task.title, task.customer_name, task.employee_id, task.status].some(value => String(value ?? "").toLowerCase().includes(q)));
  }, [tasks, query]);
  const selectedTask = tasks.find(task => String(task.id) === selected) ?? null;
  const selectedPhotos = photos.filter(photo => String(photo.task_id) === selected);
  const selectedLocation = locations.find(item => String(item.task_id) === selected && item.accuracy != null && item.accuracy <= 100) ?? null;
  const selectedCustomerPoint = selectedTask ? parseCustomerLocation(selectedTask) : null;
  const selectedDriverPoint = selectedLocation ? { lat: Number(selectedLocation.latitude), lng: Number(selectedLocation.longitude) } : null;
  const distance = selectedDriverPoint && selectedCustomerPoint ? distanceKm(selectedDriverPoint, selectedCustomerPoint) : null;
  const etaMinutes = distance == null ? null : Math.max(2, Math.round(distance / 30 * 60));
  const selectedLogs = logs.filter(log => log.task_id === selected).slice(0, 10);
  const statusLabel = (value: string) => ({ pending: "قيد الانتظار", accepted: "تم الاستلام", in_progress: "جاري التنفيذ", completed: "مكتمل" } as Record<string, string>)[value] ?? value;
  const deliveryLabel = (value: string) => ({ not_started: "لم يبدأ", picked_up: "تم الاستلام", on_the_way: "في الطريق", delivered: "تم التسليم", cancelled: "ملغي" } as Record<string, string>)[value] ?? value;

  const setDeliveryStatus = async (task: Task, nextStatus: string) => {
    if (savingStatus) return;
    setSavingStatus(true);
    const { data: userData } = await supabase.auth.getUser();
    const previousStatus = String(task.delivery_status ?? "not_started");
    const { error: updateError } = await db.from("employee_tasks").update({ delivery_status: nextStatus }).eq("id", task.id);
    if (updateError) { toast.error(updateError.message); setSavingStatus(false); return; }
    const { error: logError } = await db.from("delivery_status_logs").insert({ task_id: task.id, previous_status: previousStatus, new_status: nextStatus, changed_by: userData.user?.id });
    if (logError) toast.error("تم تحديث الحالة لكن تعذر تسجيل سجل التغيير: " + logError.message);
    else toast.success("تم تحديث حالة التوصيل وتسجيل التغيير");
    setTasks(current => current.map(item => item.id === task.id ? { ...item, delivery_status: nextStatus } : item));
    setSavingStatus(false);
    void load();
  };

  return <div className="space-y-6">
    <section className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-bold"><Users className="size-5 text-primary" />تتبع السائقين — كل الموظفين</h2><p className="mt-1 text-sm text-muted-foreground">الموقع المباشر وحالة العمل وآخر ظهور. يتم تجاهل المواقع التي تتجاوز دقتها 100 متر.</p></div><Badge variant="secondary">{driverRows.length} موظف</Badge></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]"><div className="relative"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={driverQuery} onChange={event => setDriverQuery(event.target.value)} placeholder="ابحث باسم الموظف..." className="ps-9" /></div><select value={driverFilter} onChange={event => setDriverFilter(event.target.value)} className="h-10 rounded-xl border bg-background px-3 text-sm"><option value="all">كل الحالات</option><option value="active">عنده أوردر نشط</option><option value="available">متاح</option><option value="offline">غير متصل</option></select></div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground"><span><i className="me-1 inline-block size-2 rounded-full bg-amber-500" />أوردر نشط</span><span><i className="me-1 inline-block size-2 rounded-full bg-emerald-500" />متاح</span><span><i className="me-1 inline-block size-2 rounded-full bg-slate-400" />غير متصل</span></div>
      <DriversMap drivers={filteredDrivers} />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{filteredDrivers.map(driver => <article key={driver.employee_id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><b className="truncate">{driver.name}</b><Badge variant={driver.status === "active" ? "default" : "secondary"}>{driver.status === "active" ? "أوردر نشط" : driver.status === "available" ? "متاح" : "غير متصل"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">آخر ظهور: {driver.updated_at ? formatDate(driver.updated_at) : "غير متاح"}</p><p className="text-xs text-muted-foreground">دقة الموقع: {driver.accuracy == null ? "—" : Math.round(driver.accuracy) + " متر"}</p>{driver.taskLabel && <p className="text-xs text-primary">{driver.taskLabel}</p>}</article>)}</div>
    </section>
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="flex items-center gap-2 text-xl font-bold"><Truck className="size-5 text-primary" />متابعة أوردرات التوصيل Live</h2><p className="mt-1 text-sm text-muted-foreground">موقع الموظف والعميل والمسافة والوقت المتوقع والتحكم في حالة التسليم.</p></div><Button variant="outline" onClick={refresh} disabled={refreshing} className="gap-2"><RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />{refreshing ? "جاري التحديث..." : "تحديث"}</Button></div>
      <div className="relative mt-4"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث برقم الأوردر أو العميل أو الموظف..." className="ps-9" /></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{visible.map(task => {
        const count = photos.filter(photo => String(photo.task_id) === String(task.id)).length;
        const location = locations.find(item => String(item.task_id) === String(task.id) && item.accuracy != null && item.accuracy <= 100);
        return <article key={String(task.id)} className="rounded-2xl border bg-card p-5 transition hover:border-primary/50 hover:shadow-md">
          <button onClick={() => setSelected(String(task.id))} className="w-full text-start"><div className="flex flex-wrap items-center gap-2"><b>{task.title || "أوردر"}</b><Badge>{statusLabel(String(task.status ?? ""))}</Badge><Badge variant="outline">{deliveryLabel(String(task.delivery_status ?? "not_started"))}</Badge></div><p className="mt-2 text-sm">{task.customer_name || "—"}</p><div className="mt-3 grid gap-1 text-xs text-muted-foreground"><span>#{task.serial_number || task.id}</span><span>الموظف: {employees.find(item => item.id === task.employee_id)?.full_name || "—"}</span><span>تاريخ الطلب: {formatDate(task.created_at)}</span><span>آخر تحديث: {fmtDate(task.updated_at)} • {count} صورة</span></div></button>
          <div className="mt-3 flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={() => setSelected(String(task.id))}><MapPinned className="me-1 size-4" />الخريطة والتفاصيل</Button>{location ? <span className="text-xs text-emerald-600">دقة {Math.round(location.accuracy!)}م</span> : <span className="text-xs text-muted-foreground">موقع GPS غير متاح أو دقته ضعيفة</span>}</div>
        </article>;
      })}{visible.length === 0 && <p className="text-sm text-muted-foreground">لا توجد أوردرات مطابقة.</p>}</div>
    </section>
    <Dialog open={!!selectedTask} onOpenChange={open => !open && setSelected(null)}><DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">{selectedTask && <>
      <DialogHeader><DialogTitle>{selectedTask.title || "تفاصيل الأوردر"}</DialogTitle><DialogDescription>موقع السائق وموقع العميل مع التحكم الكامل في حالة التوصيل.</DialogDescription></DialogHeader>
      <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-3"><div><small className="text-muted-foreground">العميل</small><p className="font-semibold">{selectedTask.customer_name || "—"}</p></div><div><small className="text-muted-foreground">حالة الأوردر</small><p className="font-semibold">{statusLabel(String(selectedTask.status ?? ""))}</p></div><div><small className="text-muted-foreground">حالة التوصيل</small><p className="font-semibold">{deliveryLabel(String(selectedTask.delivery_status ?? "not_started"))}</p></div><div><small className="text-muted-foreground">رقم الأوردر</small><p className="font-semibold">#{selectedTask.serial_number || selectedTask.id}</p></div><div><small className="text-muted-foreground">الموظف</small><p className="font-semibold">{employees.find(item => item.id === selectedTask.employee_id)?.full_name || "—"}</p></div><div><small className="text-muted-foreground">آخر تحديث</small><p className="font-semibold">{formatDate(selectedTask.updated_at)}</p></div></div>
      <div className="rounded-2xl border p-4"><h3 className="mb-3 font-bold">تحكم حالة الاستلام والتسليم</h3><div className="flex flex-wrap gap-2">{DELIVERY_STATES.map(state => <Button key={state.value} size="sm" variant={selectedTask.delivery_status === state.value ? "default" : "outline"} disabled={savingStatus || selectedTask.delivery_status === state.value} onClick={() => void setDeliveryStatus(selectedTask, state.value)}>{state.label}</Button>)}</div><p className="mt-2 text-xs text-muted-foreground">كل تغيير يُسجل باسم حساب الأدمن ووقت التغيير.</p></div>
      <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-bold"><MapPinned className="size-5 text-primary" />خريطة الأوردر</h3>{selectedLocation && <Badge variant="secondary">آخر تحديث {formatDate(selectedLocation.updated_at)}</Badge>}</div>
        {selectedCustomerPoint ? <DeliveryMap destination={selectedCustomerPoint} driver={selectedDriverPoint ? { ...selectedDriverPoint, updatedAt: selectedLocation?.updated_at, accuracy: selectedLocation?.accuracy } : null} height="420px" /> : <div className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">لا يوجد موقع عميل بإحداثيات قابلة للاستخراج.</div>}
        <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">دقة موقع الموظف</p><b>{selectedLocation?.accuracy == null ? "غير متاح" : Math.round(selectedLocation.accuracy) + " متر"}</b></div><div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">المسافة التقريبية</p><b>{distance == null ? "غير متاح" : distance.toFixed(1) + " كم"}</b></div><div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">الوقت المتوقع بسرعة 30 كم/س</p><b>{etaMinutes == null ? "غير متاح" : etaMinutes + " دقيقة"}</b></div></div>
        {selectedTask.location_url && <Button variant="outline" size="sm" onClick={() => window.open(String(selectedTask.location_url), "_blank", "noopener,noreferrer")}><MapPinned className="me-1 size-4" />فتح موقع العميل في الخرائط</Button>}
      </div>
      <div><h3 className="mb-3 flex items-center gap-2 font-bold"><Camera className="size-5 text-primary" />صور الأوردر</h3><div className="grid gap-4 sm:grid-cols-2">{["before", "after"].map(kind => <div key={kind}><h4 className="mb-2 font-semibold">{kind === "before" ? "قبل الغسيل" : "بعد التنظيف"}</h4><div className="grid gap-3">{selectedPhotos.filter(photo => photo.kind === kind).map(photo => <img key={photo.id} src={photo.url} alt={kind} className="w-full rounded-xl border object-cover" />)}{selectedPhotos.filter(photo => photo.kind === kind).length === 0 && <p className="text-sm text-muted-foreground">لا توجد صور.</p>}</div></div>)}</div></div>
      <div><h3 className="mb-2 font-bold">سجل تغييرات حالة التوصيل</h3>{selectedLogs.length ? <div className="space-y-2">{selectedLogs.map(log => <div key={log.id} className="rounded-xl border p-3 text-sm"><b>{deliveryLabel(log.previous_status)} ← {deliveryLabel(log.new_status)}</b><p className="text-xs text-muted-foreground">{formatDate(log.changed_at)} • {employees.find(employee => employee.id === log.changed_by)?.full_name || log.changed_by}</p></div>)}</div> : <p className="text-sm text-muted-foreground">لا توجد تغييرات مسجلة بعد.</p>}</div>
    </>}</DialogContent></Dialog>
  </div>;
}
