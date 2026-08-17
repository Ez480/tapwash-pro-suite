import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageToggle, ThemeToggle } from "@/components/site/Chrome";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — TapWash" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { user, ready } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoverySession, setRecoverySession] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (user) setRecoverySession(true);

    const handleRecovery = () => setRecoverySession(true);
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") handleRecovery();
    });
    return () => listener.subscription.unsubscribe();
  }, [ready, user]);

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("تم إرسال رابط إعادة تعيين كلمة السر إلى بريدك الإلكتروني.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إرسال رابط إعادة التعيين.");
    } finally {
      setBusy(false);
    }
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("كلمة السر يجب أن تكون 6 أحرف على الأقل.");
    if (password !== confirmPassword) return toast.error("كلمتا السر غير متطابقتين.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("تم تغيير كلمة السر بنجاح.");
      await supabase.auth.signOut();
      navigate({ to: "/login", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تغيير كلمة السر.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-8 pt-20">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="surface-blue flex size-9 items-center justify-center rounded-xl shadow-luxe"><Sparkles className="size-4" /></span>
          <span className="font-display text-base font-bold">TapWash</span>
        </Link>
        <div className="absolute end-6 top-6 flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
        <div className="w-full rounded-2xl border bg-card p-6 shadow-sm">
          {recoverySession ? (
            <>
              <h1 className="text-2xl font-bold">تعيين كلمة سر جديدة</h1>
              <p className="mt-2 text-sm text-muted-foreground">اكتب كلمة السر الجديدة لحسابك.</p>
              <form onSubmit={updatePassword} className="mt-6 space-y-4">
                <div className="space-y-2"><Label htmlFor="new-password">كلمة السر الجديدة</Label><Input id="new-password" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></div>
                <div className="space-y-2"><Label htmlFor="confirm-password">تأكيد كلمة السر</Label><Input id="confirm-password" type="password" minLength={6} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" /></div>
                <Button type="submit" className="w-full" disabled={busy}>حفظ كلمة السر</Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">هل نسيت كلمة السر؟</h1>
              <p className="mt-2 text-sm text-muted-foreground">اكتب بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة السر.</p>
              <form onSubmit={sendReset} className="mt-6 space-y-4">
                <div className="space-y-2"><Label htmlFor="reset-email">البريد الإلكتروني</Label><Input id="reset-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
                <Button type="submit" className="w-full" disabled={busy}>إرسال رابط إعادة التعيين</Button>
              </form>
              <Link to="/login" className="mt-5 block text-center text-sm font-medium text-primary hover:underline">العودة لتسجيل الدخول</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
