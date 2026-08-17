import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, ExternalLink, KeyRound, LogOut, MapPin, Navigation, UserCog, Sun, Moon } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/employee-tasks")({ component: EmployeeTasks });

function EmployeeTasks() {
  const { pick, fmtDate } = useI18n();
  const { user } = useSession();
  const { data: roles = [] } = useUserRoles(user?.id);
  const { data: profile, refetch: refetchProfile } = useProfile(user?.id);
  const { data: tasks = [], refetch } = useAdminTable("employee_tasks", "*", "created_at");
  const [loading, setLoading] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "", avatar_url: "" });
  const [password, setPassword] = useState("");
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [mapPosition, setMapPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (profile) setProfileForm({ full_name: profile.full_name ?? "", phone: profile.phone ?? "", avatar_url: profile.avatar_url ?? "" });
  }, [profile]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setMapPosition({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const mine = roles.includes("employee") ? tasks.filter((task: any) => task.employee_id === user?.id) : [];
  const active = mine.filter((task: any) => ["pending", "accepted", "in_progress"].includes(task.status));
  const completed = mine.filter((task: any) => task.status === "completed");
  const totalCollected = completed.reduce((sum: number, task: any) => sum + Number(task.collection_amount ?? 0), 0);
  const latestTask = mine[0];

  const toggleDark = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("tapwash-theme", next ? "dark" : "light");
    setDark(next);
  };

  const setStatus = async (id: string, status: string) => {
    setLoading(id);
    const update = status === "completed" ? { status, completed_at: new Date().toISOString() } : { status };
    const { error } = await (supabase as any).from("employee_tasks").update(update).eq("id", id).eq("employee_id", user?.id);
    setLoading(null);
    if (error) toast.error(error.message); else refetch();
  };

  const openLocation = (task: any) => {
    const url = task.location_url || (task.latitude != null && task.longitude != null ? `https://www.google.com/maps/search/?api=1&query=${task.latitude},${task.longitude}` : task.location_text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.location_text)}` : null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update(profileForm).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success(pick("Profile updated", "تم تحديث البروفايل"));
    setProfileOpen(false);
    refetchProfile();
  };

  const changePassword = async () => {
    if (password.length < 6) return;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return toast.error(error.message);
    toast.success(pick("Password changed", "تم تغيير كلمة المرور"));
    setPassword("");
    setPasswordOpen(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="surface-blue flex size-10 shrink-0 items-center justify-center rounded-xl font-black">T</div>
          <div className="min-w-0"><p className="truncate font-bold">TapWash</p><p className="text-xs text-muted-foreground">{pick("Employee dashboard", "لوحة الموظف")}</p></div>
          <div className="ms-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { if (mapPosition) window.open(`https://www.google.com/maps/search/?api=1&query=${mapPosition.lat},${mapPosition.lng}`, "_blank", "noopener,noreferrer"); else toast.info(pick("Location is not available yet", "الموقع غير متاح حتى الآن")); }}><MapPin className="me-1 size-4" />{pick("My location", "موقعي")}</Button>
            <Button variant="ghost" size="icon" onClick={toggleDark} aria-label={pick("Toggle dark mode", "تبديل الوضع الداكن")}>{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}</Button>
            <Button variant="outline" size="sm" onClick={logout}><LogOut className="me-1 size-4" />{pick("Logout", "خروج")}</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="panel p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="surface-blue flex size-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold">{(profile?.full_name || user?.email || "E").slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0"><p className="text-xs uppercase tracking-widest text-muted-foreground">{pick("Employee account", "حساب الموظف")}</p><h1 className="truncate text-2xl font-bold">{profile?.full_name || user?.email}</h1><div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><Badge variant="secondary">{pick("Employee", "موظف")}</Badge><span>{profile?.phone || user?.email}</span></div></div>
              <div className="ms-auto flex flex-wrap gap-2">
                <Dialog open={profileOpen} onOpenChange={setProfileOpen}><DialogTrigger asChild><Button variant="outline"><UserCog className="me-1.5 size-4" />{pick("Profile", "البروفايل")}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{pick("Edit profile", "تعديل البروفايل")}</DialogTitle></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>{pick("Full name", "الاسم الكامل")}</Label><Input value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} /></div><div className="space-y-2"><Label>{pick("Phone", "الهاتف")}</Label><Input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} /></div><div className="space-y-2"><Label>{pick("Avatar URL", "رابط الصورة")}</Label><Input value={profileForm.avatar_url} onChange={(e) => setProfileForm({ ...profileForm, avatar_url: e.target.value })} /></div></div><DialogFooter><Button onClick={saveProfile}>{pick("Save", "حفظ")}</Button></DialogFooter></DialogContent></Dialog>
                <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}><DialogTrigger asChild><Button variant="outline"><KeyRound className="me-1.5 size-4" />{pick("Password", "كلمة المرور")}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{pick("Change password", "تغيير كلمة المرور")}</DialogTitle></DialogHeader><div className="space-y-2"><Label>{pick("New password", "كلمة المرور الجديدة")}</Label><Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div><DialogFooter><Button onClick={changePassword} disabled={password.length < 6}>{pick("Save", "حفظ")}</Button></DialogFooter></DialogContent></Dialog>
              </div>
            </div>
          </div>
          <div className="panel overflow-hidden p-0"><div className="flex items-center justify-between border-b p-4"><div><p className="font-bold">{pick("My location", "موقعي")}</p><p className="text-xs text-muted-foreground">{pick("Your current location", "موقعك الحالي")}</p></div><MapPin className="size-5 text-primary" /></div>{mapPosition ? <iframe title="Employee location" className="h-48 w-full border-0" loading="lazy" src={`https://www.google.com/maps?q=${mapPosition.lat},${mapPosition.lng}&z=15&output=embed`} /> : <div className="flex h-48 items-center justify-center p-5 text-center text-sm text-muted-foreground">{pick("Allow location access to show your position on the map.", "اسمح بتحديد الموقع لعرض موقعك على الخريطة.")}</div>}</div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3"><div className="panel p-5"><p className="text-sm text-muted-foreground">{pick("Current orders", "الأوردرات الحالية")}</p><p className="mt-1 text-3xl font-bold">{active.length}</p></div><div className="panel p-5"><p className="text-sm text-muted-foreground">{pick("Previous orders", "الأوردرات السابقة")}</p><p className="mt-1 text-3xl font-bold">{completed.length}</p></div><div className="panel p-5"><p className="text-sm text-muted-foreground">{pick("Total collected", "إجمالي التحصيل")}</p><p className="mt-1 text-3xl font-bold">{totalCollected.toFixed(2)} <span className="text-sm">EGP</span></p></div></div>

        {latestTask && <div className="panel mb-6 p-4 text-sm"><span className="font-semibold">{pick("Last added update", "آخر تعديل تمت إضافته")}: </span>{fmtDate(latestTask.created_at)}</div>}

        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">{pick("My orders", "أوردراتي")}</h2><p className="text-sm text-muted-foreground">{pick("Only orders assigned to you.", "فقط الأوردرات المكلف بها.")}</p></div><Badge variant="secondary">{active.length} {pick("active", "نشط")}</Badge></div>

        <div className="space-y-4">
          {mine.map((task: any) => (
            <article key={task.id} className="panel p-5">
              <div className="flex flex-wrap justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">{task.title}</h3><Badge>{task.status}</Badge><Badge variant="outline">#{task.serial_number || task.id.slice(0, 8).toUpperCase()}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{task.wash_type}</p></div>{task.scheduled_at && <div className="flex items-center gap-1 text-sm text-muted-foreground"><Clock3 className="size-4" />{fmtDate(task.scheduled_at)}</div>}</div>
              <div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-xl border p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">{pick("Customer", "العميل")}</p><p className="mt-1 font-bold">{task.customer_name || "—"}</p><p className="text-sm">{task.customer_phone || "—"}</p><p className="text-sm">{task.customer_email || "—"}</p></div><div className="rounded-xl border p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">{pick("Subscription / offer", "الاشتراك / العرض")}</p><p className="mt-1 font-bold">{task.package_name || task.offer_name || pick("No package or offer", "لا توجد باقة أو عرض")}</p><p className="text-sm">{task.remaining_washes != null ? `${task.remaining_washes} ${pick("orders/washes remaining", "أوردر/غسلة متبقية")}` : "—"}</p></div><div className="rounded-xl border p-4 md:col-span-2"><p className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground"><MapPin className="size-4" />{pick("Customer location", "موقع العميل")}</p><p className="mt-1 break-all font-semibold">{task.location_text || task.location_url || "—"}</p><div className="mt-3 flex flex-wrap gap-2">{(task.location_url || task.latitude != null || task.longitude != null || task.location_text) && <Button size="sm" variant="outline" onClick={() => openLocation(task)}><Navigation className="me-1 size-4" />{pick("Open location", "فتح الموقع")}</Button>}{task.location_url && <Button size="sm" variant="outline" asChild><a href={task.location_url} target="_blank" rel="noreferrer"><ExternalLink className="me-1 size-4" />{pick("Shared link", "لينك الموقع")}</a></Button>}</div></div></div>
              {task.notes && <div className="mt-4 rounded-xl bg-muted p-4 text-sm">{task.notes}</div>}
              {task.status === "completed" && <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">{pick("Collection amount", "مبلغ التحصيل")}</p><p className="mt-1 text-xl font-bold">{Number(task.collection_amount ?? 0).toFixed(2)} EGP</p></div>}
              <div className="mt-5 flex flex-wrap gap-2">{task.status === "pending" && <Button disabled={loading === task.id} onClick={() => setStatus(task.id, "accepted")}>{pick("Accept order", "استلام الأوردر")}</Button>}{task.status === "accepted" && <Button disabled={loading === task.id} onClick={() => setStatus(task.id, "in_progress")}>{pick("Start", "بدء التنفيذ")}</Button>}{task.status === "in_progress" && <Button disabled={loading === task.id} onClick={() => setStatus(task.id, "completed")}><CheckCircle2 className="me-1 size-4" />{pick("Complete", "تم التنفيذ")}</Button>}</div>
            </article>
          ))}
          {mine.length === 0 && <div className="panel p-10 text-center text-muted-foreground">{pick("No orders assigned yet.", "لا توجد أوردرات مكلف بها حتى الآن.")}</div>}
        </div>
      </main>
    </div>
  );
}
