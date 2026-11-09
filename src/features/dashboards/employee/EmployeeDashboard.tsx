import { useEffect, useRef, useState } from "react";
import { Archive, Banknote, Bell, Camera, CheckCircle2, ClipboardList, Clock3, Droplets, LogOut, MapPin, MessageCircle, Moon, Navigation, ScanLine, Sun, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSession, useUserRoles } from "@/lib/auth";
import { useAdminTable, useMyEmployee, useProfile, useSettings } from "@/lib/data";
import { uploadImage } from "@/lib/media";
import { DeliveryMap } from "@/components/app/DeliveryMap";

declare global { interface Window { NDEFReader?: any } }

function parseCustomerMapPoint(task: any): { lat: number; lng: number } | null {
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

function EmployeeMessagesButton() {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label="رسائل الإدارة" title="رسائل الإدارة" className="shrink-0 gap-2">
          <Bell className="size-4" /><span>رسائل الإدارة</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,360px)] p-4">
        <div className="flex items-center gap-2">
          <Bell className="size-5 text-primary" />
          <div>
            <p className="font-bold">رسائل الإدارة</p>
            <p className="text-xs text-muted-foreground">الرسائل الموجهة إليك من إدارة الشركة</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm font-medium">لا توجد رسائل لعرضها حاليًا</p>
          <p className="mt-1 text-xs text-muted-foreground">سيتم تفعيل استقبال الرسائل في مرحلة الربط القادمة.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function EmployeeDashboard() {
  const { pick, fmtDate, lang, setLang } = useI18n();
  const { user } = useSession();
  const { data: roles = [] } = useUserRoles(user?.id);
  const { data: profile } = useProfile(user?.id);
  const { data: tasks = [], refetch } = useAdminTable("employee_tasks", "*", "created_at");
  const { data: employee, refetch: refetchEmployee } = useMyEmployee(user?.id);
  const { data: settings } = useSettings();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [map, setMap] = useState<{ lat: number; lng: number } | null>(null);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number; updated_at: string } | null>(null);
  const [selectedMapTaskId, setSelectedMapTaskId] = useState<string | null>(null);
  const [card, setCard] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [employeePage, setEmployeePage] = useState<"current" | "archive" | "profile" | "scan">("current"); const [supportOpen, setSupportOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  const locationWatchRef = useRef<number | null>(null);

  useEffect(() => { if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => setMap({ lat: p.coords.latitude, lng: p.coords.longitude }), () => undefined, { enableHighAccuracy: true, timeout: 8000 }); }, []);
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`employee-self-${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "employees", filter: `user_id=eq.${user.id}` }, () => void refetchEmployee()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, refetchEmployee]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`employee-orders-${user.id}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_tasks", filter: `employee_id=eq.${user.id}` }, () => void refetch())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, refetch]);

  const mine = roles.includes("employee") ? (tasks as any[]).filter(t => t.employee_id === user?.id) : [];
  const active = mine.filter(t => ["pending", "accepted", "in_progress"].includes(t.status));
  const completed = mine.filter(t => t.status === "completed");
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const todayOrders = mine.filter((task: any) => {
    const value = task.created_at || task.scheduled_at || task.updated_at;
    if (!value) return false;
    const date = new Date(value);
    return date >= todayStart && date <= todayEnd;
  });
  const todayCollection = todayOrders.reduce((sum: number, task: any) => sum + Number(task.collection_amount ?? 0), 0);
  const money = (value: number) => `${value.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")} ${pick("EGP", "جنيه")}`;
  const archiveGroups = completed.reduce((groups: Record<string, any[]>, task: any) => {
    const date = new Date(task.completed_at || task.updated_at || task.created_at);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    (groups[day] ??= []).push(task);
    return groups;
  }, {});
  const activeTaskKey = active.map(t => String(t.id)).sort().join(",");

  useEffect(() => {
    if (!user?.id || !activeTaskKey || !navigator.geolocation) return;
    let lastSentAt = 0;
    const sendLocation = async (position: GeolocationPosition) => {
      const now = Date.now();
      if (now - lastSentAt < 10000) return;
      lastSentAt = now;
      setMap({ lat: position.coords.latitude, lng: position.coords.longitude });
      const rows = active.map((task: any) => ({ task_id: task.id, employee_id: user.id, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy ?? null, heading: position.coords.heading ?? null, speed: position.coords.speed ?? null, updated_at: new Date().toISOString() }));
      if (rows.length) { const { error } = await (supabase as any).from("employee_locations").upsert(rows, { onConflict: "task_id" }); if (error) console.warn("Driver location update failed", error); }
    };
    locationWatchRef.current = navigator.geolocation.watchPosition(sendLocation, () => undefined, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    return () => { if (locationWatchRef.current != null) navigator.geolocation.clearWatch(locationWatchRef.current); locationWatchRef.current = null; };
  }, [user?.id, activeTaskKey]);

  const toggleTheme = () => { const next = !document.documentElement.classList.contains("dark"); document.documentElement.classList.toggle("dark", next); localStorage.setItem("tapwash-theme", next ? "dark" : "light"); setDark(next); };
  const setStatus = async (id: string, status: string) => { setLoading(id); const { error } = await (supabase as any).from("employee_tasks").update({ status, ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}) }).eq("id", id).eq("employee_id", user?.id); setLoading(null); if (error) toast.error(error.message); else { toast.success(pick("Order updated", "تم تحديث الأوردر")); refetch(); } };
  const logout = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };
  const openLocation = (t: any) => { const u = t.location_url || (t.latitude != null && t.longitude != null ? `https://www.google.com/maps/search/?api=1&query=${t.latitude},${t.longitude}` : t.location_text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.location_text)}` : null); if (u) window.open(u, "_blank", "noopener,noreferrer"); };
  const mapTask = active.find((task: any) => String(task.id) === selectedMapTaskId) || active[0] || null;
  const customerMapQuery = mapTask ? (mapTask.latitude != null && mapTask.longitude != null ? String(mapTask.latitude) + "," + String(mapTask.longitude) : String(mapTask.location_text || mapTask.location_url || "").trim()) : "";
  const customerMapPoint = mapTask ? parseCustomerMapPoint(mapTask) : null;

  useEffect(() => {
    if (!mapDialogOpen || !mapTask?.id || !user?.id) { setDriverLocation(null); return; }
    let mounted = true;
    let watchId: number | null = null;
    const savePosition = async (position: GeolocationPosition) => {
      if (!mounted) return;
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const updated_at = new Date().toISOString();
      setMap({ lat: latitude, lng: longitude });
      setDriverLocation({ latitude, longitude, updated_at });
      const { error } = await (supabase as any).from("employee_locations").upsert({
        task_id: mapTask.id, employee_id: user.id, latitude, longitude,
        accuracy: position.coords.accuracy ?? null,
        heading: position.coords.heading ?? null,
        speed: position.coords.speed ?? null, updated_at,
      }, { onConflict: "task_id" });
      if (error && mounted) {
        console.error("Could not save courier location", error);
        toast.error(pick("Your live location is visible on this phone but could not be synced: ", "موقعك ظاهر على الهاتف لكن تعذر مزامنته: ") + error.message);
      }
    };
    const loadAndTrack = async () => {
      const { data, error } = await (supabase as any).from("employee_locations").select("task_id,employee_id,latitude,longitude,updated_at").eq("task_id", mapTask.id).eq("employee_id", user.id).maybeSingle();
      if (!mounted) return;
      if (data) setDriverLocation(data);
      if (error) console.warn("Could not load saved courier location", error);
      if (!navigator.geolocation) { toast.error(pick("Location is not supported by this browser.", "هذا المتصفح لا يدعم تحديد الموقع.")); return; }
      navigator.geolocation.getCurrentPosition(
        position => { void savePosition(position); },
        error => {
          if (!mounted) return;
          const message = error.code === 1 ? pick("Allow location permission for TapWash to show your position.", "اسمح لتطبيق TapWash باستخدام الموقع حتى يظهر مكانك.") : error.code === 2 ? pick("The phone could not determine your location. Turn on GPS.", "تعذر تحديد موقع الهاتف. شغّل GPS.") : pick("Location request timed out. Try again with GPS enabled.", "انتهت مهلة تحديد الموقع. حاول مجددًا مع تشغيل GPS.");
          toast.error(message);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
      );
      watchId = navigator.geolocation.watchPosition(
        position => { void savePosition(position); },
        error => { if (mounted && error.code === 1) toast.error(pick("Location permission was denied.", "تم رفض إذن الوصول للموقع.")); },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }
      );
    };
    void loadAndTrack();
    const channel = supabase.channel("employee-map-location-" + user.id + "-" + String(mapTask.id)).on("postgres_changes", { event: "*", schema: "public", table: "employee_locations", filter: "task_id=eq." + mapTask.id }, (payload: any) => {
      const row = payload.new as any;
      if (row?.employee_id === user.id && Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude))) setDriverLocation(row);
    }).subscribe();
    return () => { mounted = false; if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId); void supabase.removeChannel(channel); };
  }, [mapDialogOpen, mapTask?.id, user?.id]);
  const openCustomerMap = (provider: "google" | "waze" | "apple" | "osm") => {
    if (!customerMapQuery) return toast.error(pick("The current order has no customer location.", "الأوردر الحالي لا يحتوي على موقع للعميل."));
    const q = encodeURIComponent(customerMapQuery);
    const urls = {
      google: "https://www.google.com/maps/search/?api=1&query=" + q,
      waze: "https://waze.com/ul?q=" + q + "&navigate=yes",
      apple: "https://maps.apple.com/?q=" + q,
      osm: "https://www.openstreetmap.org/search?query=" + q,
    };
    window.open(urls[provider], "_blank", "noopener,noreferrer");
  };

  const displayValue = (value: any) => {
    if (value == null || value === "") return "—";
    if (typeof value === "object") return String(value.title_ar || value.title_en || value.name || value.label || "—");
    return String(value);
  };
  const packageLabel = (value: any) => displayValue(value === "—" ? "" : value);
  const normalizeSubscription = (subscription: any) => {
    if (!subscription || typeof subscription !== "object") return subscription || {};
    const label = packageLabel(subscription.package_name ?? subscription.package);
    return { ...subscription, package: label, package_name: label };
  };
  const normalizeCard = (data: any, value: string) => {
    const customer = data?.customer && typeof data.customer === "object" ? data.customer : {};
    const car = data?.car && typeof data.car === "object" ? data.car : {};
    const subscription = normalizeSubscription(data?.subscription);
    const customerName = displayValue(customer.full_name);
    const customerPhone = displayValue(customer.phone);
    return { ...data, _cardValue: value, customer, car, subscription, name: customerName === "—" ? "" : customerName, full_name: customerName === "—" ? "" : customerName, phone: customerPhone === "—" ? "" : customerPhone, package: subscription.package_name || "", package_name: subscription.package_name || "", remaining_washes: subscription.remaining_washes };
  };

  const extractCardValue = (event: any) => {
    for (const record of event?.message?.records ?? []) {
      try {
        const text = new TextDecoder(record.encoding || "utf-8").decode(record.data).trim();
        try {
          const parsed = JSON.parse(text);
          const id = parsed.uid || parsed.card_serial || parsed.serial_number || parsed.url;
          if (id) return String(id).trim();
        } catch {}
        try {
          const url = new URL(text);
          const parts = url.pathname.split("/").filter(Boolean);
          const i = parts.findIndex((x: string) => x.toLowerCase() === "nfc");
          if (i >= 0 && parts[i + 1]) return decodeURIComponent(parts[i + 1]).trim();
        } catch {}
        if (text) return text.replace(/^\u0000+/, "").trim();
      } catch {}
    }
    return "";
  };

  const scanNfc = async () => {
    if (!window.NDEFReader) return toast.error(pick("Web NFC is not supported here. Use Chrome on Android with NFC enabled.", "المتصفح لا يدعم NFC. استخدم Chrome على Android مع تشغيل NFC."));
    try {
      setScanning(true);
      const reader = new window.NDEFReader();
      await reader.scan();
      toast.info(pick("Bring the customer NFC card close to the phone.", "قرّب كارت العميل من الموبايل."));
      reader.onreadingerror = () => { setScanning(false); toast.error(pick("Could not read the NFC card.", "تعذر قراءة كارت العميل.")); };
      reader.onreading = async (event: any) => {
        const value = extractCardValue(event);
        setScanning(false);
        if (!value) return toast.error(pick("The card has no readable NFC value.", "الكارت لا يحتوي على قيمة NFC قابلة للقراءة."));
        const { data, error } = await (supabase as any).rpc("public_nfc_lookup", { p_uid: value });
        if (error) return toast.error(error.message);
        if (!data) return toast.error(pick("NFC card not found.", "كارت NFC غير موجود."));
        setCard(normalizeCard(data, value));
        toast.success(pick("Customer card scanned", "تمت قراءة كارت العميل"));
      };
    } catch (e) {
      setScanning(false);
      toast.error(e instanceof Error ? e.message : pick("NFC scan failed", "فشل مسح NFC"));
    }
  };

  const deductScannedWash = async () => {
    if (!card?._cardValue || loading === "nfc") return;
    const remaining = Number(card.subscription?.remaining_washes ?? card.remaining_washes ?? 0);
    if (remaining <= 0) return toast.error(pick("No remaining subscription washes.", "لا توجد غسلات متبقية في الاشتراك."));
    if (!window.confirm(pick("Confirm recording this wash? One wash will be deducted.", "هل تريد تأكيد تسجيل الغسلة؟ سيتم خصم غسلة واحدة."))) return;
    setLoading("nfc");
    const { error } = await (supabase as any).rpc("checkin_nfc_card", { p_card_value: card._cardValue, p_booking_id: null });
    if (error) { setLoading(null); return toast.error(error.message); }
    const { data: refreshed, error: refreshError } = await (supabase as any).rpc("public_nfc_lookup", { p_uid: card._cardValue });
    if (refreshError) { setLoading(null); return toast.error(refreshError.message); }
    setCard(refreshed ? normalizeCard(refreshed, card._cardValue) : null);
    setLoading(null);
    toast.success(pick("Wash recorded successfully.", "تم تسجيل الغسلة بنجاح."));
  };

  const uploadOrderPhoto = async (task: any, kind: "before" | "after", file: File) => {
    if (!user?.id) return;
    const key = `${task.id}:${kind}`;
    try {
      setPhotoBusy(key);
      const result = await uploadImage(file, `orders/${task.id}/${kind}`);
      const { error } = await (supabase as any).from("order_photos").insert({
        task_id: task.id,
        uploaded_by: user.id,
        kind,
        path: result.path,
        url: result.url,
      });
      if (error) throw error;
      toast.success(kind === "before" ? pick("Before-wash photo uploaded", "تم رفع صورة قبل الغسيل") : pick("After-cleaning photo uploaded", "تم رفع صورة بعد التنظيف"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : pick("Photo upload failed", "فشل رفع الصورة"));
    } finally {
      setPhotoBusy(null);
    }
  };

  const renderOrder = (t: any) => {
    const paymentMethod = displayValue(t.payment_method === "cash" ? pick("Cash", "كاش") : t.payment_method === "smart_wallet" ? pick("Smart Wallet", "محفظة") : t.payment_method === "instapay" ? "InstaPay" : t.payment_method === "bank_transfer" ? pick("Bank transfer", "تحويل بنكي") : t.payment_method || pick("Not specified", "غير محدد"));
    const paymentState = displayValue(t.payment_status === "paid" ? pick("Paid online", "مدفوع أونلاين") : t.payment_status === "pending" ? pick("Payment pending", "الدفع معلّق") : t.payment_status || (t.payment_method === "cash" ? pick("Pay on delivery", "الدفع كاش") : "—"));
    const amount = Number(t.collection_amount ?? t.amount ?? 0);
    const appointmentTime = t.scheduled_at ? new Date(t.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
    return <article key={t.id} className="panel p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-bold">{displayValue(t.title || pick("Order", "أوردر"))}</h3><Badge>{displayValue(t.status)}</Badge><Badge variant="outline">#{displayValue(t.serial_number || String(t.id).slice(0, 8).toUpperCase())}</Badge></div><p className="text-sm text-muted-foreground">{displayValue(t.wash_type)}</p></div>{t.scheduled_at && <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary"><Clock3 className="size-4" />{fmtDate(t.scheduled_at)} · {appointmentTime}</span>}</div><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">{pick("Customer", "العميل")}</p><p className="font-bold">{displayValue(t.customer_name)}</p><p>{displayValue(t.customer_phone)}</p><p className="text-sm">{displayValue(t.customer_email)}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">{pick("Appointment", "موعد الغسيل")}</p><p className="font-bold">{t.scheduled_at ? `${fmtDate(t.scheduled_at)} · ${appointmentTime}` : "—"}</p></div><div className="rounded-xl border p-4 md:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">{pick("Order amount", "سعر الأوردر")}</p><p className="text-xl font-bold">{amount.toFixed(2)} EGP</p></div><div className="text-end"><p className="text-xs text-muted-foreground">{pick("Payment", "الدفع")}</p><p className="font-semibold">{paymentMethod}</p><p className="text-sm text-muted-foreground">{paymentState}</p></div></div></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">{pick("Subscription / offer", "الاشتراك / العرض")}</p><p className="font-bold">{displayValue(t.package_name || t.offer_name)}</p><p>{t.remaining_washes != null ? `${displayValue(t.remaining_washes)} ${pick("remaining", "متبقي")}` : "—"}</p></div><div className="rounded-xl border p-4 md:col-span-2"><p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-4" />{displayValue(t.location_text || t.location_url)}</p>{(t.location_url || t.location_text || t.latitude != null) && <Button className="mt-2" size="sm" variant="outline" onClick={() => openLocation(t)}><Navigation className="me-1 size-4" />{pick("Open location", "فتح الموقع")}</Button>}</div></div>{t.notes && <p className="mt-3 rounded-xl bg-muted p-4 text-sm">{displayValue(t.notes)}</p>}<div className="mt-4 flex flex-wrap gap-2">
      {t.status === "pending" && <Button disabled={loading === t.id} onClick={() => setStatus(t.id, "accepted")}>{pick("Accept order", "استلام الأوردر")}</Button>}
      {t.status === "accepted" && <Button disabled={loading === t.id} onClick={() => setStatus(t.id, "in_progress")}>{pick("Start", "بدء التنفيذ")}</Button>}
      {t.status === "in_progress" && <Button disabled={loading === t.id} onClick={() => setStatus(t.id, "completed")}><CheckCircle2 className="me-1 size-4" />{pick("Complete order", "إنهاء الأوردر")}</Button>}
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
        <Camera className="size-4" />{pick("Before wash", "قبل الغسيل")}
        <input type="file" accept="image/*" multiple capture="environment" className="hidden" disabled={photoBusy === `${t.id}:before`} onChange={e => { const files = Array.from(e.target.files ?? []); files.forEach(file => void uploadOrderPhoto(t, "before", file)); e.currentTarget.value = ""; }} />
      </label>
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
        <Camera className="size-4" />{pick("After wash", "بعد الغسيل")}
        <input type="file" accept="image/*" multiple capture="environment" className="hidden" disabled={photoBusy === `${t.id}:after`} onChange={e => { const files = Array.from(e.target.files ?? []); files.forEach(file => void uploadOrderPhoto(t, "after", file)); e.currentTarget.value = ""; }} />
      </label>
    </div></article>;
  };

  return <div className="min-h-screen w-full overflow-x-hidden bg-background text-foreground">
    <header className="sticky top-0 z-20 w-full border-b border-white/30 bg-background/90 shadow-lg backdrop-blur-2xl">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
        <div className="flex min-h-[68px] items-center justify-between gap-3 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl">
              <img src={settings?.logo_url || "/icons/tapwash-mark.svg"} alt="TapWash" className="h-10 w-10 object-contain" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-black tracking-wide">TapWash</p>
              <p className="hidden text-xs text-muted-foreground sm:block">{pick("Employee workspace", "مساحة عمل الموظف")}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="outline" size="sm" className="px-2.5" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>{lang === "ar" ? "English" : "العربية"}</Button>
            <Button variant="ghost" size="icon" aria-label={pick("Toggle appearance", "تغيير المظهر")} onClick={toggleTheme}>{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}</Button>
            <Button variant="ghost" size="icon" aria-label={pick("Log out", "تسجيل الخروج")} onClick={logout}><LogOut className="size-4" /></Button>
          </div>
        </div>
        <nav aria-label={pick("Employee work navigation", "قائمة تنقل الموظف")} className="flex w-full items-center gap-2 overflow-x-auto border-t border-border/60 py-2">
          <Button size="sm" className="shrink-0 gap-2" variant={employeePage === "current" ? "default" : "ghost"} onClick={() => setEmployeePage("current")}><ClipboardList className="size-4" />{pick("Current orders", "الأوردرات الحالية")}<Badge variant={employeePage === "current" ? "secondary" : "outline"}>{active.length}</Badge></Button>
          <Button size="sm" className="shrink-0 gap-2" variant={employeePage === "archive" ? "default" : "ghost"} onClick={() => setEmployeePage("archive")}><Archive className="size-4" />{pick("Previous orders", "الأوردرات السابقة")}<Badge variant={employeePage === "archive" ? "secondary" : "outline"}>{completed.length}</Badge></Button>
          <Button size="sm" className="shrink-0 gap-2" variant={employeePage === "profile" ? "default" : "ghost"} onClick={() => setEmployeePage("profile")}><UserCog className="size-4" />{pick("My data", "بياناتي")}</Button>
          <EmployeeMessagesButton />
        </nav>
      </div>
    </header>
    <main className="mx-auto w-full max-w-7xl overflow-x-hidden px-3 pb-28 pt-4 sm:px-6 sm:pb-32 sm:pt-6">
      {employeePage === "profile" && <section className="glass-employee-card mb-4 rounded-3xl border border-white/45 bg-white/10 p-4 shadow-2xl backdrop-blur-2xl dark:border-white/15 dark:bg-white/[0.06] sm:mb-6 sm:p-5">
        <div className="flex items-center gap-4">
          <div className="shrink-0">{profile?.avatar_url ? <img src={profile.avatar_url} alt={employee?.full_name || profile.full_name || "Employee"} className="size-16 rounded-2xl border border-white/40 object-cover shadow-md sm:size-20" /> : <div className="glass-soft flex size-16 items-center justify-center rounded-2xl border border-white/40 text-2xl font-bold shadow-md sm:size-20">{(employee?.full_name || profile?.full_name || user?.email || "E").slice(0, 1).toUpperCase()}</div>}</div>
          <div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-widest text-muted-foreground">{pick("Employee account", "حساب الموظف")}</p><h1 className="truncate text-xl font-bold sm:text-2xl">{employee?.full_name || profile?.full_name || user?.email}</h1><Badge variant="secondary">{pick("Employee", "موظف")}</Badge></div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [pick("Employee ID", "رقم ID الموظف"), employee?.employee_id],
            [pick("Job title", "المسمى الوظيفي"), employee?.job_title],
            [pick("Branch", "الفرع"), employee?.branch],
            [pick("Date of birth", "تاريخ الميلاد"), employee?.birth_date ? fmtDate(employee.birth_date) : null],
            [pick("Qualification", "المؤهل"), employee?.qualification],
            [pick("National ID", "الرقم القومي"), employee?.national_id],
            [pick("Phone", "رقم الهاتف"), profile?.phone],
            [pick("Email", "البريد الإلكتروني"), profile?.email || user?.email],
          ].map(([label, value]) => <div key={String(label)} className="min-w-0 rounded-2xl border border-white/35 bg-white/15 p-3 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]"><p className="truncate text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words font-semibold">{value ? String(value) : "—"}</p></div>)}
        </div>
        <p className="mt-3 rounded-xl border border-white/25 bg-white/10 p-3 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">{pick("Your employee information is view-only. Contact the manager for any correction or account change.", "بيانات الموظف للعرض فقط. المدير وحده المسؤول عن تعديلها أو إجراء أي تغيير على حساب الموظف.")}</p>
      </section>}
      {employeePage === "scan" && <section className="panel mb-4 p-4 sm:mb-6 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl"><ScanLine className="size-5 shrink-0 text-primary" />{pick("Scan customer NFC card", "مسح كارت العميل NFC")}</h2><p className="text-sm text-muted-foreground">{pick("Read the customer data stored on the card.", "اقرأ بيانات العميل المخزنة على الكارت.")}</p></div><Button className="w-full shrink-0 sm:w-auto" size="lg" onClick={scanNfc} disabled={scanning}>{scanning ? pick("Bring card closer...", "قرّب الكارت...") : pick("Scan NFC", "مسح NFC")}</Button></div>{card && <div className="mt-5 space-y-4 rounded-2xl border p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-muted-foreground">{pick("Customer", "العميل")}</p><b>{displayValue(card.customer?.full_name || card.name || card.full_name)}</b><p className="text-xs text-muted-foreground">{displayValue(card.customer?.phone || card.phone)}</p></div><div><p className="text-xs text-muted-foreground">{pick("Vehicle", "العربية")}</p><b>{[card.car?.brand, card.car?.model, card.car?.color, card.car?.plate_number].filter(Boolean).map(displayValue).join(" · ") || "—"}</b></div><div><p className="text-xs text-muted-foreground">{pick("Package", "الباقة")}</p><b>{displayValue(card.subscription?.package_name || card.subscription?.package || card.package_name || card.package)}</b></div><div><p className="text-xs text-muted-foreground">{pick("Remaining washes", "الغسلات المتبقية")}</p><b className="text-2xl text-primary">{displayValue(card.subscription?.remaining_washes ?? card.remaining_washes)}</b></div></div><div className="flex flex-wrap items-center justify-end gap-3"><Button onClick={() => void deductScannedWash()} disabled={loading === "nfc" || Number(card.subscription?.remaining_washes ?? card.remaining_washes ?? 0) <= 0}><Droplets className="me-1 size-4" />{loading === "nfc" ? pick("Recording...", "جاري التسجيل...") : pick("Record wash — deduct 1", "تسجيل الغسلة — خصم 1")}</Button></div></div>}</section>}
      {(employeePage === "current" || employeePage === "archive") && <section className="panel p-4 sm:p-5"><div className="mb-4"><h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl">{employeePage === "current" ? <ClipboardList className="size-5 text-primary" /> : <Archive className="size-5 text-primary" />}{employeePage === "current" ? pick("Current orders", "الأوردرات الحالية") : pick("Previous orders", "الأوردرات السابقة")}</h2><p className="text-sm text-muted-foreground">{employeePage === "current" ? pick("Orders assigned to you that still need action.", "الأوردرات المسندة إليك والتي لم تنتهِ بعد.") : pick("Your completed orders, grouped by completion day.", "أوردراتك المكتملة مقسمة حسب يوم الإنجاز.")}</p></div><div className="space-y-4">
        {employeePage === "current" && <div className="grid gap-3 sm:grid-cols-3">
          <div className="panel p-4"><div className="flex items-center gap-3"><span className="surface-blue flex size-10 items-center justify-center rounded-xl"><ClipboardList className="size-5" /></span><div><p className="text-xs text-muted-foreground">{pick("Today's orders", "إجمالي الأوردرات اليوم")}</p><p className="text-2xl font-extrabold tabular-nums">{todayOrders.length}</p></div></div></div>
          <div className="panel p-4"><div className="flex items-center gap-3"><span className="surface-blue flex size-10 items-center justify-center rounded-xl"><Banknote className="size-5" /></span><div><p className="text-xs text-muted-foreground">{pick("Today's collection", "إجمالي التحصيل اليوم")}</p><p className="text-2xl font-extrabold tabular-nums">{money(todayCollection)}</p></div></div></div>
          <div className="panel p-4"><div className="flex items-center gap-3"><span className="surface-blue flex size-10 items-center justify-center rounded-xl"><Clock3 className="size-5" /></span><div><p className="text-xs text-muted-foreground">{pick("Available orders", "الأوردرات المتاحة")}</p><p className="text-2xl font-extrabold tabular-nums">{active.length}</p></div></div></div>
        </div>}
        {employeePage === "current" ? (
          active.length ? active.map(renderOrder) : <p className="py-8 text-center text-sm text-muted-foreground">{pick("No orders", "لا توجد أوردرات")}</p>
        ) : Object.entries(archiveGroups).length ? Object.entries(archiveGroups).sort(([a], [b]) => b.localeCompare(a)).map(([day, dayTasks]) => <div key={day} className="space-y-3">
          <h3 className="border-b pb-2 text-sm font-bold text-muted-foreground">{new Date(day + "T00:00:00").toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</h3>
          {(dayTasks as any[]).map((task: any) => <article key={task.id} className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold">{displayValue(task.title || pick("Order", "أوردر"))}</p><p className="text-xs text-muted-foreground">#{displayValue(task.serial_number || String(task.id).slice(0, 8).toUpperCase())}</p></div><Badge variant="secondary">{pick("Completed", "مكتمل")}</Badge></div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <p><span className="text-muted-foreground">{pick("Customer", "العميل")}: </span>{displayValue(task.customer_name)}</p>
              <p><span className="text-muted-foreground">{pick("Phone", "الهاتف")}: </span>{displayValue(task.customer_phone)}</p>
              <p><span className="text-muted-foreground">{pick("Package", "الباقة")}: </span>{displayValue(task.package_name || task.offer_name)}</p>
              <p><span className="text-muted-foreground">{pick("Remaining washes", "الغسلات المتبقية")}: </span>{displayValue(task.remaining_washes)}</p>
              <p><span className="text-muted-foreground">{pick("Completed at", "تاريخ الإكمال")}: </span>{fmtDate(task.completed_at || task.updated_at || task.created_at)}</p>
              <p><span className="text-muted-foreground">{pick("Amount", "المبلغ")}: </span>{Number(task.collection_amount ?? task.amount ?? 0).toFixed(2)} EGP</p>
            </div>
          </article>)}
        </div>) : <p className="py-8 text-center text-sm text-muted-foreground">{pick("No completed orders", "لا توجد أوردرات مكتملة")}</p>}
      </div></section>}
      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{pick("TapWash support", "دعم TapWash")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border p-3"><span className="size-2 rounded-full bg-amber-500" /><p className="text-sm font-semibold">{pick("Management connection is being prepared", "جاري تجهيز الربط مع الإدارة")}</p></div>
            <p className="text-sm text-muted-foreground">{pick("Direct messaging with management will be enabled in the next development step. This button is ready as the entry point.", "سيتم تفعيل المراسلة المباشرة مع الإدارة في خطوة التطوير القادمة. الزر جاهز ليكون نقطة الدخول.")}</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSupportOpen(false)}>{pick("Close", "إغلاق")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><MapPin className="size-5 text-primary" />{pick("Customer location — current order", "موقع العميل — الأوردر الحالي")}</DialogTitle></DialogHeader>
          {active.length > 1 && <div className="flex flex-wrap gap-2">{active.map((task: any) => <Button key={task.id} size="sm" variant={String(mapTask?.id) === String(task.id) ? "default" : "outline"} onClick={() => setSelectedMapTaskId(String(task.id))}>#{displayValue(task.serial_number || String(task.id).slice(0, 8).toUpperCase())}</Button>)}</div>}
          {mapTask ? <>
            <div className="rounded-xl border p-3"><p className="font-semibold">{displayValue(mapTask.customer_name)}</p><p className="text-sm text-muted-foreground">{displayValue(mapTask.location_text || mapTask.location_url || customerMapQuery)}</p></div>
            {(driverLocation || map || customerMapPoint) && <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{pick("Live delivery location", "موقع الدليفري المباشر")}</p>
                {driverLocation?.updated_at && <span className="text-xs text-muted-foreground">{pick("Last update:", "آخر تحديث:")} {new Date(driverLocation.updated_at).toLocaleTimeString()}</span>}
              </div>
              <DeliveryMap destination={customerMapPoint} driver={driverLocation && Number.isFinite(Number(driverLocation.latitude)) && Number.isFinite(Number(driverLocation.longitude)) ? { lat: Number(driverLocation.latitude), lng: Number(driverLocation.longitude), updatedAt: driverLocation.updated_at } : null} height="280px" />
              {!driverLocation && <p className="text-xs text-amber-600">{pick("Waiting for GPS permission and a location fix…", "في انتظار إذن الموقع وتحديد إحداثيات الهاتف…")}</p>}
            </div>}
            {customerMapQuery ? <iframe title="Customer location map" src={"https://www.google.com/maps?q=" + encodeURIComponent(customerMapQuery) + "&output=embed"} className="h-64 w-full rounded-xl border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : !customerMapPoint && !driverLocation && !map ? <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">{pick("No customer or delivery GPS location is available yet.", "لا يتوفر موقع GPS للعميل أو الدليفري حتى الآن.")}</p> : null}
            <p className="text-sm font-semibold">{pick("Open with", "فتح باستخدام")}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => openCustomerMap("google")} disabled={!customerMapQuery}>Google Maps</Button>
              <Button variant="outline" onClick={() => openCustomerMap("waze")} disabled={!customerMapQuery}>Waze</Button>
              <Button variant="outline" onClick={() => openCustomerMap("apple")} disabled={!customerMapQuery}>Apple Maps</Button>
              <Button variant="outline" onClick={() => openCustomerMap("osm")} disabled={!customerMapQuery}>OpenStreetMap</Button>
            </div>
            <p className="text-xs text-muted-foreground">{pick("Your phone will open the selected app if installed; otherwise it may open the service in your browser.", "سيُفتح التطبيق المحدد إذا كان مثبتًا على الهاتف، وإلا فقد تُفتح الخدمة في المتصفح.")}</p>
          </> : <p className="py-8 text-center text-sm text-muted-foreground">{pick("There is no active order assigned to you.", "لا يوجد أوردر حالي مسند إليك.")}</p>}
        </DialogContent>
      </Dialog>
      <div dir="rtl" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),14px)]">
        <div className="pointer-events-auto mx-auto flex w-full max-w-[390px] items-center justify-center gap-3 bg-transparent p-0">
          <Button type="button" variant="ghost" aria-label={pick("Customer map", "خريطة العميل")} className="group relative flex h-[74px] min-w-0 flex-1 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[24px] border border-white/65 bg-white/55 px-1 text-[11px] font-semibold text-foreground shadow-[0_6px_18px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/75 active:translate-y-0 disabled:opacity-60 dark:border-slate-600/70 dark:bg-slate-900/85 dark:text-slate-100 dark:shadow-[0_6px_18px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.08)] dark:hover:bg-slate-800/90" onClick={() => { setSelectedMapTaskId(active[0] ? String(active[0].id) : null); setMapDialogOpen(true); }}>
            <span className="flex size-9 items-center justify-center rounded-[13px] border border-white/60 bg-white/55 text-primary shadow-sm transition-transform duration-200 group-hover:scale-105 dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-sky-300"><MapPin className="size-[19px]" /></span>
            <span className="truncate">{pick("Customer map", "خريطة العميل")}</span>
          </Button>
          <Button type="button" variant="ghost" aria-label={pick("Scan NFC", "مسح NFC")} className="group relative flex h-[74px] min-w-0 flex-1 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[24px] border border-white/65 bg-white/55 px-1 text-[11px] font-semibold text-foreground shadow-[0_6px_18px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/75 active:translate-y-0 disabled:opacity-60 dark:border-slate-600/70 dark:bg-slate-900/85 dark:text-slate-100 dark:shadow-[0_6px_18px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.08)] dark:hover:bg-slate-800/90" onClick={() => { setEmployeePage("scan"); void scanNfc(); }} disabled={scanning}>
            <span className="flex size-9 items-center justify-center rounded-[13px] border border-white/60 bg-white/55 text-primary shadow-sm transition-transform duration-200 group-hover:scale-105 dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-sky-300"><ScanLine className="size-[21px]" /></span>
            <span className="truncate">{scanning ? pick("Scanning…", "جاري المسح…") : pick("Scan NFC", "مسح NFC")}</span>
          </Button>
          <Button type="button" variant="ghost" aria-label={pick("Support", "الدعم")} className="group relative flex h-[74px] min-w-0 flex-1 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[24px] border border-white/65 bg-white/55 px-1 text-[11px] font-semibold text-foreground shadow-[0_6px_18px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/75 active:translate-y-0 disabled:opacity-60 dark:border-slate-600/70 dark:bg-slate-900/85 dark:text-slate-100 dark:shadow-[0_6px_18px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.08)] dark:hover:bg-slate-800/90" onClick={() => setSupportOpen(true)}>
            <span className="flex size-9 items-center justify-center rounded-[13px] border border-white/60 bg-white/55 text-primary shadow-sm transition-transform duration-200 group-hover:scale-105 dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-sky-300"><MessageCircle className="size-[19px]" /></span>
            <span className="truncate">{pick("Support", "الدعم")}</span>
          </Button>
        </div>
      </div>
    </main></div>;
}
