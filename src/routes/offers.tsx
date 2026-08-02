import { createFileRoute } from "@tanstack/react-router";

import { PageHero, SiteLayout } from "@/components/site/Chrome";
import { OfferCard } from "@/components/site/Cards";
import { useI18n } from "@/lib/i18n";
import { useOffers } from "@/lib/data";

export const Route = createFileRoute("/offers")({
  head: () => ({
    meta: [
      { title: "Current Car Wash Offers — TapWash" },
      {
        name: "description",
        content:
          "Live TapWash promotions: discounted memberships, free extra washes and NFC starter kit bundles.",
      },
      { property: "og:title", content: "Current Car Wash Offers — TapWash" },
      {
        property: "og:description",
        content: "Discounted memberships and NFC starter kit bundles, updated monthly.",
      },
    ],
  }),
  component: Offers,
});

function Offers() {
  const { t, pick } = useI18n();
  const { data, isLoading } = useOffers();
  const live = (data ?? []).filter((o) => o.status === "active");

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("nav_offers")}
        title={t("featured_offers")}
        subtitle={pick(
          "Limited-time promotions on memberships and NFC kits.",
          "عروض محدودة على العضويات وأدوات NFC.",
        )}
      />
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
        {isLoading ? (
          <p className="text-muted-foreground">{t("loading")}</p>
        ) : live.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {live.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
