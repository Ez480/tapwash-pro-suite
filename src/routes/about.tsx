import { createFileRoute } from "@tanstack/react-router";
import { Gauge, ShieldCheck, Nfc } from "lucide-react";

import { PageHero, SiteLayout } from "@/components/site/Chrome";
import { useI18n } from "@/lib/i18n";
import { usePage } from "@/lib/data";
import nfcKit from "@/assets/nfc-kit.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About TapWash — Premium NFC Car Care in Egypt" },
      {
        name: "description",
        content:
          "TapWash combines trained detailers, safe products and NFC technology so every customer knows exactly what they paid for.",
      },
      { property: "og:title", content: "About TapWash — Premium NFC Car Care" },
      {
        property: "og:description",
        content: "Trained detailers, safe products and NFC-tracked memberships in Cairo.",
      },
    ],
  }),
  component: About,
});

function About() {
  const { t, pick } = useI18n();
  const { data: page } = usePage("about");

  const values = [
    { icon: ShieldCheck, t: t("about_v1_t"), d: t("about_v1_d") },
    { icon: Gauge, t: t("about_v2_t"), d: t("about_v2_d") },
    { icon: Nfc, t: t("about_v3_t"), d: t("about_v3_d") },
  ];

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("nav_about")}
        title={page ? pick(page.title_en, page.title_ar) : t("nav_about")}
        subtitle={page ? (pick(page.subtitle_en, page.subtitle_ar) ?? undefined) : undefined}
      />
      <section className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <p className="text-lg leading-relaxed text-muted-foreground">
          {page ? pick(page.content_en, page.content_ar) : ""}
        </p>
        <img
          src={nfcKit}
          alt={pick("TapWash NFC kit", "أدوات NFC من تاب واش")}
          loading="lazy"
          width={1408}
          height={1008}
          className="rounded-3xl object-cover shadow-luxe"
        />
      </section>
      <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {values.map((v) => (
            <div key={v.t} className="panel p-7">
              <v.icon className="size-6 text-primary" />
              <h3 className="mt-4 text-xl font-semibold">{v.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{v.d}</p>
            </div>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
