import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, CreditCard, Droplets, KeyRound, MessageCircle, Phone, RefreshCw, ShieldCheck, UserCog, Tag } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AppTopbar, StatCard } from "@/components/app/Shell";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSession, useUserRoles } from "@/lib/auth";
import { useMyCards, useMyNotifications, useMySubscription, useMyWashes, useOffers, usePackages, useProfile, useSettings } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: CustomerDashboard });

function CustomerDashboard() {
  const { t, pick, fmtDate, lang, setLang } = useI18n();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile(user?.id);
  const { data: sub } = useMySubscription(user?.id);
  const { data: washes } = useMyWashes(user?.id);
  const { data: cards } = useMyCards(user?.id);
  const { data: notifications } = useMyNotifications(user?.id);
  const { data: roles } = useUserRoles(user?.id);
  const { data: packages } = usePackages();
  const { data: offers } = useOffers();
  const { data: settings } = useSettings();
  const [profileOpen, setProfileOpen] = useState(false);
  const [passOpen, setPassOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", avatar_url: "" });
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name ?? "", phone: profile.phone ?? "", avatar_url: profile.avatar_url ?? "" });
  }, [profile]);
  useEffect(() => {
    if (profile?.language && (profile.language === "ar" || profile.language === "en") && profile.language !== lang) setLang(profile.language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.language]);

  const total = sub?.total_washes ?? 0;
  const used = sub?.used_washes ?? 0;
  const remaining = Math.max(total - used, 0);
  const lastWash = washes?.[0]?.washed_at ?? null;
  const wa = (settings?.whatsapp ?? "").replace(/[^\d]/g, "");
  const isAdmin = (roles ?? []).includes("admin");
  const isEmployee = !isAdmin && (roles ?? []).includes("employee");
  const activePackages = (packages ?? []).filter((p) => p.status === "active");
  const activeOffers = (offers ?? []).filter((o) => o.status === "active");

  const saveProfile = async () => {
    const { error } = await supabase.from("profiles").update({ ...form, language: lang }).eq("id", user!.id);
    if (error) return void toast.error(error.message);
    toast.success(t("saved")); setProfileOpen(false); queryClient.invalidateQueries({ queryKey: ["profile", user!.id] });
  };
  const changePassword = async () => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return void toast.error(error.message);
    toast.success(t("password_changed")); setPassword(""); setPassOpen(false);
  };
  const renew = () => {
    const text = pick(`Hello TapWash, I would like to renew my subscription. Name: ${profile?.full_name ?? ""}`, `مرحباً تاب واش، أرغب في تجديد اشتراكي. الاسم: ${profile?.full_name ?? ""}`);
    if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, "_blank");
    toast.success(t("renew_requested"));
  };
  const statusLabel = (s?: string | null) => s === "active" ? t("active") : s === "expired" ? t("expired") : s === "cancelled" ? t("cancelled") : s === "pending" ? t("pending") : t("none");

  return (
    <div className="customer-dashboard min-h-screen bg-background">
      <AppTopbar title={t("my_membership")} extra={isAdmin ? <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex"><Link to="/admin"><ShieldCheck className="me-1.5 size-4" />{t("nav_admin")}</Link></Button> : null} />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="panel animate-fade-up flex flex-wrap items-center gap-5 p-6">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name || "avatar"} className="size-16 rounded-2xl object-cover" /> : <div className="surface-blue flex size-16 items-center justify-center rounded-2xl font-display text-xl font-bold shadow-luxe">{(profile?.full_name || user?.email || "T").slice(0, 1).toUpperCase()}</div>}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("welcome_back")}</p>
            <h2 className="truncate text-2xl font-bold">{profile?.full_name || user?.email}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={profile?.status === "active" ? "default" : "destructive"}>{profile?.status === "active" ? t("active") : t("suspended")}</Badge>
              {isEmployee && <Badge variant="secondary">موظف</Badge>}
              {isAdmin && <Badge variant="secondary">مدير</Badge>}
              {profile?.phone && <span>{profile.phone}</span>}
            </div>
          </div>
          <div className="ms-auto flex flex-wrap gap-2">
            <Dialog open={profileOpen} onOpenChange={setProfileOpen}><DialogTrigger asChild><Button variant="outline"><UserCog className="me-1.5 size-4" />{t("edit_profile")}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{t("edit_profile")}</DialogTitle></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>{t("full_name")}</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div><div className="space-y-2"><Label>{t("phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div><div className="space-y-2"><Label>{t("avatar_url")}</Label><Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} /></div></div><DialogFooter><Button onClick={saveProfile}>{t("save")}</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={passOpen} onOpenChange={setPassOpen}><DialogTrigger asChild><Button variant="outline"><KeyRound className="me-1.5 size-4" />{t("change_password")}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{t("change_password")}</DialogTitle></DialogHeader><div className="space-y-2"><Label>{t("new_password")}</Label><Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div><DialogFooter><Button onClick={changePassword} disabled={password.length < 6}>{t("save")}</Button></DialogFooter></DialogContent></Dialog>
          </div>
        </div>

        {sub ? <><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCard tone="ink" label={t("package")} value={sub.packages ? pick(sub.packages.title_en, sub.packages.title_ar) : t("none")} hint={`${total} ${pick("washes", "غسلة")}`} /><StatCard tone="primary" label={t("remaining_washes")} value={remaining} hint={`${used} ${pick("used", "مستخدمة")}`} /><StatCard label={t("subscription_status")} value={statusLabel(sub.status)} /><StatCard label={t("last_wash")} value={fmtDate(lastWash)} /></div><div className="panel mt-6 p-6"><div className="flex items-center justify-between text-sm"><span className="font-semibold">{t("used_washes")}</span><span className="text-muted-foreground">{used} / {total}</span></div><Progress value={total ? (used / total) * 100 : 0} className="mt-3" /><div className="mt-6 grid gap-4 sm:grid-cols-2"><div><p className="text-xs uppercase tracking-widest text-muted-foreground">{t("start_date")}</p><p className="mt-1 font-semibold">{fmtDate(sub.start_date)}</p></div><div><p className="text-xs uppercase tracking-widest text-muted-foreground">{t("end_date")}</p><p className="mt-1 font-semibold">{fmtDate(sub.end_date)}</p></div></div></div></> : <div className="panel mt-6 p-8 text-center"><h3 className="text-xl font-bold">{t("no_subscription")}</h3><p className="mt-2 text-sm text-muted-foreground">{t("no_subscription_d")}</p><Button asChild className="mt-5"><Link to="/packages">{t("hero_cta")}</Link></Button></div>}

        <section className="mt-8"><div className="mb-4 flex items-center justify-between"><div><h3 className="flex items-center gap-2 text-xl font-bold"><CreditCard className="size-5 text-primary" /> الباقات المتاحة</h3><p className="mt-1 text-sm text-muted-foreground">اختر الباقة المناسبة لسيارتك</p></div><Button asChild variant="outline" size="sm"><Link to="/packages">كل الباقات</Link></Button></div>{activePackages.length === 0 ? <div className="panel p-6 text-sm text-muted-foreground">لا توجد باقات نشطة حاليًا.</div> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{activePackages.map((p) => <div key={p.id} className="panel p-5"><h4 className="text-lg font-bold">{pick(p.title_en, p.title_ar)}</h4><p className="mt-2 text-sm text-muted-foreground">{pick(p.description_en, p.description_ar)}</p><div className="mt-4 flex items-end justify-between"><span className="text-2xl font-bold">{Number(p.price).toLocaleString("ar-EG")} جنيه</span><span className="text-sm text-muted-foreground">{p.washes_count} غسلة</span></div><Button asChild className="mt-4 w-full"><Link to="/packages">عرض التفاصيل</Link></Button></div>)}</div>}</section>

        <section className="mt-8"><div className="mb-4 flex items-center justify-between"><div><h3 className="flex items-center gap-2 text-xl font-bold"><Tag className="size-5 text-primary" /> العروض الحالية</h3><p className="mt-1 text-sm text-muted-foreground">أحدث عروض TapWash</p></div><Button asChild variant="outline" size="sm"><Link to="/offers">كل العروض</Link></Button></div>{activeOffers.length === 0 ? <div className="panel p-6 text-sm text-muted-foreground">لا توجد عروض نشطة حاليًا.</div> : <div className="grid gap-4 md:grid-cols-2">{activeOffers.slice(0, 4).map((o) => <div key={o.id} className="panel p-5"><h4 className="text-lg font-bold">{pick(o.title_en, o.title_ar)}</h4><p className="mt-2 text-sm text-muted-foreground">{pick(o.description_en, o.description_ar)}</p><div className="mt-4 flex items-center gap-3"><span className="text-xl font-bold">{Number(o.price).toLocaleString("ar-EG")} جنيه</span>{o.old_price != null && Number(o.old_price) > Number(o.price) && <span className="text-sm text-muted-foreground line-through">{Number(o.old_price).toLocaleString("ar-EG")} جنيه</span>}</div></div>)}</div>}</section>

        <div className="mt-6 grid gap-3 sm:grid-cols-3"><Button size="lg" onClick={renew}><RefreshCw className="me-1.5 size-4" />{t("renew")}</Button><Button size="lg" variant="outline" asChild disabled={!wa}><a href={wa ? `https://wa.me/${wa}` : "#"} target="_blank" rel="noreferrer"><MessageCircle className="me-1.5 size-4" />{t("whatsapp")}</a></Button><Button size="lg" variant="outline" asChild><a href={`tel:${settings?.phone ?? ""}`}><Phone className="me-1.5 size-4" />{t("call")}</a></Button></div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2"><section className="panel p-6"><h3 className="flex items-center gap-2 text-lg font-bold"><CreditCard className="size-4 text-primary" /> {t("my_cards")}</h3><div className="mt-4 space-y-3">{(cards ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}{(cards ?? []).map((c) => <div key={c.id} className="flex items-center justify-between rounded-xl border border-border p-4"><div><p className="font-semibold">{c.card_type === "card" ? t("card") : c.card_type === "sticker" ? t("sticker") : t("keychain")}</p><p className="text-xs text-muted-foreground">{c.serial_number}</p></div><Badge variant="secondary">{fmtDate(c.activation_date)}</Badge></div>)}</div></section><section className="panel p-6"><h3 className="flex items-center gap-2 text-lg font-bold"><Droplets className="size-4 text-primary" /> {t("wash_history")}</h3><div className="mt-4 space-y-3">{(washes ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}{(washes ?? []).map((w) => <div key={w.id} className="flex items-center justify-between rounded-xl border border-border p-4 text-sm"><span className="font-medium">{fmtDate(w.washed_at)}</span><span className="text-muted-foreground">{w.branch ?? "—"}</span></div>)}</div></section></div>

        <section className="panel mt-6 p-6"><h3 className="flex items-center gap-2 text-lg font-bold"><Bell className="size-4 text-primary" /> {t("notifications")}</h3><div className="mt-4 space-y-3">{(notifications ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}{(notifications ?? []).map((n) => <div key={n.id} className="rounded-xl border border-border p-4"><p className="font-semibold">{n.title}</p><p className="mt-1 text-sm text-muted-foreground">{n.message}</p><p className="mt-2 text-xs text-muted-foreground">{fmtDate(n.created_at)}</p></div>)}</div></section>
      </div>
    </div>
  );
}
