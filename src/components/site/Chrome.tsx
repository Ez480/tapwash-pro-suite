import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Moon, Sun, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useSession } from "@/lib/auth";
import { useSettings } from "@/lib/data";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", key: "nav_home" }, { to: "/about", key: "nav_about" }, { to: "/services", key: "nav_services" },
  { to: "/packages", key: "nav_packages" }, { to: "/offers", key: "nav_offers" }, { to: "/contact", key: "nav_contact" },
] as const;

const glassIcon = "border border-white/45 bg-white/28 text-foreground shadow-[0_3px_12px_rgba(15,23,42,0.10)] backdrop-blur-xl hover:bg-white/42 hover:shadow-[0_5px_16px_rgba(15,23,42,0.14)] dark:border-white/15 dark:bg-white/[0.07] dark:text-foreground dark:hover:bg-white/[0.12] dark:shadow-[0_3px_14px_rgba(0,0,0,0.30)]";

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return <div className="glass-soft flex items-center rounded-full border border-white/45 bg-white/28 p-0.5 text-xs font-semibold shadow-[0_3px_12px_rgba(15,23,42,0.10)] backdrop-blur-xl dark:border-white/15 dark:bg-white/[0.07] dark:shadow-[0_3px_14px_rgba(0,0,0,0.30)]">{(["ar", "en"] as const).map((l) => <button key={l} onClick={() => setLang(l)} aria-label={l === "ar" ? "العربية" : "English"} className={cn("rounded-full px-2.5 py-1 transition-all", lang === l ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l === "ar" ? "ع" : "EN"}</button>)}</div>;
}

export function ThemeToggle() {
  const { mode, toggle } = useTheme(); const { t } = useI18n();
  return <Button variant="ghost" size="icon" onClick={toggle} aria-label={t("theme")} className={cn("rounded-xl", glassIcon)}>{mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>;
}

export function Header() {
  const { t, pick } = useI18n(); const { user } = useSession(); const { data: settings } = useSettings(); const [open, setOpen] = useState(false); const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = <>{links.map((l) => <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className={cn("text-sm font-medium transition-colors hover:text-foreground", pathname === l.to ? "text-foreground" : "text-muted-foreground")}>{t(l.key)}</Link>)}</>;
  return <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/70 shadow-sm backdrop-blur-2xl supports-[backdrop-filter]:bg-background/55"><div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6"><Link to="/" className="flex items-center gap-2.5">{settings?.logo_url ? <img src={settings.logo_url} alt={pick(settings.company_name_en, settings.company_name_ar)} className="size-9 rounded-xl border border-white/40 object-cover shadow-[0_3px_12px_rgba(15,23,42,0.10)]" /> : <span className="surface-blue flex size-9 items-center justify-center rounded-xl border border-white/35 shadow-[0_3px_12px_rgba(15,23,42,0.10)]"><Sparkles className="size-4" /></span>}<span className="flex flex-col leading-none"><span className="font-display text-base font-bold tracking-tight text-foreground">{settings ? pick(settings.company_name_en, settings.company_name_ar) : t("brand")}</span><span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{t("tagline")}</span></span></Link><nav className="mx-auto hidden items-center gap-7 lg:flex">{nav}</nav><div className="ms-auto flex items-center gap-2 lg:ms-0"><LanguageToggle /><ThemeToggle /><Button asChild size="sm" className="hidden border border-white/30 shadow-sm sm:inline-flex"><Link to={user ? "/dashboard" : "/login"}>{user ? t("nav_dashboard") : t("nav_login")}</Link></Button><Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className={cn("lg:hidden", glassIcon)} aria-label="Menu"><Menu className="size-5" /></Button></SheetTrigger><SheetContent side="top" className="glass-card pt-12"><nav className="flex flex-col gap-5 text-lg">{nav}</nav><Button asChild className="mt-6 w-full"><Link to={user ? "/dashboard" : "/login"} onClick={() => setOpen(false)}>{user ? t("nav_dashboard") : t("nav_login")}</Link></Button></SheetContent></Sheet></div></div></header>;
}

export function Footer() { const { t, pick } = useI18n(); const { data: s } = useSettings(); return <footer className="customer-footer mt-24 border-t border-border/70 bg-card/48 text-foreground backdrop-blur-2xl"><div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4"><div className="md:col-span-2"><p className="font-display text-2xl font-bold text-foreground">{s ? pick(s.company_name_en, s.company_name_ar) : t("brand")}</p><p className="mt-3 max-w-sm text-sm text-muted-foreground">{pick("NFC-powered car wash memberships across Cairo & Giza.", "عضويات غسيل سيارات بتقنية NFC في القاهرة والجيزة.")}</p></div><div className="space-y-2 text-sm">{links.map((l) => <Link key={l.to} to={l.to} className="block text-muted-foreground transition-colors hover:text-foreground">{t(l.key)}</Link>)}</div><div className="space-y-2 text-sm text-muted-foreground">{s?.phone && <p>{s.phone}</p>}{s?.email && <p>{s.email}</p>}{s && <p>{pick(s.address_en ?? "", s.address_ar ?? "")}</p>}<div className="flex gap-4 pt-2">{s?.facebook_url && <a href={s.facebook_url} className="hover:text-foreground">Facebook</a>}{s?.instagram_url && <a href={s.instagram_url} className="hover:text-foreground">Instagram</a>}{s?.tiktok_url && <a href={s.tiktok_url} className="hover:text-foreground">TikTok</a>}</div></div></div><div className="border-t border-border/70 py-5 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} {s ? pick(s.company_name_en, s.company_name_ar) : "TapWash"}</div></footer>; }

export function SiteLayout({ children }: { children: React.ReactNode }) { return <div className="customer-site flex min-h-screen flex-col bg-background text-foreground"><Header /><main className="flex-1">{children}</main><Footer /></div>; }
export function PageHero({ eyebrow, title, subtitle }: { eyebrow?: string | undefined; title: string; subtitle?: string | null | undefined }) { return <section className="surface-hero border-b border-border/70"><div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-24">{eyebrow && <p className="animate-fade-in text-xs font-semibold uppercase tracking-[0.25em] text-primary">{eyebrow}</p>}<h1 className="animate-fade-up mt-4 max-w-3xl text-4xl font-bold text-balance-tight text-foreground md:text-6xl">{title}</h1>{subtitle && <p className="animate-fade-up mt-5 max-w-2xl text-lg text-muted-foreground">{subtitle}</p>}</div></section>; }
