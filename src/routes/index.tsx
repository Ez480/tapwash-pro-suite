import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CreditCard, Nfc, ShieldCheck, Star, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/site/Chrome";
import { OfferCard, PackageCard } from "@/components/site/Cards";
import { useI18n } from "@/lib/i18n";
import { useOffers, usePackages, usePage } from "@/lib/data";
import heroCar from "@/assets/hero-car.jpg";
import nfcKit from "@/assets/nfc-kit.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TapWash — NFC Car Wash Memberships in Cairo" },
      {
        name: "description",
        content:
          "Tap your NFC card, keychain or sticker and drive off clean. Monthly car wash memberships across Cairo and Giza with real-time wash tracking.",
      },
      { property: "og:title", content: "TapWash — NFC Car Wash Memberships in Cairo" },
      {
        property: "og:description",
        content: "Monthly NFC car wash memberships with real-time wash tracking.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { t, pick } = useI18n();
  const { data: page } = usePage("home");
  const { data: packages } = usePackages();
  const { data: offers } = useOffers();

  const active = (packages ?? []).filter((p) => p.status === "active");
  const liveOffers = (offers ?? []).filter((o) => o.status === "active").slice(0, 3);

  const steps = [
    { icon: CreditCard, t: t("how_1_t"), d: t("how_1_d") },
    { icon: Nfc, t: t("how_2_t"), d: t("how_2_d") },
    { icon: Timer, t: t("how_3_t"), d: t("how_3_d") },
  ];

  const stats = [
    { v: "12,400+", l: t("stat_cards") },
    { v: "86,000+", l: t("stat_washes") },
    { v: "3,150", l: t("stat_members") },
    { v: "4.9", l: t("stat_rating") },
  ];

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="surface-hero relative overflow-hidden">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="animate-fade-in inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
              <Nfc className="size-3.5" /> {t("hero_badge")}
            </span>
            <h1 className="animate-fade-up mt-6 text-4xl font-extrabold text-balance-tight md:text-6xl">
              {page ? pick(page.title_en, page.title_ar) : t("brand")}
            </h1>
            <p className="animate-fade-up mt-5 max-w-xl text-lg text-muted-foreground">
              {page
                ? pick(page.subtitle_en, page.subtitle_ar)
                : pick("NFC car care memberships.", "عضويات عناية بالسيارات بتقنية NFC.")}
            </p>
            <p className="mt-4 max-w-xl text-sm text-muted-foreground">
              {page ? pick(page.content_en, page.content_ar) : ""}
            </p>
            <div className="animate-fade-up mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/packages">
                  {t("hero_cta")} <ArrowRight className="ms-1.5 size-4 rtl:rotate-180" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/contact">{t("hero_cta2")}</Link>
              </Button>
            </div>
            <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" /> {t("about_v1_t")}
              </span>
              <span className="flex items-center gap-1.5">
                <Star className="size-4 text-primary" /> 4.9 / 5
              </span>
            </div>
          </div>
          <div className="relative">
            <img
              src={heroCar}
              alt={pick(
                "Luxury black car being washed in a studio",
                "سيارة سوداء فاخرة أثناء الغسيل في استوديو",
              )}
              width={1600}
              height={1200}
              className="animate-fade-in w-full rounded-3xl object-cover shadow-luxe"
            />
            <img
              src={nfcKit}
              alt={pick("NFC card, keychain and sticker", "كارت وميدالية وستيكر NFC")}
              loading="lazy"
              width={1408}
              height={1008}
              className="animate-float absolute -bottom-8 start-0 hidden w-48 rounded-2xl border border-border object-cover shadow-luxe md:block"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-bold md:text-4xl">{t("how_title")}</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.t} className="panel p-7">
              <div className="surface-blue flex size-11 items-center justify-center rounded-2xl shadow-luxe">
                <s.icon className="size-5" />
              </div>
              <p className="mt-5 text-xs font-bold tracking-widest text-primary">0{i + 1}</p>
              <h3 className="mt-1 text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="surface-ink">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l}>
              <p className="font-display text-4xl font-extrabold">{s.v}</p>
              <p className="mt-1 text-sm text-ink-foreground/60">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Packages */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl font-bold md:text-4xl">{t("featured_packages")}</h2>
          <Button asChild variant="ghost">
            <Link to="/packages">
              {t("hero_cta")} <ArrowRight className="ms-1.5 size-4 rtl:rotate-180" />
            </Link>
          </Button>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {active.map((p, i) => (
            <PackageCard key={p.id} pkg={p} featured={i === 1} />
          ))}
        </div>
      </section>

      {/* Offers */}
      {liveOffers.length > 0 && (
        <section className="border-y border-border bg-secondary/40">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-3xl font-bold md:text-4xl">{t("featured_offers")}</h2>
              <Button asChild variant="ghost">
                <Link to="/offers">{t("view_all_offers")}</Link>
              </Button>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {liveOffers.map((o) => (
                <OfferCard key={o.id} offer={o} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
        <div className="surface-blue flex flex-col items-start gap-6 rounded-3xl p-10 shadow-luxe md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold">{t("cta_title")}</h2>
            <p className="mt-2 max-w-xl opacity-85">{t("cta_sub")}</p>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link to="/login">{t("get_started")}</Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}
