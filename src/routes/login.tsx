import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageToggle, ThemeToggle } from "@/components/site/Chrome";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/auth";
import heroCar from "@/assets/hero-car.jpg";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — TapWash Membership Portal" },
      { name: "description", content: "Sign in to your TapWash account to view your membership, remaining washes and NFC tags." },
      { property: "og:title", content: "Sign in — TapWash" },
      { property: "og:description", content: "Access your TapWash membership dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function getAuthErrorMessage(error: unknown) {
  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) return "تعذر الاتصال بخدمة التسجيل. تأكد أن VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY مضبوطتان في Vercel ثم أعد المحاولة.";
  if (error instanceof Error) return error.message;
  return "حدث خطأ غير متوقع أثناء التسجيل.";
}

async function getLandingPath(userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  const roles = (data ?? []).map((row) => row.role as string);
  if (roles.includes("admin")) return "/admin" as const;
  if (roles.includes("employee")) return "/employee-tasks" as const;
  return "/dashboard" as const;
}

function LoginPage() {
  const { t, pick } = useI18n();
  const navigate = useNavigate();
  const { user, ready } = useSession();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    void getLandingPath(user.id).then((path) => { if (!cancelled) navigate({ to: path, replace: true }); }).catch((error) => {
      console.error("Failed to resolve user role", error);
      if (!cancelled) navigate({ to: "/dashboard", replace: true });
    });
    return () => { cancelled = true; };
  }, [ready, user, navigate]);

  const copyPassword = async () => {
    if (!form.password) return toast.error("اكتب كلمة المرور أولاً");
    try { await navigator.clipboard.writeText(form.password); setCopied(true); toast.success("تم نسخ كلمة المرور"); window.setTimeout(() => setCopied(false), 1500); } catch { toast.error("تعذر نسخ كلمة المرور"); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      if (mode === "in") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
        if (error) throw error;
        const path = data.user ? await getLandingPath(data.user.id) : "/dashboard";
        navigate({ to: path, replace: true });
      } else {
        const { error } = await supabase.auth.signUp({ email: form.email.trim(), password: form.password, options: { data: { full_name: form.name.trim() }, emailRedirectTo: `${window.location.origin}/dashboard` } });
        if (error) throw error;
        toast.success(t("check_email")); setMode("in");
      }
    } catch (err) { console.error("TapWash authentication error", err); toast.error(getAuthErrorMessage(err)); } finally { setBusy(false); }
  };

  const google = async () => {
    setBusy(true);
    try { const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/login` } }); if (error) throw error; }
    catch (err) { console.error("TapWash OAuth error", err); toast.error(getAuthErrorMessage(err)); setBusy(false); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col p-6 sm:p-10"><div className="flex items-center justify-between"><Link to="/" className="flex items-center gap-2.5"><span className="surface-blue flex size-9 items-center justify-center rounded-xl shadow-luxe"><Sparkles className="size-4" /></span><span className="font-display text-base font-bold">{t("brand")}</span></Link><div className="flex items-center gap-2"><LanguageToggle /><ThemeToggle /></div></div><div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12"><h1 className="animate-fade-up text-3xl font-bold">{mode === "in" ? t("login_title") : t("signup_title")}</h1><p className="mt-2 text-sm text-muted-foreground">{mode === "in" ? t("login_sub") : t("signup_sub")}</p><form onSubmit={submit} className="mt-8 space-y-4">{mode === "up" && <div className="space-y-2"><Label htmlFor="name">{t("full_name")}</Label><Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>}<div className="space-y-2"><Label htmlFor="email">{t("email")}</Label><Input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div><div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="password">{t("password")}</Label>{mode === "in" && <Link to="/reset-password" className="text-sm font-medium text-primary hover:underline">هل نسيت كلمة السر؟</Link>}</div><div className="relative"><Input id="password" type={showPassword ? "text" : "password"} required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="pe-24" /><div className="absolute inset-y-0 end-2 flex items-center gap-1"><button type="button" onClick={() => setShowPassword((v) => !v)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button><button type="button" onClick={copyPassword} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="نسخ كلمة المرور">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</button></div></div></div><Button type="submit" size="lg" className="w-full" disabled={busy}>{mode === "in" ? t("sign_in") : t("sign_up")}</Button></form><div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground"><span className="h-px flex-1 bg-border" />{t("or")}<span className="h-px flex-1 bg-border" /></div><Button variant="outline" size="lg" onClick={google} disabled={busy}>{t("google_sign_in")}</Button><p className="mt-8 text-center text-sm text-muted-foreground">{mode === "in" ? t("no_account") : t("have_account")} {" "}<button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="font-semibold text-primary hover:underline">{mode === "in" ? t("sign_up") : t("sign_in")}</button></p></div></div><div className="relative hidden lg:block"><img src={heroCar} alt={pick("TapWash detailing studio", "استوديو تاب واش")} width={1600} height={1200} className="size-full object-cover" /><div className="surface-ink absolute inset-0 opacity-45" /><div className="absolute bottom-12 start-12 end-12 text-ink-foreground"><p className="font-display text-3xl font-bold">{t("hero_badge")}</p><p className="mt-2 max-w-md opacity-70">{t("cta_sub")}</p></div></div>
    </div>
  );
}
