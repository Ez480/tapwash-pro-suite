import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, Droplets, Fan, Lightbulb, Shield, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHero, SiteLayout } from "@/components/site/Chrome";
import { useI18n } from "@/lib/i18n";
import { usePage } from "@/lib/data";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Car Wash & Detailing Services — TapWash" },
      {
        name: "description",
        content:
          "Exterior hand wash, interior deep clean, ceramic protection, engine bay cleaning, headlight restoration and mobile washing in Cairo.",
      },
      { property: "og:title", content: "Car Wash & Detailing Services — TapWash" },
      {
        property: "og:description",
        content: "Six professional detailing services designed around your schedule.",
      },
    ],
  }),
  component: Services,
});

function Services() {
  const { t, pick } = useI18n();
  const { data: page } = usePage("services");

  const services = [
    { icon: Droplets, t: t("service_1_t"), d: t("service_1_d") },
    { icon: Fan, t: t("service_2_t"), d: t("service_2_d") },
    { icon: Shield, t: t("service_3_t"), d: t("service_3_d") },
    { icon: Car, t: t("service_4_t"), d: t("service_4_d") },
    { icon: Lightbulb, t: t("service_5_t"), d: t("service_5_d") },
    { icon: Truck, t: t("service_6_t"), d: t("service_6_d") },
  ];

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("nav_services")}
        title={page ? pick(page.title_en, page.title_ar) : t("nav_services")}
        subtitle={page ? (pick(page.subtitle_en, page.subtitle_ar) ?? undefined) : undefined}
      />
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
        {page && (
          <p className="max-w-3xl text-lg text-muted-foreground">
            {pick(page.content_en, page.content_ar)}
          </p>
        )}
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.t}
              className="panel p-7 transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="surface-blue flex size-11 items-center justify-center rounded-2xl shadow-luxe">
                <s.icon className="size-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/packages">{t("hero_cta")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/contact">{t("hero_cta2")}</Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}
