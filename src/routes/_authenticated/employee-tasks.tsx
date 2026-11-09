import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Archive, Bell, Camera, CheckCircle2, ClipboardList, Clock3, Droplets, KeyRound, LogOut, MapPin, MessageCircle, Moon, Navigation, ScanLine, Sun, UserCog } from "lucide-react";
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

declare global { interface Window { NDEFReader?: any } }
export const Route = createFileRoute("/_authenticated/employee-tasks")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const roleNames = (roleRows ?? []).map((row) => String(row.role));
    if (!roleNames.includes("employee")) throw redirect({ to: roleNames.includes("admin") ? "/admin" : "/dashboard" });
  },
  component: EmployeeTasks,
});

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

function EmployeeTasks() {
  const { pick, fmtDate, lang, setLang } = useI18n();
  const { user } = useSession();
  const { data: roles = [] } = useUserRoles(user?.id);
  const { data: profile, refetch: refetchProfile } = useProfile(user?.id);
  const { data: tasks = [], refetch } = useAdminTable("employee_tasks", "*", "created_at");
  const { data: employee, refetch: refetchEmployee } = useMyEmployee(user?.id);
  const { data: settings } = useSettings();
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "" });
  const [password, setPassword] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [map, setMap] = useState<{ lat: number; lng: number } | null>(null);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [selectedMapTaskId, setSelectedMapTaskId] = useState<string | null>(null);
  const [card, setCard] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [employeePage, setEmployeePage] = useState<"current" | "archive" | "profile" | "scan">("current"); const [supportOpen, setSupportOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  const locationWatchRef = useRef<number | null>(null);

  useEffect(() => { if (profile) setProfileForm({ full_name: profile.full_name ?? "", phone: profile.phone ?? "" }); }, [profile]);
  useEffect(() => { if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => setMap({ lat: p.coords.latitude, lng: p.coords.longitude }), () => undefined, { enableHighAccuracy: true, timeout: 8000 }); }, []);
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`employee-self-${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "employees", filter: `user_id=eq.${user.id}` }, () => void refetchEmployee()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, refetchEmployee]);

  const mine = roles.includes("employee") ? (tasks as any[]).filter(t => t.employee_id === user?.id) : [];
  const active = mine.filter(t => ["pending", "accepted", "in_progress"].includes(t.status));
  const completed = mine.filter(t => t.status === "completed");
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
  const saveProfile = async () => { if (!user) return; const { error } = await supabase.from("profiles").update({ full_name: profileForm.full_name, phone: profileForm.phone, language: lang }).eq("id", user.id); if (error) return toast.error(error.message); toast.success(pick("Profile updated", "تم تحديث البروفايل")); setProfileOpen(false); refetchProfile(); };
  const uploadAvatar = async (file?: File) => { if (!file || !user) return; if (!file.type.startsWith("image/")) return toast.error(pick("Please choose an image", "اختر صورة فقط")); if (file.size > 10 * 1024 * 1024) return toast.error(pick("Maximum image size is 10 MB", "أقصى حجم للصورة 10 ميجابايت")); setAvatarBusy(true); const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"; const path = `avatars/${user.id}/${Date.now()}.${ext}`; const { error: uploadError } = await supabase.storage.from("tapwash-media").upload(path, file, { upsert: true, contentType: file.type }); if (uploadError) { setAvatarBusy(false); return toast.error(uploadError.message); } const { data } = supabase.storage.from("tapwash-media").getPublicUrl(path); const { error } = await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id); setAvatarBusy(false); if (error) return toast.error(error.message); toast.success(pick("Profile photo updated", "تم تحديث صورة البروفايل")); refetchProfile(); };
  const changePassword = async () => { if (password.length < 6) return; const { error } = await supabase.auth.updateUser({ password }); if (error) return toast.error(error.message); toast.success(pick("Password changed", "تم تغيير كلمة المرور")); setPassword(""); setPasswordOpen(false); };
  const logout = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };
  const openLocation = (t: any) => { const u = t.location_url || (t.latitude != null && t.longitude != null ? `https://www.google.com/maps/search/?api=1&query=${t.latitude},${t.longitude}` : t.location_text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.location_text)}` : null); if (u) window.open(u, "_blank", "noopener,noreferrer"); };
  const mapTask = active.find((task: any) => String(task.id) === selectedMapTaskId) || active[0] || null;
  const customerMapQuery = mapTask ? (mapTask.latitude != null && mapTask.longitude != null ? String(mapTask.latitude) + "," + String(mapTask.longitude) : String(mapTask.location_text || mapTask.location_url || "").trim()) : "";
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
          <EmployeeMessagesButton />
        </nav>
      </div>
    </header>
    <main className="mx-auto w-full max-w-7xl overflow-x-hidden px-3 pb-28 pt-4 sm:px-6 sm:pb-32 sm:pt-6">
      {employeePage === "profile" && <section className="glass-employee-card mb-4 rounded-3xl border border-white/45 bg-white/10 p-4 shadow-2xl backdrop-blur-2xl dark:border-white/15 dark:bg-white/[0.06] sm:mb-6 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center"><div className="relative shrink-0 self-start sm:self-auto"><label className="group block cursor-pointer"><input type="file" accept="image/*" className="sr-only" disabled={avatarBusy} onChange={e => void uploadAvatar(e.target.files?.[0])} />{profile?.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name || "Employee"} className="size-16 rounded-2xl border border-white/40 object-cover shadow-md sm:size-20" /> : <div className="glass-soft flex size-16 items-center justify-center rounded-2xl border border-white/40 text-2xl font-bold shadow-md sm:size-20">{(profile?.full_name || user?.email || "E").slice(0, 1).toUpperCase()}</div>}<span className="absolute -bottom-2 -end-2 flex size-8 items-center justify-center rounded-full border border-white/60 bg-background/75 shadow-md backdrop-blur-xl sm:size-9"><Camera className="size-4" /></span></label></div><div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-widest text-muted-foreground">{pick("Employee account", "حساب الموظف")}</p><h1 className="truncate text-xl font-bold sm:text-2xl">{profile?.full_name || user?.email}</h1><Badge variant="secondary">{pick("Employee", "موظف")}</Badge></div><div className="grid w-full grid-cols-1 gap-2 sm:ms-auto sm:min-w-0 sm:flex-1 sm:grid-cols-2 sm:max-w-2xl"><div className="min-w-0 rounded-2xl border border-white/35 bg-white/15 p-3 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]"><p className="truncate text-xs text-muted-foreground">{pick("Employee ID", "رقم ID الموظف")}</p><p className="truncate font-bold">{employee?.employee_id || "—"}</p></div><div className="min-w-0 rounded-2xl border border-white/35 bg-white/15 p-3 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]"><p className="truncate text-xs text-muted-foreground">{pick("Job title", "المسمى الوظيفي")}</p><p className="truncate font-bold">{employee?.job_title || pick("Employee", "موظف")}</p></div></div><div className="flex w-full flex-wrap gap-2 sm:w-auto"><Dialog open={profileOpen} onOpenChange={setProfileOpen}><DialogTrigger asChild><Button className="min-w-0 flex-1 sm:flex-none" variant="outline"><UserCog className="me-1 size-4" />{pick("Profile", "البروفايل")}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{pick("Edit profile", "تعديل البروفايل")}</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>{pick("Full name", "الاسم")}</Label><Input value={profileForm.full_name} onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })} /></div><div><Label>{pick("Phone", "الهاتف")}</Label><Input value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} /></div><div><Label>{pick("Profile photo", "صورة البروفايل")}</Label><Input type="file" accept="image/*" disabled={avatarBusy} onChange={e => void uploadAvatar(e.target.files?.[0])} /></div></div><DialogFooter><Button onClick={saveProfile}>{pick("Save", "حفظ")}</Button></DialogFooter></DialogContent></Dialog><Dialog open={passwordOpen} onOpenChange={setPasswordOpen}><DialogTrigger asChild><Button className="min-w-0 flex-1 sm:flex-none" variant="outline"><KeyRound className="me-1 size-4" />{pick("Password", "كلمة المرور")}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{pick("Change password", "تغيير كلمة المرور")}</DialogTitle></DialogHeader><Input type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} /><DialogFooter><Button onClick={changePassword} disabled={password.length < 6}>{pick("Save", "حفظ")}</Button></DialogFooter></DialogContent></Dialog></div></div></section>}
      {employeePage === "scan" && <section className="panel mb-4 p-4 sm:mb-6 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl"><ScanLine className="size-5 shrink-0 text-primary" />{pick("Scan customer NFC card", "مسح كارت العميل NFC")}</h2><p className="text-sm text-muted-foreground">{pick("Read the customer data stored on the card.", "اقرأ بيانات العميل المخزنة على الكارت.")}</p></div><Button className="w-full shrink-0 sm:w-auto" size="lg" onClick={scanNfc} disabled={scanning}>{scanning ? pick("Bring card closer...", "قرّب الكارت...") : pick("Scan NFC", "مسح NFC")}</Button></div>{card && <div className="mt-5 space-y-4 rounded-2xl border p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-muted-foreground">{pick("Customer", "العميل")}</p><b>{displayValue(card.customer?.full_name || card.name || card.full_name)}</b><p className="text-xs text-muted-foreground">{displayValue(card.customer?.phone || card.phone)}</p></div><div><p className="text-xs text-muted-foreground">{pick("Vehicle", "العربية")}</p><b>{[card.car?.brand, card.car?.model, card.car?.color, card.car?.plate_number].filter(Boolean).map(displayValue).join(" · ") || "—"}</b></div><div><p className="text-xs text-muted-foreground">{pick("Package", "الباقة")}</p><b>{displayValue(card.subscription?.package_name || card.subscription?.package || card.package_name || card.package)}</b></div><div><p className="text-xs text-muted-foreground">{pick("Remaining washes", "الغسلات المتبقية")}</p><b className="text-2xl text-primary">{displayValue(card.subscription?.remaining_washes ?? card.remaining_washes)}</b></div></div><div className="flex flex-wrap items-center justify-end gap-3"><Button onClick={() => void deductScannedWash()} disabled={loading === "nfc" || Number(card.subscription?.remaining_washes ?? card.remaining_washes ?? 0) <= 0}><Droplets className="me-1 size-4" />{loading === "nfc" ? pick("Recording...", "جاري التسجيل...") : pick("Record wash — deduct 1", "تسجيل الغسلة — خصم 1")}</Button></div></div>}</section>}
      {(employeePage === "current" || employeePage === "archive") && <section className="panel p-4 sm:p-5"><div className="mb-4"><h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl">{employeePage === "current" ? <ClipboardList className="size-5 text-primary" /> : <Archive className="size-5 text-primary" />}{employeePage === "current" ? pick("Current orders", "الأوردرات الحالية") : pick("Previous orders", "الأوردرات السابقة")}</h2><p className="text-sm text-muted-foreground">{employeePage === "current" ? pick("Orders assigned to you that still need action.", "الأوردرات المسندة إليك والتي لم تنتهِ بعد.") : pick("Your completed orders, grouped by completion day.", "أوردراتك المكتملة مقسمة حسب يوم الإنجاز.")}</p></div><div className="space-y-4">
        {employeePage === "current" ? (
          active.length ? active.map(renderOrder) : <p className="py-8 text-center text-sm text-muted-foreground">{pick("No orders", "لا توجد أوردرات")}</p>
        )}
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
            {customerMapQuery ? <iframe title="Customer location map" src={"https://www.google.com/maps?q=" + encodeURIComponent(customerMapQuery) + "&output=embed"} className="h-64 w-full rounded-xl border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">{pick("No location was added to this order.", "لم يتم إضافة موقع لهذا الأوردر.")}</p>}
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
        <div className="pointer-events-auto mx-auto flex w-full max-w-md items-center justify-between gap-3 rounded-[28px] border border-white/35 bg-white/55 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.20)] backdrop-blur-2xl dark:border-white/15 dark:bg-slate-950/55">
          <Button type="button" variant="ghost" className="flex h-[66px] min-w-0 flex-1 flex-col gap-1 rounded-2xl border border-white/30 bg-white/35 text-xs shadow-sm backdrop-blur-xl hover:bg-white/55 dark:border-white/10 dark:bg-white/[0.07] dark:hover:bg-white/[0.13]" onClick={() => { setSelectedMapTaskId(active[0] ? String(active[0].id) : null); setMapDialogOpen(true); }}>
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><MapPin className="size-5" /></span>{pick("Customer map", "خريطة العميل")}
          </Button>
          <Button type="button" className="flex h-[66px] min-w-0 flex-1 flex-col gap-1 rounded-2xl border border-white/25 bg-primary/90 text-xs shadow-lg backdrop-blur-xl" onClick={() => { setEmployeePage("scan"); void scanNfc(); }} disabled={scanning}>
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15"><ScanLine className="size-6" /></span>{scanning ? pick("Scanning…", "جاري المسح…") : pick("Scan NFC", "مسح NFC")}
          </Button>
          <Button type="button" variant="ghost" className="flex h-[66px] min-w-0 flex-1 flex-col gap-1 rounded-2xl border border-white/30 bg-white/35 text-xs shadow-sm backdrop-blur-xl hover:bg-white/55 dark:border-white/10 dark:bg-white/[0.07] dark:hover:bg-white/[0.13]" onClick={() => setSupportOpen(true)}>
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><MessageCircle className="size-5" /></span>{pick("Support", "الدعم")}
          </Button>
        </div>
      </div>
    </main></div>;