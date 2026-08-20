import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  CarFront,
  CreditCard,
  Droplets,
  KeyRound,
  MessageCircle,
  Nfc,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  UserCog,
  Waves,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppTopbar } from "@/components/app/Shell";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useIsAdmin, useSession } from "@/lib/auth";
import {
  useMyCards,
  useMyNotifications,
  useMySubscription,
  useMyWashes,
  useProfile,
  useSettings,
} from "@/lib/data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: CustomerDashboard,
});

type Booking = {
  scheduled_at?: string | null;
  status?: string | null;
} | null;

function GlassCard({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border border-white/80 bg-white/40 shadow-[0_18px_55px_rgba(23,168,194,0.13)] backdrop-blur-2xl ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/80 via-white/30 to-cyan-100/25" />
      <div className="pointer-events-none absolute -right-16 -top-20 size-44 rounded-full bg-cyan-200/25 blur-3xl" />
      <div className="relative">{children}</div>
    </div>
  );
}

function CustomerDashboard() {
  const { t, pick, fmtDate, lang, setLang } = useI18n();
  const { user } = useSession();
  const queryClient = useQueryClient();

  const { data: profile } = useProfile(user?.id);
  const { data: sub } = useMySubscription(user?.id);
  const { data: washes } = useMyWashes(user?.id);
  const { data: cards } = useMyCards(user?.id);
  const { data: notifications } = useMyNotifications(user?.id);
  const { data: roles } = useIsAdmin(user?.id);
  const { data: settings } = useSettings();

  const [profileOpen, setProfileOpen] = useState(false);
  const [passOpen, setPassOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", avatar_url: "" });
  const [password, setPassword] = useState("");
  const [booking, setBooking] = useState<Booking>(null);

  useEffect(() => {
    if (profile)
      setForm({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        avatar_url: profile.avatar_url ?? "",
      });
  }, [profile]);

  useEffect(() => {
    if (profile?.language && (profile.language === "ar" || profile.language === "en")) {
      if (profile.language !== lang) setLang(profile.language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.language]);

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;

    const loadBooking = async () => {
      const { data } = await (supabase as any)
        .from("booking_requests")
        .select("scheduled_at,status")
        .eq("customer_id", user.id)
        .not("status", "in", "(completed,closed,rejected)")
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (mounted) setBooking(data ?? null);
    };

    void loadBooking();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const total = sub?.total_washes ?? 0;
  const used = sub?.used_washes ?? 0;
  const remaining = Math.max(total - used, 0);
  const progress = total ? Math.min((remaining / total) * 100, 100) : 0;
  const lastWash = washes?.[0] ?? null;
  const card = cards?.[0] as any;
  const wa = (settings?.whatsapp ?? "").replace(/[^\d]/g, "");
  const isAdmin = (roles ?? []).includes("admin");
  const points = Number((profile as any)?.reward_points ?? (profile as any)?.points ?? 0);
  const greeting = profile?.full_name ? profile.full_name.split(" ")[0] : pick("there", "بك");
  const packageName = sub?.packages
    ? pick(sub.packages.title_en, sub.packages.title_ar)
    : pick("No active package", "لا توجد باقة مفعلة");

  const bookingDate = useMemo(
    () =>
      booking?.scheduled_at
        ? fmtDate(booking.scheduled_at)
        : pick("No upcoming booking", "لا يوجد حجز قادم"),
    [booking?.scheduled_at, fmtDate, pick],
  );

  const saveProfile = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({ ...form, language: lang })
      .eq("id", user!.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("saved"));
    setProfileOpen(false);
    queryClient.invalidateQueries({ queryKey: ["profile", user!.id] });
  };

  const changePassword = async () => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("password_changed"));
    setPassword("");
    setPassOpen(false);
  };

  const renew = () => {
    const text = pick(
      `Hello TapWash, I would like to renew my subscription. Name: ${profile?.full_name ?? ""}`,
      `مرحباً تاب واش، أرغب في تجديد اشتراكي. الاسم: ${profile?.full_name ?? ""}`,
    );
    if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, "_blank");
    toast.success(t("renew_requested"));
  };

  const statusLabel = (s?: string | null) =>
    s === "active"
      ? t("active")
      : s === "expired"
        ? t("expired")
        : s === "cancelled"
          ? t("cancelled")
          : s === "pending"
            ? t("pending")
            : t("none");

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#eafaff] text-[#125667]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_5%,rgba(255,255,255,.98),transparent_30%),radial-gradient(circle_at_95%_22%,rgba(55,211,237,.20),transparent_30%),linear-gradient(145deg,#f9feff_0%,#e7faff_48%,#f5fdff_100%)]" />
      <div className="pointer-events-none fixed -right-24 top-24 -z-10 size-80 rounded-full bg-cyan-300/15 blur-3xl" />
      <div className="pointer-events-none fixed -left-28 bottom-16 -z-10 size-80 rounded-full bg-white/80 blur-3xl" />

      <AppTopbar
        title={t("my_membership")}
        extra={
          isAdmin ? (
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex bg-white/50 backdrop-blur-xl">
              <Link to="/admin">
                <ShieldCheck className="me-1.5 size-4" />
                {t("nav_admin")}
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6">
        {/* Welcome header */}
        <header className="mb-6 flex items-center justify-between gap-4 px-1">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6e919a]">
              {pick("Welcome back", "أهلاً بك من جديد")}
            </p>
            <h1 className="mt-1 truncate text-3xl font-black tracking-tight text-[#075f73] sm:text-4xl">
              {pick(`Good morning, ${greeting}!`, `صباح الخير، ${greeting}!`)}
            </h1>
            <p className="mt-1 text-sm text-[#78949c]">
              {pick("Your TapWash membership at a glance", "كل تفاصيل اشتراكك في TapWash أمامك")}
            </p>
          </div>
          <div className="hidden size-14 shrink-0 items-center justify-center rounded-[20px] border border-white/80 bg-white/55 shadow-[0_12px_30px_rgba(27,169,194,0.10)] backdrop-blur-xl sm:flex">
            <CarFront className="size-7 text-[#11a5bf]" />
          </div>
        </header>

        {/* Main glass dashboard: subscription + NFC */}
        {sub ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <GlassCard className="p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#75929a]">
                    {pick("Subscription status", "حالة الاشتراك")}
                  </p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-[#075f73] sm:text-4xl">
                    {packageName}
                  </h2>
                </div>
                <Badge className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-4 py-2 text-emerald-700 shadow-none hover:bg-emerald-400/15">
                  <span className="me-2 inline-block size-2 rounded-full bg-emerald-500" />
                  {statusLabel(sub.status)}
                </Badge>
              </div>

              <div className="my-6 h-px bg-white/80" />

              <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <p className="text-xs text-[#78939b]">{pick("Current package", "الباقة الحالية")}</p>
                  <p className="mt-1 text-lg font-bold text-[#166b7d]">
                    {total} {pick("washes / month", "غسلات / شهر")}
                  </p>
                  <p className="mt-3 text-xs text-[#78939b]">
                    {sub.end_date
                      ? `${pick("Valid until", "سارية حتى")} ${fmtDate(sub.end_date)}`
                      : pick("No renewal date", "لا يوجد تاريخ تجديد")}
                  </p>
                </div>

                <div className="rounded-[22px] border border-white/85 bg-white/48 px-7 py-4 text-center shadow-sm">
                  <p className="text-4xl font-black text-[#0a9ab7]">{remaining}</p>
                  <p className="mt-1 text-[11px] font-medium text-[#73929b]">
                    {pick("remaining washes", "غسلات متبقية")}
                  </p>
                </div>
              </div>

              <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-cyan-900/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#19b8d2] to-[#72ddea] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-[#78949c]">
                <span>{used} {pick("used", "مستخدمة")}</span>
                <span>{remaining} {pick("left", "متبقية")}</span>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#75929a]">
                    {pick("NFC card & balance", "كارت NFC والرصيد")}
                  </p>
                  <h2 className="mt-1 text-xl font-black text-[#075f73]">
                    {pick("Your car card", "بطاقة سيارتك")}
                  </h2>
                </div>
                <div className="flex size-10 items-center justify-center rounded-2xl border border-white/80 bg-white/55 shadow-sm">
                  <Nfc className="size-5 text-[#0ba2bd]" />
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-[20px] border border-white/70 bg-gradient-to-br from-[#0d7e98]/90 via-[#17aec6]/85 to-[#74ddeb]/70 p-4 text-white shadow-[0_14px_35px_rgba(10,154,183,0.18)]">
                <div className="flex items-start justify-between">
                  <span className="text-sm font-black tracking-wide">TapWash</span>
                  <Nfc className="size-5 opacity-90" />
                </div>
                <div className="mt-7 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-white/70">
                      {pick("Card number", "رقم البطاقة")}
                    </p>
                    <p className="mt-1 font-mono text-xs font-bold tracking-wider">
                      {card?.card_number ?? card?.uid ?? card?.serial_number ?? card?.id?.slice?.(0, 12) ?? "—"}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-bold">
                    ● {pick("Active", "نشط")}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between rounded-2xl border border-white/80 bg-white/45 px-4 py-3">
                <div>
                  <p className="text-[10px] text-[#78939b]">{pick("Balance", "الرصيد الحالي")}</p>
                  <p className="mt-1 text-2xl font-black text-[#079ab7]">{remaining}</p>
                </div>
                <span className="pb-1 text-[10px] font-bold text-[#73929b]">
                  {pick("washes available", "غسلات متاحة")}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-cyan-100/80 bg-cyan-50/45 px-3 py-2.5 text-[10px] text-[#62848e]">
                <Waves className="size-4 shrink-0 text-[#13a8c1]" />
                {pick("Tap your phone on the NFC card to start booking", "قرّب هاتفك من كارت NFC لبدء الحجز")}
              </div>
            </GlassCard>
          </div>
        ) : (
          <GlassCard className="p-8 text-center">
            <h3 className="text-xl font-bold text-[#075f73]">{t("no_subscription")}</h3>
            <p className="mt-2 text-sm text-[#78949c]">{t("no_subscription_d")}</p>
            <Button asChild className="mt-5">
              <Link to="/packages">{t("hero_cta")}</Link>
            </Button>
          </GlassCard>
        )}

        {/* Three compact summary cards */}
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <GlassCard className="min-h-[158px] p-5">
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-2xl border border-white/80 bg-white/55 text-[#10a3bd] shadow-sm">
                <Droplets className="size-5" />
              </div>
              <span className="text-[10px] font-semibold text-[#8aa0a7]">{pick("Latest", "الأحدث")}</span>
            </div>
            <p className="mt-5 text-xs text-[#78939b]">{t("last_wash")}</p>
            <p className="mt-1 text-xl font-black text-[#126a7c]">
              {lastWash?.washed_at ? fmtDate(lastWash.washed_at) : "—"}
            </p>
            <p className="mt-1 text-[10px] text-[#8ba1a8]">
              {lastWash?.branch ?? pick("No wash yet", "لا توجد غسلة بعد")}
            </p>
          </GlassCard>

          <GlassCard className="min-h-[158px] p-5">
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-2xl border border-white/80 bg-white/55 text-amber-500 shadow-sm">
                <Star className="size-5 fill-current" />
              </div>
              <span className="text-[10px] font-semibold text-[#8aa0a7]">{pick("Rewards", "المكافآت")}</span>
            </div>
            <p className="mt-5 text-xs text-[#78939b]">{pick("Loyalty points", "نقاط الولاء")}</p>
            <p className="mt-1 text-2xl font-black text-[#126a7c]">{points.toLocaleString("en-US")}</p>
            <p className="mt-1 text-[10px] text-[#8ba1a8]">{pick("points earned", "نقطة مكتسبة")}</p>
          </GlassCard>

          <GlassCard className="min-h-[158px] p-5">
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-2xl border border-white/80 bg-white/55 text-[#10a3bd] shadow-sm">
                <CalendarDays className="size-5" />
              </div>
              <span className="text-[10px] font-semibold text-[#8aa0a7]">{pick("Upcoming", "القادم")}</span>
            </div>
            <p className="mt-5 text-xs text-[#78939b]">{pick("Next booking", "الحجز القادم")}</p>
            <p className="mt-1 text-xl font-black text-[#126a7c]">
              {booking ? pick("Booked", "محجوز") : "—"}
            </p>
            <p className="mt-1 text-[10px] text-[#8ba1a8]">{bookingDate}</p>
          </GlassCard>
        </div>

        {/* Existing actions */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Button size="lg" onClick={renew} className="rounded-2xl shadow-[0_10px_25px_rgba(10,154,183,0.18)]">
            <RefreshCw className="me-1.5 size-4" />
            {t("renew")}
          </Button>
          <Button size="lg" variant="outline" asChild className="rounded-2xl border-white/80 bg-white/45 backdrop-blur-xl">
            <a href={wa ? `https://wa.me/${wa}` : "#"} target="_blank" rel="noreferrer">
              <MessageCircle className="me-1.5 size-4" />
              {t("whatsapp")}
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild className="rounded-2xl border-white/80 bg-white/45 backdrop-blur-xl">
            <a href={`tel:${settings?.phone ?? ""}`}>
              <Phone className="me-1.5 size-4" />
              {t("call")}
            </a>
          </Button>
        </div>

        {/* Supporting sections kept functional */}
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <GlassCard className="p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-[#075f73]">
              <CreditCard className="size-4 text-[#0ba2bd]" /> {t("my_cards")}
            </h3>
            <div className="mt-4 space-y-3">
              {(cards ?? []).length === 0 && <p className="text-sm text-[#78949c]">{t("empty")}</p>}
              {(cards ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/35 p-4">
                  <div>
                    <p className="font-semibold text-[#126a7c]">
                      {c.card_type === "card" ? t("card") : c.card_type === "sticker" ? t("sticker") : t("keychain")}
                    </p>
                    <p className="text-xs text-[#78949c]">{c.serial_number}</p>
                  </div>
                  <Badge variant="secondary" className="bg-white/55">{fmtDate(c.activation_date)}</Badge>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-[#075f73]">
              <Droplets className="size-4 text-[#0ba2bd]" /> {t("wash_history")}
            </h3>
            <div className="mt-4 space-y-3">
              {(washes ?? []).length === 0 && <p className="text-sm text-[#78949c]">{t("empty")}</p>}
              {(washes ?? []).map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/35 p-4 text-sm">
                  <span className="font-medium text-[#126a7c]">{fmtDate(w.washed_at)}</span>
                  <span className="text-[#78949c]">{w.branch ?? "—"}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <GlassCard className="mt-5 p-6">
          <h3 className="flex items-center gap-2 text-lg font-bold text-[#075f73]">
            <Bell className="size-4 text-[#0ba2bd]" /> {t("notifications")}
          </h3>
          <div className="mt-4 space-y-3">
            {(notifications ?? []).length === 0 && <p className="text-sm text-[#78949c]">{t("empty")}</p>}
            {(notifications ?? []).map((n) => (
              <div key={n.id} className="rounded-2xl border border-white/80 bg-white/35 p-4">
                <p className="font-semibold text-[#126a7c]">{n.title}</p>
                <p className="mt-1 text-sm text-[#78949c]">{n.message}</p>
                <p className="mt-2 text-xs text-[#8ba1a8]">{fmtDate(n.created_at)}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Profile dialogs remain available from the existing customer flow. */}
        <div className="sr-only">
          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogTrigger asChild><Button variant="outline"><UserCog />{t("edit_profile")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("edit_profile")}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>{t("full_name")}</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>{t("phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-2"><Label>{t("avatar_url")}</Label><Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={saveProfile}>{t("save")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={passOpen} onOpenChange={setPassOpen}>
            <DialogTrigger asChild><Button variant="outline"><KeyRound />{t("change_password")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("change_password")}</DialogTitle></DialogHeader>
              <div className="space-y-2"><Label>{t("new_password")}</Label><Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <DialogFooter><Button onClick={changePassword} disabled={password.length < 6}>{t("save")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-[24px] border border-white/80 bg-white/35 p-4 shadow-[0_15px_40px_rgba(27,169,194,0.10)] backdrop-blur-xl">
          <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-50/70 text-[#0da2bc]"><Sparkles className="size-5" /></div>
          <div className="flex-1">
            <p className="text-xs font-extrabold text-[#176b7c]">{pick("Wash smarter with TapWash", "غسيلك أسهل مع TapWash")}</p>
            <p className="mt-0.5 text-[10px] text-[#7c989f]">{pick("Book, wash and earn rewards in one place.", "احجز واغسل واجمع نقاطك من مكان واحد.")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
