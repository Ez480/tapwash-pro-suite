import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Clock3, Droplets, KeyRound, LogOut, MapPin, Moon, Navigation, ScanLine, Sun, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSession, useUserRoles } from "@/lib/auth";
import { useAdminTable, useMyEmployee, useProfile } from "@/lib/data";

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

function EmployeeTasks() {
  const { pick, fmtDate, lang, setLang } = useI18n();
  const { user } = useSession();
  const { data: roles = [] } = useUserRoles(user?.id);
  const { data: profile, refetch: refetchProfile } = useProfile(user?.id);
  const { data: tasks = [], refetch } = useAdminTable("employee_tasks", "*", "created_at");
  const { data: employee, refetch: refetchEmployee } = useMyEmployee(user?.id);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "" });
  const [password, setPassword] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [map, setMap] = useState<{ lat: number; lng: number } | null>(null);
  const [card, setCard] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [ordersView, setOrdersView] = useState<"current" | "previous">("current");
  const [loading, setLoading] = useState<string | null>(null);
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

  const renderOrder = (t: any) => {
    const paymentMethod = displayValue(t.payment_method === "cash" ? pick("Cash", "كاش") : t.payment_method === "smart_wallet" ? pick("Smart Wallet", "محفظة") : t.payment_method === "instapay" ? "InstaPay" : t.payment_method === "bank_transfer" ? pick("Bank transfer", "تحويل بنكي") : t.payment_method || pick("Not specified", "غير محدد"));
    const paymentState = displayValue(t.payment_status === "paid" ? pick("Paid online", "مدفوع أونلاين") : t.payment_status === "pending" ? pick("Payment pending", "الدفع معلّق") : t.payment_status || (t.payment_method === "cash" ? pick("Pay on delivery", "الدفع كاش") : "—"));
    const amount = Number(t.collection_amount ?? t.amount ?? 0);
    const appointmentTime = t.scheduled_at ? new Date(t.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
    return <article key={t.id} className="panel p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-bold">{displayValue(t.title || pick("Order", "أوردر"))}</h3><Badge>{displayValue(t.status)}</Badge><Badge variant="outline">#{displayValue(t.serial_number || String(t.id).slice(0, 8).toUpperCase())}</Badge></div><p className="text-sm text-muted-foreground">{displayValue(t.wash_type)}</p></div>{t.scheduled_at && <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary"><Clock3 className="size-4" />{fmtDate(t.scheduled_at)} · {appointmentTime}</span>}</div><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">{pick("Customer", "العميل")}</p><p className="font-bold">{displayValue(t.customer_name)}</p><p>{displayValue(t.customer_phone)}</p><p className="text-sm">{displayValue(t.customer_email)}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">{pick("Appointment", "موعد الغسيل")}</p><p className="font-bold">{t.scheduled_at ? `${fmtDate(t.scheduled_at)} · ${appointmentTime}` : "—"}</p></div><div className="rounded-xl border p-4 md:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">{pick("Order amount", "سعر الأوردر")}</p><p className="text-xl font-bold">{amount.toFixed(2)} EGP</p></div><div className="text-end"><p className="text-xs text-muted-foreground">{pick("Payment", "الدفع")}</p><p className="font-semibold">{paymentMethod}</p><p className="text-sm text-muted-foreground">{paymentState}</p></div></div></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">{pick("Subscription / offer", "الاشتراك / العرض")}</p><p className="font-bold">{displayValue(t.package_name || t.offer_name)}</p><p>{t.remaining_washes != null ? `${displayValue(t.remaining_washes)} ${pick("remaining", "متبقي")}` : "—"}</p></div><div className="rounded-xl border p-4 md:col-span-2"><p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-4" />{displayValue(t.location_text || t.location_url)}</p>{(t.location_url || t.location_text || t.latitude != null) && <Button className="mt-2" size="sm" variant="outline" onClick={() => openLocation(t)}><Navigation className="me-1 size-4" />{pick("Open location", "فتح الموقع")}</Button>}</div></div>{t.notes && <p className="mt-3 rounded-xl bg-muted p-4 text-sm">{displayValue(t.notes)}</p>}<div className="mt-4 flex flex-wrap gap-2">{t.status === "pending" && <Button disabled={loading === t.id} onClick={() => setStatus(t.id, "accepted")}>{pick("Accept order", "استلام الأوردر")}</Button>}{t.status === "accepted" && <Button disabled={loading === t.id} onClick={() => setStatus(t.id, "in_progress")}>{pick("Start", "بدء التنفيذ")}</Button>}{t.status === "in_progress" && <Button disabled={loading === t.id} onClick={() => setStatus(t.id, "completed")}><CheckCircle2 className="me-1 size-4" />{pick("Complete order", "إنهاء الأوردر")}</Button>}</div></article>;
  };

  return <div className="min-h-screen w-full overflow-x-hidden bg-background text-foreground"><header className="sticky top-0 z-20 w-full border-b border-border/70 bg-background/75 backdrop-blur-2xl"><div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-3 py-2 sm:flex-nowrap sm:gap-3 sm:px-6 sm:py-3"><div className="flex min-w-0 shrink-0 items-center gap-2"><div className="glass-soft flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/40 shadow-sm sm:size-10">T</div><div className="min-w-0"><p className="truncate font-bold">TapWash</p><p className="hidden text-xs text-muted-foreground sm:block">{pick("Employee dashboard", "لوحة الموظف")}</p></div></div><div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:ms-auto sm:w-auto sm:flex-nowrap sm:gap-2"><Button className="min-w-0 flex-1 sm:flex-none" variant="outline" size="sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>{lang === "ar" ? "English" : "العربية"}</Button><Button className="min-w-0 flex-1 sm:flex-none" variant="outline" size="sm" onClick={() => map ? window.open(`https://www.google.com/maps/search/?api=1&query=${map.lat},${map.lng}`, "_blank") : toast.info(pick("Location unavailable", "الموقع غير متاح"))}><MapPin className="me-1 size-4" />{pick("My location", "موقعي")}</Button><Button className="shrink-0" variant="ghost" size="icon" onClick={toggleTheme}>{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}</Button><Button className="min-w-0 flex-1 sm:flex-none" variant="outline" size="sm" onClick={logout}><LogOut className="me-1 size-4" />{pick("Logout", "خروج")}</Button></div></div></header>
    <main className="mx-auto w-full max-w-7xl overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6">
      <section className="glass-employee-card mb-4 rounded-3xl border border-white/45 bg-white/10 p-4 shadow-2xl backdrop-blur-2xl dark:border-white/15 dark:bg-white/[0.06] sm:mb-6 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center"><div className="relative shrink-0 self-start sm:self-auto"><label className="group block cursor-pointer"><input type="file" accept="image/*" className="sr-only" disabled={avatarBusy} onChange={e => void uploadAvatar(e.target.files?.[0])} />{profile?.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name || "Employee"} className="size-16 rounded-2xl border border-white/40 object-cover shadow-md sm:size-20" /> : <div className="glass-soft flex size-16 items-center justify-center rounded-2xl border border-white/40 text-2xl font-bold shadow-md sm:size-20">{(profile?.full_name || user?.email || "E").slice(0, 1).toUpperCase()}</div>}<span className="absolute -bottom-2 -end-2 flex size-8 items-center justify-center rounded-full border border-white/60 bg-background/75 shadow-md backdrop-blur-xl sm:size-9"><Camera className="size-4" /></span></label></div><div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-widest text-muted-foreground">{pick("Employee account", "حساب الموظف")}</p><h1 className="truncate text-xl font-bold sm:text-2xl">{profile?.full_name || user?.email}</h1><Badge variant="secondary">{pick("Employee", "موظف")}</Badge></div><div className="grid w-full grid-cols-1 gap-2 sm:ms-auto sm:min-w-0 sm:flex-1 sm:grid-cols-2 sm:max-w-2xl"><div className="min-w-0 rounded-2xl border border-white/35 bg-white/15 p-3 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]"><p className="truncate text-xs text-muted-foreground">{pick("Employee ID", "رقم ID الموظف")}</p><p className="truncate font-bold">{employee?.employee_id || "—"}</p></div><div className="min-w-0 rounded-2xl border border-white/35 bg-white/15 p-3 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]"><p className="truncate text-xs text-muted-foreground">{pick("Job title", "المسمى الوظيفي")}</p><p className="truncate font-bold">{employee?.job_title || pick("Employee", "موظف")}</p></div></div><div className="flex w-full flex-wrap gap-2 sm:w-auto"><Dialog open={profileOpen} onOpenChange={setProfileOpen}><DialogTrigger asChild><Button className="min-w-0 flex-1 sm:flex-none" variant="outline"><UserCog className="me-1 size-4" />{pick("Profile", "البروفايل")}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{pick("Edit profile", "تعديل البروفايل")}</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>{pick("Full name", "الاسم")}</Label><Input value={profileForm.full_name} onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })} /></div><div><Label>{pick("Phone", "الهاتف")}</Label><Input value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} /></div><div><Label>{pick("Profile photo", "صورة البروفايل")}</Label><Input type="file" accept="image/*" disabled={avatarBusy} onChange={e => void uploadAvatar(e.target.files?.[0])} /></div></div><DialogFooter><Button onClick={saveProfile}>{pick("Save", "حفظ")}</Button></DialogFooter></DialogContent></Dialog><Dialog open={passwordOpen} onOpenChange={setPasswordOpen}><DialogTrigger asChild><Button className="min-w-0 flex-1 sm:flex-none" variant="outline"><KeyRound className="me-1 size-4" />{pick("Password", "كلمة المرور")}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{pick("Change password", "تغيير كلمة المرور")}</DialogTitle></DialogHeader><Input type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} /><DialogFooter><Button onClick={changePassword} disabled={password.length < 6}>{pick("Save", "حفظ")}</Button></DialogFooter></DialogContent></Dialog></div></div></section>
      <section className="panel mb-4 p-4 sm:mb-6 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl"><ScanLine className="size-5 shrink-0 text-primary" />{pick("Scan customer NFC card", "مسح كارت العميل NFC")}</h2><p className="text-sm text-muted-foreground">{pick("Read the customer data stored on the card.", "اقرأ بيانات العميل المخزنة على الكارت.")}</p></div><Button className="w-full shrink-0 sm:w-auto" size="lg" onClick={scanNfc} disabled={scanning}>{scanning ? pick("Bring card closer...", "قرّب الكارت...") : pick("Scan NFC", "مسح NFC")}</Button></div>{card && <div className="mt-5 space-y-4 rounded-2xl border p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-muted-foreground">{pick("Customer", "العميل")}</p><b>{displayValue(card.customer?.full_name || card.name || card.full_name)}</b><p className="text-xs text-muted-foreground">{displayValue(card.customer?.phone || card.phone)}</p></div><div><p className="text-xs text-muted-foreground">{pick("Vehicle", "العربية")}</p><b>{[card.car?.brand, card.car?.model, card.car?.color, card.car?.plate_number].filter(Boolean).map(displayValue).join(" · ") || "—"}</b></div><div><p className="text-xs text-muted-foreground">{pick("Package", "الباقة")}</p><b>{displayValue(card.subscription?.package_name || card.subscription?.package || card.package_name || card.package)}</b></div><div><p className="text-xs text-muted-foreground">{pick("Remaining washes", "الغسلات المتبقية")}</p><b className="text-2xl text-primary">{displayValue(card.subscription?.remaining_washes ?? card.remaining_washes)}</b></div></div><div className="flex flex-wrap items-center justify-end gap-3"><Button onClick={() => void deductScannedWash()} disabled={loading === "nfc" || Number(card.subscription?.remaining_washes ?? card.remaining_washes ?? 0) <= 0}><Droplets className="me-1 size-4" />{loading === "nfc" ? pick("Recording...", "جاري التسجيل...") : pick("Record wash — deduct 1", "تسجيل الغسلة — خصم 1")}</Button></div></div>}</section>
      <section className="panel p-4 sm:p-5"><div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl"><UserCog className="size-5 shrink-0 text-primary" />{pick("My orders", "أوردراتي")}</h2><p className="text-sm text-muted-foreground">{pick("Current orders and completed orders are kept separately.", "الأوردرات الحالية والمنتهية منفصلة ويتم الاحتفاظ بالسجل السابق.")}</p></div><div className="flex w-full flex-wrap gap-2 sm:w-auto"><Button className="min-w-0 flex-1 sm:flex-none" variant={ordersView === "current" ? "default" : "outline"} onClick={() => setOrdersView("current")}>{pick("Current", "الأوردرات الحالية")} <Badge variant={ordersView === "current" ? "secondary" : "outline"} className="ms-1">{active.length}</Badge></Button><Button className="min-w-0 flex-1 sm:flex-none" variant={ordersView === "previous" ? "default" : "outline"} onClick={() => setOrdersView("previous")}>{pick("Previous", "الأوردرات السابقة")} <Badge variant={ordersView === "previous" ? "secondary" : "outline"} className="ms-1">{completed.length}</Badge></Button></div></div><div className="space-y-4">{(ordersView === "current" ? active : completed).length ? (ordersView === "current" ? active : completed).map(renderOrder) : <p className="py-8 text-center text-sm text-muted-foreground">{pick("No orders", "لا توجد أوردرات")}</p>}</div></section>
    </main></div>;
}