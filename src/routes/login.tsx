import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
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
      {
        name: "description",
        content:
          "Sign in to your TapWash account to view your membership, remaining washes and NFC tags.",
      },
      { property: "og:title", content: "Sign in — TapWash" },
      {
        property: "og:description",
        content: "Access your TapWash membership dashboard.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t, pick } = useI18n();
  const navigate = useNavigate();
  const { user, ready } = useSession();

  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    if (ready && user) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [ready, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (busy) return;

    setBusy(true);

    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });

        if (error) {
          throw error;
        }

        toast.success(t("login_title"));

        navigate({
          to: "/dashboard",
          replace: true,
        });

        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            full_name: form.name.trim(),
          },
        },
      });

      if (error) {
        throw error;
      }

      /*
       * If email confirmation is disabled in Supabase,
       * Supabase returns a session immediately.
       *
       * If email confirmation is enabled,
       * session will normally be null and the user
       * needs to confirm their email first.
       */
      if (data.session) {
        toast.success("تم إنشاء الحساب بنجاح");

        navigate({
          to: "/dashboard",
          replace: true,
        });
      } else {
        toast.success(t("check_email"));
        setMode("in");
      }
    } catch (err) {
      console.error("Authentication error:", err);

      toast.error(
        err instanceof Error
          ? err.message
          : t("error"),
      );
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    if (busy) return;

    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error("Google authentication error:", err);

      toast.error(
        err instanceof Error
          ? err.message
          : t("error"),
      );

      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col p-6 sm:p-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="surface-blue flex size-9 items-center justify-center rounded-xl shadow-luxe">
              <Sparkles className="size-4" />
            </span>

            <span className="font-display text-base font-bold">
              {t("brand")}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="animate-fade-up text-3xl font-bold">
            {mode === "in"
              ? t("login_title")
              : t("signup_title")}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "in"
              ? t("login_sub")
              : t("signup_sub")}
          </p>

          <form
            onSubmit={submit}
            className="mt-8 space-y-4"
          >
            {mode === "up" && (
              <div className="space-y-2">
                <Label htmlFor="name">
                  {t("full_name")}
                </Label>

                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                    })
                  }
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">
                {t("email")}
              </Label>

              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                {t("password")}
              </Label>

              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={
                  mode === "in"
                    ? "current-password"
                    : "new-password"
                }
                value={form.password}
                onChange={(e) =>
                  setForm({
                    ...form,
                    password: e.target.value,
                  })
                }
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={busy}
            >
              {busy
                ? t("loading")
                : mode === "in"
                  ? t("sign_in")
                  : t("sign_up")}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" />

            {t("or")}

            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="outline"
            size="lg"
            onClick={google}
            disabled={busy}
          >
            {t("google_sign_in")}
          </Button>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {mode === "in"
              ? t("no_account")
              : t("have_account")}{" "}

            <button
              type="button"
              onClick={() =>
                setMode(
                  mode === "in"
                    ? "up"
                    : "in",
                )
              }
              className="font-semibold text-primary hover:underline"
            >
              {mode === "in"
                ? t("sign_up")
                : t("sign_in")}
            </button>
          </p>
        </div>
      </div>

      <div className="relative hidden lg:block">
        <img
          src={heroCar}
          alt={pick(
            "TapWash detailing studio",
            "استوديو تاب واش",
          )}
          width={1600}
          height={1200}
          className="size-full object-cover"
        />

        <div className="surface-ink absolute inset-0 opacity-45" />

        <div className="absolute bottom-12 start-12 end-12 text-ink-foreground">
          <p className="font-display text-3xl font-bold">
            {t("hero_badge")}
          </p>

          <p className="mt-2 max-w-md opacity-70">
            {t("cta_sub")}
          </p>
        </div>
      </div>
    </div>
  );
}