import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList, LayoutDashboard, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { NotificationCenter } from "@/components/app/NotificationCenter";
import { Button } from "@/components/ui/button";
import { LanguageToggle, ThemeToggle } from "@/components/site/Chrome";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useIsAdmin, useSession } from "@/lib/auth";
import { useSettings } from "@/lib/data";
import { cn } from "@/lib/utils";

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };
}

export function AppTopbar({ title, extra }: { title: string; extra?: ReactNode }) {
  const { t, pick } = useI18n();
  const signOut = useSignOut();
  const { data: s } = useSettings();
  const { user } = useSession();
  const { data: roles } = useIsAdmin(user?.id);
  const isAdmin = (roles ?? []).includes("admin");
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isAdminArea = pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/82 px-4 shadow-sm backdrop-blur-2xl sm:px-6">
      <div className="flex h-16 items-center gap-3">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="surface-blue flex size-8 items-center justify-center rounded-lg shadow-luxe"><Sparkles className="size-4" /></span>
          <span className="hidden font-display text-sm font-bold text-foreground sm:block">{s ? pick(s.company_name_en, s.company_name_ar) : t("brand")}</span>
        </Link>
        <span className="h-5 w-px bg-border" />
        <h1 className="truncate text-sm font-semibold text-muted-foreground">{title}</h1>
        <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
          {extra}
          {isAdmin && <Button asChild variant="outline" size="sm" className={cn("hidden border-primary/25 bg-primary/8 text-primary shadow-sm hover:bg-primary/15 sm:inline-flex", isAdminArea && "border-border bg-secondary text-foreground hover:bg-accent")}><Link to={isAdminArea ? "/dashboard" : "/admin"}>{isAdminArea ? <LayoutDashboard className="me-1.5 size-4" /> : <ShieldCheck className="me-1.5 size-4" />}{isAdminArea ? "لوحة الموظف" : "لوحة المدير"}</Link></Button>}
          {isAdmin && <Button asChild variant="ghost" size="icon" className="text-primary sm:hidden" aria-label={isAdminArea ? "لوحة الموظف" : "لوحة المدير"}><Link to={isAdminArea ? "/dashboard" : "/admin"}>{isAdminArea ? <LayoutDashboard className="size-4" /> : <ShieldCheck className="size-4" />}</Link></Button>}
          <Button asChild variant="ghost" size="icon" aria-label="حالة الطلبات"><Link to="/orders"><ClipboardList className="size-4" /></Link></Button>
          <NotificationCenter />
          <LanguageToggle />
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={signOut} aria-label={t("logout")}><LogOut className="size-4" /></Button>
        </div>
      </div>
    </header>
  );
}

export function StatCard({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: string; tone?: "default" | "primary" | "ink" }) {
  return <div className={cn("animate-fade-up rounded-2xl p-6", tone === "primary" && "surface-blue shadow-luxe", tone === "ink" && "surface-ink shadow-luxe", tone === "default" && "panel")}><p className={cn("text-xs font-semibold uppercase tracking-widest", tone === "default" ? "text-muted-foreground" : "opacity-70")}>{label}</p><p className="mt-3 font-display text-3xl font-extrabold">{value}</p>{hint && <p className={cn("mt-1 text-xs", tone === "default" ? "text-muted-foreground" : "opacity-60")}>{hint}</p>}</div>;
}

export function AdminNav({ items }: { items: { to: string; label: string; icon: React.ElementType }[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [pendingPayments, setPendingPayments] = useState(0);
  const [pendingBookings, setPendingBookings] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [{ count: paymentCount }, { count: bookingCount }] = await Promise.all([
        supabase.from("payments").select("id", { count: "exact", head: true }).in("status", ["pending", "awaiting", "unpaid"]),
        supabase.from("booking_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "new", "awaiting"]),
      ]);
      setPendingPayments(paymentCount ?? 0);
      setPendingBookings(bookingCount ?? 0);
    };

    void load();
    const channel = supabase
      .channel("admin-nav-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_requests" }, () => void load())
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, []);

  return <nav className="flex gap-1 overflow-x-auto pb-1">{items.map((i) => {
    const active = pathname === i.to;
    const isPayments = i.to === "/admin/payments";
    const isBookings = i.to === "/admin/booking-requests";
    const badgeCount = isPayments ? pendingPayments : isBookings ? pendingBookings : 0;
    return <Link key={i.to} to={i.to} className={cn("flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors", active ? "bg-primary text-primary-foreground shadow-card" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
      <i.icon className="size-4" />
      {i.label}
      {badgeCount > 0 && <span className={cn("inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold", active ? "bg-primary-foreground text-primary" : "bg-destructive text-destructive-foreground")}>
        {badgeCount > 99 ? "99+" : badgeCount}
      </span>}
    </Link>;
  })}</nav>;
}
