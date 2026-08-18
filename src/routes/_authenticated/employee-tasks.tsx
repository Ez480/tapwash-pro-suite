import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Camera, CheckCircle2, Clock3, KeyRound, LogOut, MapPin, Moon, Navigation, ScanLine, Sun, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSession, useUserRoles } from "@/lib/auth";
import { useAdminTable, useProfile } from "@/lib/data";

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
  const { data: employees = [] } = useAdminTable("employees", "*", "created_at");
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

  useEffect(() => { if (profile) setProfileForm({ full_name: profile.full_name ?? "", phone: profile.phone ?? "" }); }, [profile]);
  useEffect(() => { if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => setMap({ lat: p.coords.latitude, lng: p.coords.longitude }), () => undefined, { enableHighAccuracy: true, timeout: 8000 }); }, []);

  const employee = useMemo(() => (employees as any[]).find(e => e.email && user?.email && String(e.email).toLowerCase() === String(user.email).toLowerCase()) ?? null, [employees, user?.email]);
  const mine = roles.includes("employee") ? (tasks as any[]).filter(t => t.employee_id === user?.id) : [];
  const active = mine.filter(t => ["pending", "accepted", "in_progress"].includes(t.status));
  const completed = mine.filter(t => t.status === "completed");

  const toggleTheme = () => { const next = !document.documentElement.classList.contains("dark"); document.documentElement.classList.toggle("dark", next); localStorage.setItem("tapwash-theme", next ? "dark" : "light"); setDark(next); };
  const setStatus = async (id: string, status: string) => { setLoading(id); const { error } = await (supabase as any).from("employee_tasks").update({ status, ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}) }).eq("id", id).eq("employee_id", user?.id); setLoading(null); if (error) toast.error(error.message); else { toast.success(pick("Order updated", "تم تحديث الأوردر")); refetch(); } };
  const saveProfile = async () => { if (!user) return; const { error } = await supabase.from("profiles").update({ full_name: profileForm.full_name, phone: profileForm.phone, language: lang }).eq("id", user.id); if (error) return toast.error(error.message); toast.success(pick("Profile updated", "تم تحديث البروفايل")); setProfileOpen(false); refetchProfile(); };
  const uploadAvatar = async (file?: File) => {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return toast.error(pick("Please choose an image", "اختر صورة فقط"));
    if (file.size > 10 * 1024 * 1024) return toast.error(pick("Maximum image size is 10 MB", "أقصى حجم للصورة 10 ميجابايت"));
    setAvatarBusy(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `avatars/${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("tapwash-media").upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) { setAvatarBusy(false); return toast.error(uploadError.message); }
    const { data } = supabase.storage.from("tapwash-media").getPublicUrl(path);
    const { error } = await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
    setAvatarBusy(false);
    if (error) return toast.error(error.message);
    toast.success(pick("Profile photo updated", "تم تحديث صورة البروفايل"));
    refetchProfile();
  };
  const changePassword = async () => { if (password.length < 6) return; const { error } = await supabase.auth.updateUser({ password }); if (error) return toast.error(error.message); toast.success(pick("Password changed", "تم تغيير كلمة المرور")); setPassword(""); setPasswordOpen(false); };
  const logout = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };
  const openLocation = (t: any) => { const u = t.location_url || (t.latitude != null && t.longitude != null ? `https://www.google.com/maps/search/?api=1&query=${t.latitude},${t.longitude}` : t.location_text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.location_text)}` : null); if (u) window.open(u, "_blank", "noopener,noreferrer"); };
  const scanNfc = async () => { if (!window.NDEFReader) return toast.error(pick("Web NFC is not supported here. Use Chrome on Android with NFC enabled.", "المتصفح لا يدعم NFC. استخدم Chrome على Android مع تشغيل NFC.")); try { setScanning(true); const reader = new window.NDEFReader(); await reader.scan(); toast.info(pick("Bring the customer NFC card close to the phone.", "قرّب كارت العميل من الموبايل.")); reader.onreadingerror = () => { setScanning(false); toast.error(pick("Could not read the NFC card.", "تعذر قراءة كارت العميل.")); }; reader.onreading = (event: any) => { let raw = ""; for (const record of event.message.records) { try { raw += new TextDecoder(record.encoding || "utf-8").decode(record.data); } catch {} } let data: any; try { data = JSON.parse(raw); } catch { data = { card_serial: raw }; } setCard(data); setScanning(false); toast.success(pick("Customer card scanned", "تمت قراءة كارت العميل")); }; } catch (e) { setScanning(false); toast.error(e instanceof Error ? e.message : pick("NFC scan failed", "فشل مسح NFC")); } };

  const renderOrder = (t: any) => <article key={t.id} className="panel p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{t.title || pick("Order", "أوردر")}</h3><Badge>{t.status}</Badge><Badge variant="outline">#{t.serial_number || String(t.id).slice(0, 8).toUpperCase()}</Badge></div><p className="text-sm text-muted-foreground">{t.wash_type || "—"}</p></div>{t.scheduled_at && <span className="flex items-center gap-1 text-sm text-muted-foreground"><Clock3 className="size-4" />{fmtDate(t.scheduled_at)}</span>}</div><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">{pick("Customer", "العميل")}</p><p className="font-bold">{t.customer_name || "—"}</p><p>{t.customer_phone || "—"}</p><p className="text-sm">{t.customer_email || "—"}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">{pick("Subscription / offer", "الاشتراك / العرض")}</p><p className="font-bold">{t.package_name || t.offer_name || "—"}</p><p>{t.remaining_washes != null ? `${t.remaining_washes} ${pick("remaining", "متبقي")}` : "—"}</p></div><div className="rounded-xl border p-4 md:col-span-2"><p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-4" />{t.location_text || t.location_url || "—"}</p>{(t.location_url || t.location_text || t.latitude != null) && <Button className="mt-2" size="sm" variant="outline" onClick={() => openLocation(t)}><Navigation className="me-1 size-4" />{pick("Open location", "فتح الموقع")}</Button>}</div></div>{t.notes && <p className="mt-3 rounded-xl bg-muted p-4 text-sm">{t.notes}</p>}<div className="mt-4 flex flex-wrap gap-2">{t.status === "pending" && <Button disabled={loading === t.id} onClick={() => setStatus(t.id, "accepted")}>{pick("Accept order", "استلام الأوردر")}</Button>}{t.status === "accepted" && <Button disabled={loading === t.id} onClick={() => setStatus(t.id, "in_progress")}>{pick("Start", "بدء التنفيذ")}</Button>}{t.status === "in_progress" && <Button disabled={loading === t.id} onClick={() => setStatus(t.id, "completed")}><CheckCircle2 className="me-1 size-4" />{pick("Complete order", "إنهاء الأوردر")}</Button>}</div></article>;

  return <div className="min-h-screen bg-background text-foreground"><header className="sticky top-0 z-20 border-b border-border/70 bg-background/75 backdrop-blur-2xl"><div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6"><div className="glass-soft flex size-10 items-center justify-center rounded-xl border border-white/40 shadow-sm">T</div><div><p className="font-bold">TapWash</p><p className="text-xs text-muted-foreground">{pick("Employee dashboard", "لوحة الموظف")}</p></div><div className="ms-auto flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>{lang === "ar" ? "English" : "العربية"}</Button><Button variant="outline" size="sm" onClick={() => map ? window.open(`https://www.google.com/maps/search/?api=1&query=${map.lat},${map.lng}`, "_blank") : toast.info(pick("Location unavailable", "الموقع غير متاح"))}><MapPin className="me-1 size-4" />{pick("My location", "موقعي")}</Button><Button variant="ghost" size="icon" onClick={toggleTheme}>{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}</Button><Button variant="outline" size="sm" onClick={logout}><LogOut className="me-1 size-4" />{pick("Logout", "خروج")}</Button></div></div></header>
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <section className="panel mb-6 p-5"><div className="flex flex-wrap items-center gap-4"><div className="relative"><label className="group block cursor-pointer"><input type="file" accept="image/*" className="sr-only" disabled={avatarBusy} onChange={e => void uploadAvatar(e.target.files?.[0])} />{profile?.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name || "Employee"} className="size-20 rounded-2xl border border-white/40 object-cover shadow-md" /> : <div className="glass-soft flex size-20 items-center justify-center rounded-2xl border border-white/40 text-2xl font-bold shadow-md">{(profile?.full_name || user?.email || "E").slice(0, 1).toUpperCase()}</div>}<span className="absolute -bottom-2 -end-2 flex size-9 items-center justify-center rounded-full border border-white/60 bg-background/75 shadow-md backdrop-blur-xl"><Camera className="size-4" /></span></label></div><div><p className="text-xs uppercase tracking-widest text-muted-foreground">{pick("Employee account", "حساب الموظف")}</p><h1 className="text-2xl font-bold">{profile?.full_name || user?.email}</h1><Badge variant="secondary">{pick("Employee", "موظف")}</Badge></div><div className="ms-auto grid min-w-[280px] gap-2 sm:grid-cols-3"><div className="rounded-xl border bg-background/35 p-3 backdrop-blur-xl"><p className="text-xs text-muted-foreground">{pick("Employee ID", "رقم ID الموظف")}</p><p className="font-bold">{employee?.employee_code || "—"}</p></div><div className="rounded-xl border bg-background/35 p-3 backdrop-blur-xl"><p className="text-xs text-muted-foreground">{pick("Card number", "رقم البطاقة")}</p><p className="font-bold">{employee?.card_number || "—"}</p></div><div className="rounded-xl border bg-background/35 p-3 backdrop-blur-xl"><p className="text-xs text-muted-foreground">{pick("Job title", "المسمى الوظيفي")}</p><p className="font-bold">{employee?.job_title || pick("Employee", "موظف")}</p></div></div><div className="flex flex-wrap gap-2"><Dialog open={profileOpen} onOpenChange={setProfileOpen}><DialogTrigger asChild><Button variant="outline"><UserCog className="me-1 size-4" />{pick("Profile", "البروفايل")}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{pick("Edit profile", "تعديل البروفايل")}</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>{pick("Full name", "الاسم")}</Label><Input value={profileForm.full_name} onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })} /></div><div><Label>{pick("Phone", "الهاتف")}</Label><Input value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} /></div><div><Label>{pick("Profile photo", "صورة البروفايل")}</Label><Input type="file" accept="image/*" disabled={avatarBusy} onChange={e => void uploadAvatar(e.target.files?.[0])} /></div></div><DialogFooter><Button onClick={saveProfile}>{pick("Save", "حفظ")}</Button></DialogFooter></DialogContent></Dialog><Dialog open={passwordOpen} onOpenChange={setPasswordOpen}><DialogTrigger asChild><Button variant="outline"><KeyRound className="me-1 size-4" />{pick("Password", "كلمة المرور")}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{pick("Change password", "تغيير كلمة المرور")}</DialogTitle></DialogHeader><Input type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} /><DialogFooter><Button onClick={changePassword} disabled={password.length < 6}>{pick("Save", "حفظ")}</Button></DialogFooter></DialogContent></Dialog></div></div></section>
      <section className="panel mb-6 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-bold"><ScanLine className="size-5 text-primary" />{pick("Scan customer NFC card", "مسح كارت العميل NFC")}</h2><p className="text-sm text-muted-foreground">{pick("Read the customer data stored on the card.", "اقرأ بيانات العميل المخزنة على الكارت.")}</p></div><Button size="lg" onClick={scanNfc} disabled={scanning}>{scanning ? pick("Bring card closer...", "قرّب الكارت...") : pick("Scan NFC", "مسح NFC")}</Button></div>{card && <div className="mt-5 grid gap-3 rounded-2xl border p-5 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-muted-foreground">{pick("Customer", "العميل")}</p><b>{card.name || card.full_name || "—"}</b></div><div><p className="text-xs text-muted-foreground">{pick("Phone", "الهاتف")}</p><b>{card.phone || "—"}</b></div><div><p className="text-xs text-muted-foreground">{pick("Package", "الباقة")}</p><b>{card.package || card.package_name || "—"}</b></div><div><p className="text-xs text-muted-foreground">{pick("Remaining washes", "الغسلات المتبقية")}</p><b className="text-2xl text-primary">{card.remaining_washes ?? card.remaining ?? "—"}</b></div></div>}</section>
      <section className="panel p-5"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-bold"><UserCog className="size-5 text-primary" />{pick("My orders", "أوردراتي")}</h2><p className="text-sm text-muted-foreground">{pick("Current orders and completed orders are kept separately.", "الأوردرات الحالية والمنتهية منفصلة ويتم الاحتفاظ بالسجل السابق.")}</p></div><div className="flex gap-2"><Button variant={ordersView === "current" ? "default" : "outline"} onClick={() => setOrdersView("current")}>{pick("Current", "الأوردرات الحالية")} <Badge variant={ordersView === "current" ? "secondary" : "outline"} className="ms-1">{active.length}</Badge></Button><Button variant={ordersView === "previous" ? "default" : "outline"} onClick={() => setOrdersView("previous")}>{pick("Previous", "الأوردرات السابقة")} <Badge variant={ordersView === "previous" ? "secondary" : "outline"} className="ms-1">{completed.length}</Badge></Button></div></div><div className="space-y-4">{(ordersView === "current" ? active : completed).length ? (ordersView === "current" ? active : completed).map(renderOrder) : <p className="py-8 text-center text-sm text-muted-foreground">{pick("No orders", "لا توجد أوردرات")}</p>}</div></section>
    </main></div>;
}
